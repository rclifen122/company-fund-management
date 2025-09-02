-- V7__add_reimbursement_to_expenses.sql
-- Enhances the expenses table to track reimbursements from bill sharing.

-- 1. Add a column to store the total amount reimbursed for an expense.
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS amount_reimbursed DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- 2. Add a generated column to automatically calculate the net amount.
-- This column will always be (amount - amount_reimbursed).
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS net_amount DECIMAL(15, 2) GENERATED ALWAYS AS (amount - amount_reimbursed) STORED;

-- 3. Add a status column to track the sharing status of the expense.
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS sharing_status TEXT DEFAULT 'not_shared' NOT NULL; -- e.g., not_shared, shared, partially_reimbursed, fully_reimbursed

-- Optional: Add an index on the new status column if it will be frequently filtered.
CREATE INDEX IF NOT EXISTS idx_expenses_sharing_status ON public.expenses(sharing_status);

-- Note: The DEFAULT 'not_shared' will apply to new rows.
-- You may want to run the following UPDATE statement to align any existing data:
-- UPDATE public.expenses SET sharing_status = 'not_shared' WHERE sharing_status IS NULL;
