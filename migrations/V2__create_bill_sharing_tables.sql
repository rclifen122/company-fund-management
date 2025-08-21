-- Add fund participation status to existing employees table
ALTER TABLE employees ADD COLUMN participates_in_fund BOOLEAN DEFAULT TRUE;

-- Main sharing record
CREATE TABLE bill_sharing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_amount DECIMAL(15,2) NOT NULL,
    sharing_date DATE NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Link multiple expenses to one sharing
CREATE TABLE bill_sharing_expenses (
    bill_sharing_id UUID REFERENCES bill_sharing(id) ON DELETE CASCADE,
    expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    PRIMARY KEY (bill_sharing_id, expense_id)
);

-- Individual payment records
CREATE TABLE bill_sharing_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_sharing_id UUID REFERENCES bill_sharing(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    amount_owed DECIMAL(15,2) NOT NULL,
    is_birthday_person BOOLEAN DEFAULT FALSE,
    payment_method TEXT, -- 'fund' or 'direct'
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid'
    payment_date DATE
);
