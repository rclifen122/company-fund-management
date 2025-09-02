-- This is a full script to:
-- 1. Add missing employees to the 'employees' table.
-- 2. Create the 'non_fund_members' table and triggers.
-- 3. Populate the 'non_fund_members' table based on your CSV data.

-- Step 1: Add all employees from your list to the 'employees' table.
-- This will only insert employees whose names are not already in the table.
INSERT INTO employees (name, join_date)
SELECT * FROM (
    VALUES
        ('MASUDA TAKEHIKO', CURRENT_DATE),
        ('NGUYỄN TRUNG HIẾU', CURRENT_DATE),
        ('IMAMACHI', CURRENT_DATE),
        ('VI TRẦN PHƯƠNG LINH', CURRENT_DATE),
        ('NGUYỄN HOÀNG YẾN NHI', CURRENT_DATE),
        ('TRẦN ĐÌNH LĨNH', CURRENT_DATE),
        ('NGUYỄN VĂN CHUYỀN', CURRENT_DATE),
        ('TRẦN QUỐC LỘC', CURRENT_DATE),
        ('TRẦN THỊ HUYỀN', CURRENT_DATE),
        ('LÊ VĂN LỘC', CURRENT_DATE),
        ('NGUYỄN THÀNH NGUYÊN', CURRENT_DATE),
        ('TRẦN THANH KIM', CURRENT_DATE),
        ('TRẦN BẢO', CURRENT_DATE),
        ('DƯƠNG ANH THƯ', CURRENT_DATE),
        ('MẠC TUẤN ANH', CURRENT_DATE),
        ('ĐẶNG THỊ LAN', CURRENT_DATE),
        ('HOSHIYAMA', CURRENT_DATE),
        ('LÊ THẾ NGÂN', CURRENT_DATE),
        ('VĂN HOÀNG THỜI', CURRENT_DATE),
        ('TRƯƠNG NHỈ KHANG', CURRENT_DATE),
        ('NGUYỄN THỊ CẨM LAN', CURRENT_DATE),
        ('NGUYỄN THỊ KIM NGỌC', CURRENT_DATE),
        ('NGUYỄN THỊ HỒNGHUỆ', CURRENT_DATE),
        ('LÊ THÀNH TIẾN', CURRENT_DATE),
        ('NGUYỄN THÙY DUNG', CURRENT_DATE),
        ('PHẠM HỮU HẢI', CURRENT_DATE),
        ('NGUYỄN THỊ TUYẾT LINH', CURRENT_DATE),
        ('NGUYỄN THỊ THANH THẢO', CURRENT_DATE),
        ('BÙI THỊ MỸ HOA', CURRENT_DATE),
        ('TRỊNH LÊ MỸ DUYÊN', CURRENT_DATE),
        ('QUỲNH NHƯ', CURRENT_DATE),
        ('LÊ THÁI', CURRENT_date)
) AS new_employees (name, join_date)
WHERE NOT EXISTS (
    SELECT 1 FROM employees WHERE employees.name = new_employees.name
);


-- Step 2: Create the 'non_fund_members' table and synchronization functions (from V4)

ALTER TABLE employees ALTER COLUMN participates_in_fund SET DEFAULT TRUE;
UPDATE employees SET participates_in_fund = COALESCE(participates_in_fund, TRUE);
ALTER TABLE employees ALTER COLUMN participates_in_fund SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_participates_in_fund ON employees (participates_in_fund);

CREATE TABLE IF NOT EXISTS non_fund_members (
  employee_id UUID PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  reason TEXT,
  effective_from DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION sync_employee_participation() RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE employees SET participates_in_fund = FALSE WHERE id = NEW.employee_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE employees SET participates_in_fund = TRUE WHERE id = OLD.employee_id;
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (NEW.employee_id IS DISTINCT FROM OLD.employee_id) THEN
      UPDATE employees SET participates_in_fund = TRUE WHERE id = OLD.employee_id;
      UPDATE employees SET participates_in_fund = FALSE WHERE id = NEW.employee_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_non_fund_members_sync_ins ON non_fund_members;
CREATE TRIGGER trg_non_fund_members_sync_ins
AFTER INSERT ON non_fund_members
FOR EACH ROW EXECUTE FUNCTION sync_employee_participation();

DROP TRIGGER IF EXISTS trg_non_fund_members_sync_del ON non_fund_members;
CREATE TRIGGER trg_non_fund_members_sync_del
AFTER DELETE ON non_fund_members
FOR EACH ROW EXECUTE FUNCTION sync_employee_participation();

DROP TRIGGER IF EXISTS trg_non_fund_members_sync_upd ON non_fund_members;
CREATE TRIGGER trg_non_fund_members_sync_upd
AFTER UPDATE ON non_fund_members
FOR EACH ROW EXECUTE FUNCTION sync_employee_participation();

CREATE OR REPLACE VIEW fund_members AS
SELECT * FROM employees WHERE participates_in_fund = TRUE;

CREATE OR REPLACE VIEW non_fund_members_view AS
SELECT e.*
FROM employees e
JOIN non_fund_members n ON n.employee_id = e.id;


-- Step 3: Populate 'non_fund_members' with employees marked as "Riêng" (from V5)

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
