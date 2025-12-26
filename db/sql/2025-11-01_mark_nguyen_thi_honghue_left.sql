-- Mark NGUYỄN THỊ HỒNGHUỆ as having left the company from November.
-- Uses the provided employee id. Adjust the leave_date if needed.

begin;

-- Set leave date and deactivate employee; also stop fund participation.
update public.employees
set
  leave_date = date '2024-11-01',
  status = 'inactive',
  participates_in_fund = false
where id = '05a47f34-0d51-489b-850d-3b54cbcd447e';

commit;
