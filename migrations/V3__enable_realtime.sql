-- Enable Supabase Realtime on core tables
-- Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE employees;
ALTER PUBLICATION supabase_realtime ADD TABLE fund_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE bill_sharing;
ALTER PUBLICATION supabase_realtime ADD TABLE bill_sharing_expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE bill_sharing_participants;

-- Ensure old row data is available for UPDATE/DELETE events
ALTER TABLE employees REPLICA IDENTITY FULL;
ALTER TABLE fund_payments REPLICA IDENTITY FULL;
ALTER TABLE expenses REPLICA IDENTITY FULL;
ALTER TABLE bill_sharing REPLICA IDENTITY FULL;
ALTER TABLE bill_sharing_expenses REPLICA IDENTITY FULL;
ALTER TABLE bill_sharing_participants REPLICA IDENTITY FULL;

