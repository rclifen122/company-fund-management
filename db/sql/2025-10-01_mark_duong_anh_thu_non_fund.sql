-- Mark "Duong Anh Thu" as non-fund (direct payer)
--
-- How to use:
-- - Run this script in Supabase SQL editor on the FIRST DAY OF NEXT MONTH
--   (or on the exact effective date) to switch the employee out of the fund.
-- - The script will:
--   * Find the employee by name (case-insensitive, unaccented match)
--   * Upsert a row into public.non_fund_members with effective_from = current_date
--   * Ensure employees.participates_in_fund is set to FALSE (trigger does this; we also enforce defensively)
--   * Output verification queries at the end
--
-- Requirements:
-- - The non_fund_members table and sync triggers should already exist
--   (created by your migrations V4/V5 or db/migrations scripts).
-- - If your database stores the name with diacritics or a different spelling,
--   adjust the 'Duong Anh Thu' literal below to match, or filter by email/id instead.

do $$
declare
  -- Set to the exact UUID for DƯƠNG ANH THƯ
  v_emp_id constant uuid := '3e847c6c-788f-4777-96a7-dc45d8df31ef';
  v_effective_from date := current_date; -- Run date (the effective date)
  v_exists boolean;
begin
  -- Validate employee exists
  select exists(select 1 from public.employees where id = v_emp_id) into v_exists;
  if not v_exists then
    raise exception 'Employee not found by id: %', v_emp_id;
  end if;

  -- Insert/Update non_fund_members. INSERT will flip participates_in_fund to FALSE via trigger.
  insert into public.non_fund_members (employee_id, reason, effective_from)
  values (v_emp_id, 'Quit Fund effective ' || to_char(v_effective_from, 'YYYY-MM-DD'), v_effective_from)
  on conflict (employee_id) do update
    set reason = excluded.reason,
        effective_from = excluded.effective_from;

  -- Defensive: ensure the flag is false (trigger should already handle this)
  update public.employees
     set participates_in_fund = false
   where id = v_emp_id;

  raise notice 'Updated employee id=%: participates_in_fund set to FALSE; non_fund_members upserted for %',
    v_emp_id, v_effective_from;
end $$;

-- Verify the change
select id, name, email, participates_in_fund
from public.employees
where id = '3e847c6c-788f-4777-96a7-dc45d8df31ef';

select *
from public.non_fund_members
where employee_id = '3e847c6c-788f-4777-96a7-dc45d8df31ef';
