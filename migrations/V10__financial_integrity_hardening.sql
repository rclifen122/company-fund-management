-- Financial integrity hardening applied after V9.
-- Run manually in the Supabase SQL editor. This migration never deletes rows.

begin;

do $$
begin
  if to_regprocedure('public.create_bill_sharing(uuid[],uuid[],uuid[])') is null
     or to_regprocedure('public.is_app_admin()') is null then
    raise exception 'V10 requires V9__security_hardening.sql to be applied first.';
  end if;
end;
$$;

-- Views must use the caller's RLS context. V9 secured the member views but the
-- aggregate financial view also needs the same treatment.
do $$
begin
  if to_regclass('public.fund_summary') is not null then
    execute 'alter view public.fund_summary set (security_invoker = true)';
    execute 'revoke all privileges on public.fund_summary from public, anon';
    execute 'grant select on public.fund_summary to authenticated';
  end if;
end;
$$;

-- New writes must respect the core monetary invariants. NOT VALID preserves
-- legacy rows for explicit reconciliation while enforcing every new write.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and conname = 'expenses_amount_positive_check'
  ) then
    alter table public.expenses
      add constraint expenses_amount_positive_check
      check (amount > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and conname = 'expenses_reimbursement_range_check'
  ) then
    alter table public.expenses
      add constraint expenses_reimbursement_range_check
      check (amount_reimbursed >= 0 and amount_reimbursed <= amount) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.fund_payments'::regclass
      and conname = 'fund_payments_amount_positive_check'
  ) then
    alter table public.fund_payments
      add constraint fund_payments_amount_positive_check
      check (amount > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.fund_payments'::regclass
      and conname = 'fund_payments_months_nonempty_check'
  ) then
    alter table public.fund_payments
      add constraint fund_payments_months_nonempty_check
      check (coalesce(cardinality(months_covered), 0) > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.fund_payments'::regclass
      and conname = 'fund_payments_method_check'
  ) then
    alter table public.fund_payments
      add constraint fund_payments_method_check
      check (payment_method in ('cash', 'bank_transfer', 'e_wallet')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employees'::regclass
      and conname = 'employees_contribution_positive_check'
  ) then
    alter table public.employees
      add constraint employees_contribution_positive_check
      check (monthly_contribution_amount > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employees'::regclass
      and conname = 'employees_total_paid_nonnegative_check'
  ) then
    alter table public.employees
      add constraint employees_total_paid_nonnegative_check
      check (total_paid >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.employees'::regclass
      and conname = 'employees_dates_order_check'
  ) then
    alter table public.employees
      add constraint employees_dates_order_check
      check (leave_date is null or leave_date > join_date) not valid;
  end if;
end;
$$;

-- Validate month keys at the database boundary because browser validation can
-- be bypassed with a direct REST request.
create or replace function public.validate_fund_payment_months()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  covered_month text;
begin
  if coalesce(cardinality(new.months_covered), 0) = 0 then
    raise exception 'At least one covered month is required';
  end if;

  foreach covered_month in array new.months_covered loop
    if covered_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
      raise exception 'Invalid covered month: %', covered_month;
    end if;
  end loop;

  if exists (
    select 1
    from unnest(new.months_covered) as month_value
    group by month_value
    having count(*) > 1
  ) then
    raise exception 'Covered months cannot contain duplicates';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_fund_payment_months_trigger on public.fund_payments;
create trigger validate_fund_payment_months_trigger
before insert or update of months_covered on public.fund_payments
for each row execute function public.validate_fund_payment_months();

revoke all on function public.validate_fund_payment_months() from public, anon, authenticated;

-- `total_paid` is a cached projection of the immutable payment ledger. Fix the
-- employee reassignment case and run the trigger with owner privileges so the
-- browser never needs permission to edit the cached total directly.
create or replace function public.update_employee_total_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.employees
    set total_paid = coalesce(total_paid, 0) + new.amount
    where id = new.employee_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.employees
    set total_paid = greatest(0, coalesce(total_paid, 0) - old.amount)
    where id = old.employee_id;
    return old;
  elsif tg_op = 'UPDATE' then
    if new.employee_id is distinct from old.employee_id then
      update public.employees
      set total_paid = greatest(0, coalesce(total_paid, 0) - old.amount)
      where id = old.employee_id;

      update public.employees
      set total_paid = coalesce(total_paid, 0) + new.amount
      where id = new.employee_id;
    else
      update public.employees
      set total_paid = greatest(0, coalesce(total_paid, 0) - old.amount + new.amount)
      where id = new.employee_id;
    end if;
    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists trigger_update_employee_total_paid on public.fund_payments;
create trigger trigger_update_employee_total_paid
after insert or update or delete on public.fund_payments
for each row execute function public.update_employee_total_paid();

revoke all on function public.update_employee_total_paid() from public, anon, authenticated;

-- Existing V2 installations used CASCADE. Preserve sharing history and its
-- rollback ledger by replacing those foreign keys with RESTRICT.
do $$
declare
  constraint_record record;
  expense_attribute smallint;
  employee_attribute smallint;
begin
  select attnum into expense_attribute
  from pg_attribute
  where attrelid = 'public.bill_sharing_expenses'::regclass
    and attname = 'expense_id';

  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.bill_sharing_expenses'::regclass
      and contype = 'f'
      and conkey = array[expense_attribute]
  loop
    execute format(
      'alter table public.bill_sharing_expenses drop constraint %I',
      constraint_record.conname
    );
  end loop;

  alter table public.bill_sharing_expenses
    add constraint bill_sharing_expenses_expense_id_restrict_fkey
    foreign key (expense_id) references public.expenses(id) on delete restrict;

  select attnum into employee_attribute
  from pg_attribute
  where attrelid = 'public.bill_sharing_participants'::regclass
    and attname = 'employee_id';

  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.bill_sharing_participants'::regclass
      and contype = 'f'
      and conkey = array[employee_attribute]
  loop
    execute format(
      'alter table public.bill_sharing_participants drop constraint %I',
      constraint_record.conname
    );
  end loop;

  alter table public.bill_sharing_participants
    add constraint bill_sharing_participants_employee_id_restrict_fkey
    foreign key (employee_id) references public.employees(id) on delete restrict;
end;
$$;

-- An expense represents one real-world cost and may belong to only one active
-- sharing record. Abort instead of deleting or guessing how to merge duplicates.
do $$
begin
  if exists (
    select expense_id
    from public.bill_sharing_expenses
    group by expense_id
    having count(*) > 1
  ) then
    raise exception 'V10 aborted: duplicate expense links exist in bill_sharing_expenses. Reconcile them manually first.';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bill_sharing_expenses'::regclass
      and conname = 'bill_sharing_expense_once_unique'
  ) then
    alter table public.bill_sharing_expenses
      add constraint bill_sharing_expense_once_unique unique (expense_id);
  end if;
end;
$$;

create or replace function public.guard_linked_expense_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and exists (
    select 1 from public.bill_sharing_expenses where expense_id = old.id
  ) then
    raise exception 'Cannot delete an expense linked to bill sharing; delete the sharing first.';
  end if;

  if tg_op = 'UPDATE'
     and new.amount is distinct from old.amount
     and exists (
       select 1 from public.bill_sharing_expenses where expense_id = old.id
     ) then
    raise exception 'Cannot change the amount of an expense linked to bill sharing; delete the sharing first.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_linked_expense_delete_trigger on public.expenses;
create trigger guard_linked_expense_delete_trigger
before delete on public.expenses
for each row execute function public.guard_linked_expense_mutation();

drop trigger if exists guard_linked_expense_amount_trigger on public.expenses;
create trigger guard_linked_expense_amount_trigger
before update of amount on public.expenses
for each row execute function public.guard_linked_expense_mutation();

revoke all on function public.guard_linked_expense_mutation() from public, anon, authenticated;

-- Lock canonical rows before validation/calculation, reject reused expenses,
-- and reject the undefined one-person birthday case.
create or replace function public.create_bill_sharing(
  expense_ids_input uuid[],
  employee_ids_input uuid[],
  birthday_ids_input uuid[] default array[]::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_sharing_id uuid := gen_random_uuid();
  clean_birthday_ids uuid[] := coalesce(birthday_ids_input, array[]::uuid[]);
  requested_expense_count integer;
  found_expense_count integer;
  participant_count integer;
  found_participant_count integer;
  birthday_count integer;
  sharing_total numeric(15,2);
begin
  if not public.is_app_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if coalesce(cardinality(expense_ids_input), 0) = 0
     or coalesce(cardinality(employee_ids_input), 0) = 0 then
    raise exception 'At least one expense and participant are required';
  end if;
  if array_position(expense_ids_input, null) is not null
     or array_position(employee_ids_input, null) is not null
     or array_position(clean_birthday_ids, null) is not null then
    raise exception 'Input arrays cannot contain null IDs';
  end if;

  perform 1
  from public.expenses e
  where e.id = any(expense_ids_input)
  order by e.id
  for update;

  select count(distinct id) into requested_expense_count
  from unnest(expense_ids_input) as input(id);

  select count(*), coalesce(sum(e.amount), 0)
    into found_expense_count, sharing_total
  from public.expenses e
  where e.id = any(expense_ids_input)
    and e.amount > 0;

  if found_expense_count <> requested_expense_count or sharing_total <= 0 then
    raise exception 'One or more expenses are missing or invalid';
  end if;

  if exists (
    select 1
    from public.bill_sharing_expenses bse
    where bse.expense_id = any(expense_ids_input)
  ) then
    raise exception 'One or more expenses are already linked to bill sharing';
  end if;

  perform 1
  from public.employees e
  where e.id = any(employee_ids_input)
  order by e.id
  for update;

  select count(distinct id) into participant_count
  from unnest(employee_ids_input) as input(id);

  select count(*) into found_participant_count
  from public.employees e
  where e.id = any(employee_ids_input)
    and e.status = 'active'
    and e.leave_date is null;

  if found_participant_count <> participant_count then
    raise exception 'One or more participants are missing or inactive';
  end if;

  if exists (
    select 1
    from unnest(clean_birthday_ids) as birthday(id)
    where not (birthday.id = any(employee_ids_input))
  ) then
    raise exception 'Birthday people must be selected participants';
  end if;

  select count(distinct id) into birthday_count
  from unnest(clean_birthday_ids) as birthday(id);

  if participant_count = 1 and birthday_count = 1 then
    raise exception 'A birthday sharing requires at least one other participant';
  end if;

  insert into public.bill_sharing (id, total_amount, sharing_date, status)
  values (new_sharing_id, sharing_total, current_date, 'pending');

  insert into public.bill_sharing_expenses (
    bill_sharing_id,
    expense_id,
    amount,
    reimbursement_applied
  )
  select new_sharing_id, e.id, e.amount, 0
  from public.expenses e
  where e.id = any(expense_ids_input);

  update public.expenses
  set sharing_status = 'shared'
  where id = any(expense_ids_input)
    and coalesce(amount_reimbursed, 0) = 0;

  with participant_amounts as (
    select
      e.id,
      e.participates_in_fund,
      e.id = any(clean_birthday_ids) as is_birthday_person,
      round(
        case
          when participant_count = 1 then sharing_total
          when birthday_count = 0 then sharing_total / participant_count
          when e.id = any(clean_birthday_ids) then
            (sharing_total / (participant_count - 1)) * (birthday_count - 1) / birthday_count
          else sharing_total / (participant_count - 1)
        end,
        2
      ) as amount_owed
    from public.employees e
    where e.id = any(employee_ids_input)
  )
  insert into public.bill_sharing_participants (
    id,
    bill_sharing_id,
    employee_id,
    amount_owed,
    is_birthday_person,
    payment_method,
    payment_status
  )
  select
    gen_random_uuid(),
    new_sharing_id,
    id,
    amount_owed,
    is_birthday_person,
    'direct',
    'pending'
  from participant_amounts
  where not participates_in_fund
    and amount_owed > 0;

  return new_sharing_id;
end;
$$;

-- Keep status in sync when a pending sharing is deleted. Finalized rollback
-- remains based on V9's immutable reimbursement_applied ledger.
create or replace function public.delete_bill_sharing(sharing_id_input uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  linked_expense record;
begin
  if not public.is_app_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select status into current_status
  from public.bill_sharing
  where id = sharing_id_input
  for update;

  if not found then
    return;
  end if;

  if current_status = 'finalized' then
    if exists (
      select 1
      from public.bill_sharing_expenses
      where bill_sharing_id = sharing_id_input
        and reimbursement_applied is null
    ) then
      raise exception 'Legacy finalized sharing has no rollback ledger; reconcile it manually before deletion.';
    end if;

    for linked_expense in
      select bse.expense_id, bse.reimbursement_applied
      from public.bill_sharing_expenses bse
      join public.expenses e on e.id = bse.expense_id
      where bse.bill_sharing_id = sharing_id_input
      order by e.id
      for update of bse, e
    loop
      update public.expenses
      set amount_reimbursed = greatest(
            0,
            coalesce(amount_reimbursed, 0) - linked_expense.reimbursement_applied
          ),
          sharing_status = case
            when greatest(0, coalesce(amount_reimbursed, 0) - linked_expense.reimbursement_applied) <= 0
              then 'not_shared'
            when greatest(0, coalesce(amount_reimbursed, 0) - linked_expense.reimbursement_applied) < amount
              then 'partially_reimbursed'
            else 'fully_reimbursed'
          end
      where id = linked_expense.expense_id;
    end loop;
  else
    update public.expenses e
    set sharing_status = case
          when coalesce(e.amount_reimbursed, 0) <= 0 then 'not_shared'
          when e.amount_reimbursed < e.amount then 'partially_reimbursed'
          else 'fully_reimbursed'
        end
    where exists (
      select 1
      from public.bill_sharing_expenses bse
      where bse.bill_sharing_id = sharing_id_input
        and bse.expense_id = e.id
    );
  end if;

  delete from public.bill_sharing_participants where bill_sharing_id = sharing_id_input;
  delete from public.bill_sharing_expenses where bill_sharing_id = sharing_id_input;
  delete from public.bill_sharing where id = sharing_id_input;
end;
$$;

-- Reconcile status labels only; no monetary values or rows are changed.
update public.expenses e
set sharing_status = 'shared'
where coalesce(e.amount_reimbursed, 0) = 0
  and exists (
    select 1 from public.bill_sharing_expenses bse where bse.expense_id = e.id
  );

-- Browser clients can create employees, but only the payment trigger may write
-- total_paid. Payment ledger corrections remain a manual SQL-editor operation.
revoke insert, update on table public.employees from authenticated;
grant insert (
  name,
  email,
  phone,
  department,
  monthly_contribution_amount,
  join_date,
  leave_date,
  status,
  participates_in_fund
) on public.employees to authenticated;
grant update (
  name,
  email,
  phone,
  department,
  monthly_contribution_amount,
  join_date,
  leave_date,
  status,
  participates_in_fund
) on public.employees to authenticated;

-- The application has no edit/delete payment workflow. Preserve the ledger
-- against browser/API tampering; corrections can still be performed manually.
revoke update, delete on table public.fund_payments from authenticated;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fund_payments' and column_name = 'recorded_by'
  ) then
    execute 'alter table public.fund_payments alter column recorded_by set default auth.uid()';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'expenses' and column_name = 'created_by'
  ) then
    execute 'alter table public.expenses alter column created_by set default auth.uid()';
  end if;
end;
$$;

revoke all on function public.create_bill_sharing(uuid[], uuid[], uuid[]) from public, anon;
revoke all on function public.delete_bill_sharing(uuid) from public, anon;
grant execute on function public.create_bill_sharing(uuid[], uuid[], uuid[]) to authenticated;
grant execute on function public.delete_bill_sharing(uuid) to authenticated;

commit;
