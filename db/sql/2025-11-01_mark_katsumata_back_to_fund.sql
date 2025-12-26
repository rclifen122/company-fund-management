-- Mark "KATSUMATA" back to Fund (fund participant instead of direct)
--
-- How to use:
-- - Run in Supabase SQL editor on the effective date (defaults to today).
-- - The script will:
--   * Validate the employee exists by UUID.
--   * Remove any non_fund_members row for this employee.
--   * Set employees.participates_in_fund = TRUE (defensive; trigger would also restore).
--   * Output verification queries.
--
-- Requirements:
-- - non_fund_members table and sync triggers from migrations V4/V5 are present.

do $$
declare
  v_emp_id constant uuid := '8f5a4e44-316d-4e94-9421-e6578712319b'; -- KATSUMATA
  v_effective_from date := current_date; -- change if you need a future effective date
  v_exists boolean;
begin
  -- Validate employee exists
  select exists(select 1 from public.employees where id = v_emp_id) into v_exists;
  if not v_exists then
    raise exception 'Employee not found by id: %', v_emp_id;
  end if;

  -- Remove explicit non-fund record (sync trigger will set participates_in_fund = TRUE on DELETE)
  delete from public.non_fund_members
  where employee_id = v_emp_id;

  -- Defensive: ensure participates_in_fund is TRUE
  update public.employees
     set participates_in_fund = true
   where id = v_emp_id;

  raise notice 'Employee % marked as FUND participant effective %', v_emp_id, v_effective_from;
end $$;

-- Verify
select id, name, participates_in_fund
from public.employees
where id = '8f5a4e44-316d-4e94-9421-e6578712319b';

select *
from public.non_fund_members
where employee_id = '8f5a4e44-316d-4e94-9421-e6578712319b';
