-- V8__create_finalize_sharing_function.sql
-- Creates a database function to safely finalize a bill sharing event and update expenses.

CREATE OR REPLACE FUNCTION public.finalize_bill_sharing(sharing_id_input uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  total_direct_paid DECIMAL;
  total_linked_expense_amount DECIMAL;
  linked_expense RECORD;
  reimbursement_for_expense DECIMAL;
  current_sharing_status TEXT;
BEGIN
  -- 1. Check if the sharing is already finalized to prevent re-running
  SELECT status INTO current_sharing_status FROM public.bill_sharing WHERE id = sharing_id_input;
  IF current_sharing_status = 'finalized' THEN
    RAISE EXCEPTION 'Bill sharing event % is already finalized.', sharing_id_input;
  END IF;

  -- 2. Calculate the total amount paid by 'direct' members for this sharing event
  SELECT COALESCE(SUM(amount_owed), 0)
  INTO total_direct_paid
  FROM public.bill_sharing_participants
  WHERE bill_sharing_id = sharing_id_input
    AND payment_method = 'direct'
    AND payment_status = 'paid';

  -- If there's nothing to reimburse, just finalize and exit.
  IF total_direct_paid <= 0 THEN
    UPDATE public.bill_sharing
    SET status = 'finalized'
    WHERE id = sharing_id_input;
    RETURN;
  END IF;

  -- 3. Calculate the total amount of all original expenses linked to this sharing
  SELECT COALESCE(SUM(e.amount), 0)
  INTO total_linked_expense_amount
  FROM public.bill_sharing_expenses bse
  JOIN public.expenses e ON bse.expense_id = e.id
  WHERE bse.bill_sharing_id = sharing_id_input;

  -- Avoid division by zero if there are no linked expenses
  IF total_linked_expense_amount <= 0 THEN
    RAISE EXCEPTION 'Cannot finalize sharing %: No linked expenses found or total amount is zero.', sharing_id_input;
  END IF;

  -- 4. Loop through each linked expense and update it proportionally
  FOR linked_expense IN
    SELECT e.id as expense_id, e.amount as expense_amount
    FROM public.bill_sharing_expenses bse
    JOIN public.expenses e ON bse.expense_id = e.id
    WHERE bse.bill_sharing_id = sharing_id_input
  LOOP
    -- Calculate the proportional reimbursement for this specific expense
    reimbursement_for_expense := (linked_expense.expense_amount / total_linked_expense_amount) * total_direct_paid;

    -- Update the expense record
    UPDATE public.expenses
    SET
      amount_reimbursed = expenses.amount_reimbursed + reimbursement_for_expense,
      sharing_status = CASE
        WHEN (expenses.amount_reimbursed + reimbursement_for_expense) >= expenses.amount THEN 'fully_reimbursed'
        ELSE 'partially_reimbursed'
      END
    WHERE id = linked_expense.expense_id;
  END LOOP;

  -- 5. Mark the bill_sharing event as finalized
  UPDATE public.bill_sharing
  SET status = 'finalized'
  WHERE id = sharing_id_input;

END;
$$;
