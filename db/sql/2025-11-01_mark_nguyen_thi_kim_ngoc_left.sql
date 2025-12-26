-- Mark NGUYỄN THỊ KIM NGỌC as having left the company in October.
-- Uses the provided employee id. Adjust the leave_date if needed.

begin;

update public.employees
set
  leave_date = date '2024-10-01',
  status = 'inactive',
  participates_in_fund = false
where id = 'c4581e2f-ebe5-41fc-8bcc-3f8a43c2754d';

commit;
