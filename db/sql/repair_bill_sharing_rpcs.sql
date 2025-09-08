-- Bill Sharing RPCs Repair Script
--
-- Purpose:
-- - Ensure the finalize and delete RPCs exist in the public schema.
-- - Grant execute permissions to app roles.
-- - Optionally relax RLS on expenses so RPCs can update rows.
-- - Optionally nudge PostgREST to reload its schema cache.
--
-- Usage:
-- 1) Copy all contents into the Supabase SQL editor and run.
-- 2) Then go to Project Settings → API → Reset API cache (if needed).

-- Optional: enable RLS on expenses and add a permissive policy (adjust per your auth model)
alter table if exists public.expenses enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='expenses' and policyname='Allow all for admin on expenses'
  ) then
    create policy "Allow all for admin on expenses"
      on public.expenses for all using (true) with check (true);
  end if;
end $$;

-- Recreate finalize function with SECURITY DEFINER and stable search_path
create or replace function public.finalize_bill_sharing(sharing_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total_direct_paid numeric(15,2);
  total_expenses_in_sharing numeric(15,2);
begin
  -- Sum of direct payments that are marked as paid
  select coalesce(sum(amount_owed),0) into total_direct_paid
  from public.bill_sharing_participants
  where bill_sharing_id = sharing_id_input
    and payment_method = 'direct'
    and payment_status = 'paid';

  -- If nothing collected directly, just mark finalized and exit
  if coalesce(total_direct_paid,0) <= 0 then
    update public.bill_sharing set status = 'finalized' where id = sharing_id_input;
    return;
  end if;

  -- Total amount of the selected expenses
  select coalesce(sum(amount),0) into total_expenses_in_sharing
  from public.bill_sharing_expenses
  where bill_sharing_id = sharing_id_input;

  if total_expenses_in_sharing <= 0 then
    update public.bill_sharing set status = 'finalized' where id = sharing_id_input;
    return;
  end if;

  -- Proportional reimbursement per expense (cap at expense.amount)
  update public.expenses e
  set amount_reimbursed = least(e.amount, coalesce(e.amount_reimbursed,0) + r.reimbursed)
  from (
    select bse.expense_id,
           (bse.amount / total_expenses_in_sharing) * total_direct_paid as reimbursed
    from public.bill_sharing_expenses bse
    where bse.bill_sharing_id = sharing_id_input
  ) r
  where e.id = r.expense_id;

  -- Update sharing_status on affected expenses
  update public.expenses
  set sharing_status = case
    when amount_reimbursed <= 0 then 'not_shared'
    when amount_reimbursed < amount then 'partially_reimbursed'
    else 'fully_reimbursed'
  end
  where id in (
    select expense_id from public.bill_sharing_expenses where bill_sharing_id = sharing_id_input
  );

  -- Mark sharing finalized
  update public.bill_sharing set status = 'finalized' where id = sharing_id_input;
end;
$$;

grant execute on function public.finalize_bill_sharing(uuid) to anon, authenticated;

-- Rollback and delete finalized/pending sharings safely
create or replace function public.delete_bill_sharing(sharing_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s_status text;
  total_direct_paid numeric(15,2);
  total_expenses_in_sharing numeric(15,2);
begin
  select status into s_status from public.bill_sharing where id = sharing_id_input;
  if not found then
    return;
  end if;

  if s_status = 'finalized' then
    -- recompute proportional reimbursements and subtract them
    select coalesce(sum(amount_owed),0) into total_direct_paid
    from public.bill_sharing_participants
    where bill_sharing_id = sharing_id_input
      and payment_method = 'direct'
      and payment_status = 'paid';

    select coalesce(sum(amount),0) into total_expenses_in_sharing
    from public.bill_sharing_expenses
    where bill_sharing_id = sharing_id_input;

    if coalesce(total_direct_paid,0) > 0 and total_expenses_in_sharing > 0 then
      update public.expenses e
      set amount_reimbursed = greatest(0, coalesce(e.amount_reimbursed,0) - r.reimbursed)
      from (
        select bse.expense_id,
               (bse.amount / total_expenses_in_sharing) * total_direct_paid as reimbursed
        from public.bill_sharing_expenses bse
        where bse.bill_sharing_id = sharing_id_input
      ) r
      where e.id = r.expense_id;

      update public.expenses
      set sharing_status = case
        when amount_reimbursed <= 0 then 'not_shared'
        when amount_reimbursed < amount then 'partially_reimbursed'
        else 'fully_reimbursed'
      end
      where id in (
        select expense_id from public.bill_sharing_expenses where bill_sharing_id = sharing_id_input
      );
    end if;
  end if;

  -- Remove children then parent
  delete from public.bill_sharing_participants where bill_sharing_id = sharing_id_input;
  delete from public.bill_sharing_expenses where bill_sharing_id = sharing_id_input;
  delete from public.bill_sharing where id = sharing_id_input;
end;
$$;

grant execute on function public.delete_bill_sharing(uuid) to anon, authenticated;

-- Optional: ask PostgREST to reload schema cache (safe to ignore failures)
do $$ begin
  begin
    perform pg_notify('pgrst', 'reload schema');
  exception when others then
    -- no-op
    null;
  end;
end $$;

