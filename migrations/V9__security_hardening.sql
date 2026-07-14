-- Security hardening for the Company Fund application.
-- Run this manually in the Supabase SQL editor after reviewing SECURITY_ROLLOUT.md.
-- The script is transactional and aborts unless at least one admin profile exists.

begin;

create extension if not exists pgcrypto;

-- Authorization is based on an explicit profile row, never merely on being logged in.
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

revoke all on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;

do $$
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'Security migration aborted: create at least one profiles.role=admin row first.';
  end if;
end;
$$;

-- Preserve the exact reimbursement applied by each sharing. NULL identifies a
-- legacy finalized sharing for which no immutable ledger was recorded.
alter table public.bill_sharing_expenses
  add column if not exists reimbursement_applied numeric(15,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bill_sharing_status_check') then
    alter table public.bill_sharing
      add constraint bill_sharing_status_check
      check (status in ('pending', 'finalized')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bill_sharing_total_positive_check') then
    alter table public.bill_sharing
      add constraint bill_sharing_total_positive_check
      check (total_amount > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bill_sharing_expense_amount_positive_check') then
    alter table public.bill_sharing_expenses
      add constraint bill_sharing_expense_amount_positive_check
      check (amount > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bill_sharing_reimbursement_nonnegative_check') then
    alter table public.bill_sharing_expenses
      add constraint bill_sharing_reimbursement_nonnegative_check
      check (reimbursement_applied is null or reimbursement_applied >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bill_sharing_participant_amount_nonnegative_check') then
    alter table public.bill_sharing_participants
      add constraint bill_sharing_participant_amount_nonnegative_check
      check (amount_owed >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bill_sharing_participant_method_check') then
    alter table public.bill_sharing_participants
      add constraint bill_sharing_participant_method_check
      check (payment_method in ('fund', 'direct')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bill_sharing_participant_status_check') then
    alter table public.bill_sharing_participants
      add constraint bill_sharing_participant_status_check
      check (payment_status in ('pending', 'paid')) not valid;
  end if;
end;
$$;

-- Create a sharing atomically and derive all monetary values from canonical DB rows.
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

  with participant_amounts as (
    select
      e.id,
      e.participates_in_fund,
      e.id = any(clean_birthday_ids) as is_birthday_person,
      round(
        case
          when participant_count = 1 then
            case when e.id = any(clean_birthday_ids) then 0 else sharing_total end
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

-- Idempotent finalization with row locks and an immutable rollback ledger.
create or replace function public.finalize_bill_sharing(sharing_id_input uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  sharing_total numeric(15,2);
  total_direct_paid numeric(15,2);
  total_expenses_in_sharing numeric(15,2);
  linked_expense record;
  applied_amount numeric(15,2);
begin
  if not public.is_app_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select status, total_amount into current_status, sharing_total
  from public.bill_sharing
  where id = sharing_id_input
  for update;

  if not found then
    raise exception 'Bill sharing not found';
  end if;
  if current_status = 'finalized' then
    return;
  end if;

  select coalesce(sum(amount_owed), 0)
    into total_direct_paid
  from public.bill_sharing_participants
  where bill_sharing_id = sharing_id_input
    and payment_method = 'direct'
    and payment_status = 'paid';

  if exists (
    select 1
    from public.bill_sharing_participants
    where bill_sharing_id = sharing_id_input
      and (
        amount_owed < 0
        or payment_method is null
        or payment_method not in ('direct', 'fund')
      )
  ) then
    raise exception 'Sharing contains invalid participant values';
  end if;
  if exists (
    select 1
    from public.bill_sharing_participants
    where bill_sharing_id = sharing_id_input
      and payment_method = 'direct'
      and payment_status <> 'paid'
  ) then
    raise exception 'All direct participants must be paid before finalization';
  end if;
  if total_direct_paid < 0 or total_direct_paid > sharing_total then
    raise exception 'Direct payments exceed the sharing total';
  end if;

  select coalesce(sum(amount), 0)
    into total_expenses_in_sharing
  from public.bill_sharing_expenses
  where bill_sharing_id = sharing_id_input;

  if total_direct_paid > 0 and total_expenses_in_sharing <= 0 then
    raise exception 'Cannot finalize a sharing without linked expenses';
  end if;
  if abs(total_expenses_in_sharing - sharing_total) > 0.01 then
    raise exception 'Linked expense total does not match the sharing total';
  end if;

  update public.bill_sharing_expenses
  set reimbursement_applied = 0
  where bill_sharing_id = sharing_id_input;

  if total_direct_paid > 0 then
    for linked_expense in
      select
        bse.expense_id,
        bse.amount as linked_amount,
        e.amount as expense_amount,
        coalesce(e.amount_reimbursed, 0) as amount_reimbursed
      from public.bill_sharing_expenses bse
      join public.expenses e on e.id = bse.expense_id
      where bse.bill_sharing_id = sharing_id_input
      order by e.id
      for update of bse, e
    loop
      applied_amount := round(
        (linked_expense.linked_amount / total_expenses_in_sharing) * total_direct_paid,
        2
      );
      applied_amount := least(
        applied_amount,
        greatest(0, linked_expense.expense_amount - linked_expense.amount_reimbursed)
      );

      update public.expenses
      set amount_reimbursed = coalesce(amount_reimbursed, 0) + applied_amount,
          sharing_status = case
            when coalesce(amount_reimbursed, 0) + applied_amount >= amount then 'fully_reimbursed'
            when coalesce(amount_reimbursed, 0) + applied_amount > 0 then 'partially_reimbursed'
            else 'not_shared'
          end
      where id = linked_expense.expense_id;

      update public.bill_sharing_expenses
      set reimbursement_applied = applied_amount
      where bill_sharing_id = sharing_id_input
        and expense_id = linked_expense.expense_id;
    end loop;
  end if;

  update public.bill_sharing
  set status = 'finalized'
  where id = sharing_id_input;
end;
$$;

-- The only supported way for the client to change a participant payment status.
create or replace function public.set_bill_sharing_payment_status(
  participant_id_input uuid,
  payment_status_input text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  sharing_id uuid;
  sharing_status text;
begin
  if not public.is_app_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if payment_status_input not in ('pending', 'paid') then
    raise exception 'Invalid payment status';
  end if;

  select p.bill_sharing_id, s.status
    into sharing_id, sharing_status
  from public.bill_sharing_participants p
  join public.bill_sharing s on s.id = p.bill_sharing_id
  where p.id = participant_id_input
  for update of s, p;

  if not found then
    raise exception 'Participant not found';
  end if;
  if sharing_status = 'finalized' then
    raise exception 'Finalized sharing payments are immutable';
  end if;

  update public.bill_sharing_participants
  set payment_status = payment_status_input,
      payment_date = case when payment_status_input = 'paid' then now() else null end
  where id = participant_id_input;

  if payment_status_input = 'paid'
     and not exists (
       select 1
       from public.bill_sharing_participants
       where bill_sharing_id = sharing_id
         and payment_method = 'direct'
         and payment_status <> 'paid'
     ) then
    perform public.finalize_bill_sharing(sharing_id);
    return true;
  end if;

  return false;
end;
$$;

-- Roll back exactly what finalization applied, then delete in the same transaction.
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
  end if;

  delete from public.bill_sharing_participants where bill_sharing_id = sharing_id_input;
  delete from public.bill_sharing_expenses where bill_sharing_id = sharing_id_input;
  delete from public.bill_sharing where id = sharing_id_input;
end;
$$;

-- Remove PUBLIC/anonymous access to privileged functions. PostgreSQL grants
-- function execution to PUBLIC by default, so the explicit PUBLIC revoke matters.
revoke all on function public.create_bill_sharing(uuid[], uuid[], uuid[]) from public, anon;
revoke all on function public.finalize_bill_sharing(uuid) from public, anon;
revoke all on function public.set_bill_sharing_payment_status(uuid, text) from public, anon;
revoke all on function public.delete_bill_sharing(uuid) from public, anon;

grant execute on function public.create_bill_sharing(uuid[], uuid[], uuid[]) to authenticated;
grant execute on function public.finalize_bill_sharing(uuid) to authenticated;
grant execute on function public.set_bill_sharing_payment_status(uuid, text) to authenticated;
grant execute on function public.delete_bill_sharing(uuid) to authenticated;

-- Reset policies on application tables to a single explicit admin-only model.
alter table public.employees enable row level security;
alter table public.fund_payments enable row level security;
alter table public.expenses enable row level security;
alter table public.profiles enable row level security;
alter table public.non_fund_members enable row level security;
alter table public.bill_sharing enable row level security;
alter table public.bill_sharing_expenses enable row level security;
alter table public.bill_sharing_participants enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'employees',
        'fund_payments',
        'expenses',
        'profiles',
        'non_fund_members',
        'bill_sharing',
        'bill_sharing_expenses',
        'bill_sharing_participants'
      )
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$$;

create policy employees_admin_all on public.employees
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy fund_payments_admin_all on public.fund_payments
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy expenses_admin_all on public.expenses
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy profiles_read_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy non_fund_members_admin_all on public.non_fund_members
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy bill_sharing_admin_read on public.bill_sharing
  for select to authenticated
  using (public.is_app_admin());

create policy bill_sharing_expenses_admin_read on public.bill_sharing_expenses
  for select to authenticated
  using (public.is_app_admin());

create policy bill_sharing_participants_admin_read on public.bill_sharing_participants
  for select to authenticated
  using (public.is_app_admin());

-- Defense in depth: anonymous users receive no table privileges, and bill
-- sharing mutations are only possible through the guarded RPCs.
revoke all privileges on table
  public.employees,
  public.fund_payments,
  public.expenses,
  public.profiles,
  public.non_fund_members,
  public.bill_sharing,
  public.bill_sharing_expenses,
  public.bill_sharing_participants
from anon;

revoke all privileges on table
  public.employees,
  public.fund_payments,
  public.expenses,
  public.profiles,
  public.non_fund_members,
  public.bill_sharing,
  public.bill_sharing_expenses,
  public.bill_sharing_participants
from authenticated;

grant select, insert, update, delete on table
  public.employees,
  public.fund_payments,
  public.expenses,
  public.non_fund_members
to authenticated;

grant select on table
  public.profiles,
  public.bill_sharing,
  public.bill_sharing_expenses,
  public.bill_sharing_participants
to authenticated;

-- Views must execute with the caller's RLS context rather than their owner.
do $$
begin
  if to_regclass('public.fund_members') is not null then
    execute 'alter view public.fund_members set (security_invoker = true)';
    execute 'revoke all privileges on public.fund_members from anon';
    execute 'grant select on public.fund_members to authenticated';
  end if;
  if to_regclass('public.non_fund_members_view') is not null then
    execute 'alter view public.non_fund_members_view set (security_invoker = true)';
    execute 'revoke all privileges on public.non_fund_members_view from anon';
    execute 'grant select on public.non_fund_members_view to authenticated';
  end if;
end;
$$;

commit;
