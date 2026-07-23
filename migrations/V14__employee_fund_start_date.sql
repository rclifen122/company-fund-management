-- Employees added near the end of a month were instantly marked overdue by the
-- day-15 rule. fund_start_date records the first month (day 01) the employee
-- must contribute; NULL means "start from the month of join_date" so existing
-- rows keep their current behavior without a backfill.

begin;

alter table public.employees
  add column if not exists fund_start_date date;

comment on column public.employees.fund_start_date is
  'Thang bat dau dong quy (luu ngay 01 cua thang). NULL = tinh tu thang cua join_date.';

commit;
