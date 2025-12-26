-- Mark LE THANH TIEN as having left the company effective October 1, 2025.
-- Adjust the leave_date if a different effective date is needed.

begin;

update public.employees
set
  leave_date = date '2025-10-01',
  status = 'inactive',
  participates_in_fund = false
where id = 'f988510f-ed3b-45ca-a512-5cf2c878fc98';

commit;
