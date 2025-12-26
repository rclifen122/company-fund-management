-- Insert three new employees and mark them as non-fund participants
-- Update emails/phones/join_date if needed before running.

begin;

with new_emps as (
  insert into public.employees (
    name,
    email,
    phone,
    department,
    monthly_contribution_amount,
    join_date,
    status
  )
  values
    ('TRAN HOANG HOAI NAM', 'tran.hoang.hoai.nam@example.com', '0900000001', 'Matching Team', 100000, '2024-11-01', 'active'),
    ('TRAN HOANG PHUC',     'tran.hoang.phuc@example.com',     '0900000002', 'Matching Team', 100000, '2024-11-01', 'active'),
    ('KATSUMATA',           'katsumata@example.com',           '0900000003', 'OS Team',       100000, '2024-11-01', 'active')
  returning id
)
insert into public.non_fund_members (employee_id, reason, effective_from)
select id, 'Non-fund participant for future bill sharing', current_date
from new_emps;

commit;
