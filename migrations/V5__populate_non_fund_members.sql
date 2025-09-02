-- V5__populate_non_fund_members.sql
-- Populate non_fund_members based on the provided CSV list.

-- This assumes the employees listed in the CSV already exist in the 'employees' table.
-- The trigger from V4 will automatically set 'participates_in_fund = false' for these employees.

INSERT INTO non_fund_members (employee_id, reason)
SELECT id, 'From CSV list' FROM employees WHERE name IN (
  'HOSHIYAMA',
  'LÊ THẾ NGÂN',
  'VĂN HOÀNG THỜI',
  'TRƯƠNG NHỈ KHANG',
  'NGUYỄN THỊ CẨM LAN',
  'NGUYỄN THỊ KIM NGỌC',
  'NGUYỄN THỊ HỒNGHUỆ',
  'LÊ THÀNH TIẾN',
  'NGUYỄN THÙY DUNG',
  'PHẠM HỮU HẢI',
  'NGUYỄN THỊ TUYẾT LINH',
  'NGUYỄN THỊ THANH THẢO',
  'BÙI THỊ MỸ HOA',
  'TRỊNH LÊ MỸ DUYÊN',
  'QUỲNH NHƯ',
  'LÊ THÁI'
)
ON CONFLICT (employee_id) DO NOTHING;
