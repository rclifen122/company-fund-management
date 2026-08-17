-- Create one or many fund-payment ledger rows atomically. Both the single-entry
-- and bulk-entry UI use this RPC so duplicate employee/month coverage cannot be
-- introduced by a stale browser view or two administrators saving together.

begin;

create or replace function public.create_fund_payments_batch(payments_input jsonb)
returns setof public.fund_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_item jsonb;
  employee_record public.employees%rowtype;
  inserted_payment public.fund_payments%rowtype;
  employee_id_value uuid;
  amount_value numeric(15,2);
  payment_date_value date;
  months_value text[];
  payment_method_value text;
  notes_value text;
  month_value text;
begin
  if not public.is_app_admin() then
    raise exception 'Only administrators can create fund payments';
  end if;

  if payments_input is null
     or jsonb_typeof(payments_input) <> 'array'
     or jsonb_array_length(payments_input) = 0 then
    raise exception 'At least one payment is required';
  end if;

  if jsonb_array_length(payments_input) > 200 then
    raise exception 'A batch cannot contain more than 200 payments';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(payments_input) as item
    group by item ->> 'employee_id'
    having count(*) > 1
  ) then
    raise exception 'An employee cannot appear more than once in the same batch';
  end if;

  -- Lock every employee in a stable order before checking coverage. Concurrent
  -- submissions for the same employee will therefore serialize safely.
  perform 1
  from public.employees e
  where e.id in (
    select (item ->> 'employee_id')::uuid
    from jsonb_array_elements(payments_input) as item
  )
  order by e.id
  for update;

  if (
    select count(*)
    from public.employees e
    where e.id in (
      select (item ->> 'employee_id')::uuid
      from jsonb_array_elements(payments_input) as item
    )
  ) <> jsonb_array_length(payments_input) then
    raise exception 'One or more employees are missing';
  end if;

  for payment_item in
    select item
    from jsonb_array_elements(payments_input) as item
  loop
    employee_id_value := nullif(payment_item ->> 'employee_id', '')::uuid;
    amount_value := nullif(payment_item ->> 'amount', '')::numeric;
    payment_date_value := nullif(payment_item ->> 'payment_date', '')::date;
    payment_method_value := coalesce(nullif(payment_item ->> 'payment_method', ''), 'cash');
    notes_value := nullif(btrim(coalesce(payment_item ->> 'notes', '')), '');

    if jsonb_typeof(payment_item -> 'months_covered') <> 'array' then
      raise exception 'Covered months must be an array';
    end if;

    select coalesce(array_agg(month_key order by month_key), array[]::text[])
    into months_value
    from jsonb_array_elements_text(payment_item -> 'months_covered') as month_key;

    if amount_value is null or amount_value <= 0 or payment_date_value is null then
      raise exception 'Payment amount and date are required';
    end if;

    if payment_method_value not in ('cash', 'bank_transfer', 'e_wallet', 'other') then
      raise exception 'Invalid payment method';
    end if;

    if coalesce(cardinality(months_value), 0) = 0 then
      raise exception 'At least one covered month is required';
    end if;

    if exists (
      select 1 from unnest(months_value) as selected_month
      where selected_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    ) then
      raise exception 'One or more covered months are invalid';
    end if;

    if (select count(*) from unnest(months_value))
       <> (select count(distinct selected_month) from unnest(months_value) as selected_month) then
      raise exception 'Covered months cannot contain duplicates';
    end if;

    select * into employee_record
    from public.employees
    where id = employee_id_value;

    if employee_record.status = 'inactive'
       or employee_record.leave_date is not null
       or employee_record.participates_in_fund is false then
      raise exception 'Employee % is not an active fund member', employee_record.name;
    end if;

    foreach month_value in array months_value loop
      if coalesce(
        to_char(employee_record.fund_start_date, 'YYYY-MM'),
        to_char(employee_record.join_date, 'YYYY-MM')
      ) > month_value then
        raise exception 'Employee % has not started contributing in %', employee_record.name, month_value;
      end if;
    end loop;

    if amount_value < coalesce(employee_record.monthly_contribution_amount, 100000) * cardinality(months_value) then
      raise exception 'Payment amount is below the required contribution for %', employee_record.name;
    end if;

    if exists (
      select 1
      from public.fund_payments fp
      where fp.employee_id = employee_id_value
        and (case
          when coalesce(cardinality(fp.months_covered), 0) > 0 then fp.months_covered
          else array[to_char(fp.payment_date, 'YYYY-MM')]
        end) && months_value
    ) then
      raise exception 'Employee % already has a payment for one or more selected months', employee_record.name;
    end if;

    if exists (
      select 1
      from public.fund_payment_reconciliations reconciliation
      where reconciliation.employee_id = employee_id_value
        and reconciliation.month_key = any(months_value)
    ) then
      raise exception 'Employee % already has reconciled coverage for one or more selected months', employee_record.name;
    end if;

    insert into public.fund_payments (
      employee_id,
      amount,
      payment_date,
      months_covered,
      payment_method,
      notes,
      recorded_by
    ) values (
      employee_id_value,
      amount_value,
      payment_date_value,
      months_value,
      payment_method_value,
      notes_value,
      auth.uid()
    )
    returning * into inserted_payment;

    return next inserted_payment;
  end loop;

  return;
end;
$$;

revoke all on function public.create_fund_payments_batch(jsonb) from public, anon, authenticated;
grant execute on function public.create_fund_payments_batch(jsonb) to authenticated;

-- Browser writes now go through the guarded RPC. Service-role and SQL-editor
-- maintenance remain available for exceptional ledger corrections.
revoke insert on table public.fund_payments from authenticated;

commit;
