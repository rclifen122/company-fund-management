-- Manage non-fund membership in Supabase (official source of truth)
-- This migration creates a management table, sync triggers, and helper views.

-- 1) Ensure employees table has a NOT NULL participates_in_fund flag and index
ALTER TABLE employees ALTER COLUMN participates_in_fund SET DEFAULT TRUE;
UPDATE employees SET participates_in_fund = COALESCE(participates_in_fund, TRUE);
ALTER TABLE employees ALTER COLUMN participates_in_fund SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_participates_in_fund ON employees (participates_in_fund);

-- 2) Create a management table for non-fund members
CREATE TABLE IF NOT EXISTS non_fund_members (
  employee_id UUID PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  reason TEXT,
  effective_from DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3) Sync function: keep employees.participates_in_fund in sync
CREATE OR REPLACE FUNCTION sync_employee_participation() RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE employees SET participates_in_fund = FALSE WHERE id = NEW.employee_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE employees SET participates_in_fund = TRUE WHERE id = OLD.employee_id;
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- If employee_id changed, restore old and set new
    IF (NEW.employee_id IS DISTINCT FROM OLD.employee_id) THEN
      UPDATE employees SET participates_in_fund = TRUE WHERE id = OLD.employee_id;
      UPDATE employees SET participates_in_fund = FALSE WHERE id = NEW.employee_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4) Triggers on non_fund_members
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

-- 5) Optional backfill: convert existing FALSE flags into explicit rows
INSERT INTO non_fund_members (employee_id, reason)
SELECT id, 'Backfill from existing participates_in_fund = FALSE'
FROM employees
WHERE participates_in_fund = FALSE
ON CONFLICT (employee_id) DO NOTHING;

-- 6) Helper views
CREATE OR REPLACE VIEW fund_members AS
SELECT * FROM employees WHERE participates_in_fund = TRUE;

CREATE OR REPLACE VIEW non_fund_members_view AS
SELECT e.*
FROM employees e
JOIN non_fund_members n ON n.employee_id = e.id;

-- Note: Add RLS policies if needed for client access. For admin-only usage, RLS can remain disabled on non_fund_members.
