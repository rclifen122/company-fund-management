-- Strengthen policies, make finalize security definer, and add rollback+delete helper

-- RLS policy to allow app updates on expenses (adjust per your auth model)
alter table if exists public.expenses enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='expenses' and policyname='Allow all for admin on expenses'
  ) then
    create policy "Allow all for admin on expenses" on public.expenses for all using (true) with check (true);
  end if;
end $$;

-- Recreate finalize function with security definer
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
  select coalesce(sum(amount_owed),0) into total_direct_paid
  from public.bill_sharing_participants
  where bill_sharing_id = sharing_id_input
    and payment_method = 'direct'
    and payment_status = 'paid';

  if coalesce(total_direct_paid,0) <= 0 then
    update public.bill_sharing set status = 'finalized' where id = sharing_id_input;
    return;
  end if;

  select coalesce(sum(amount),0) into total_expenses_in_sharing
  from public.bill_sharing_expenses
  where bill_sharing_id = sharing_id_input;

  if total_expenses_in_sharing <= 0 then
    update public.bill_sharing set status = 'finalized' where id = sharing_id_input;
    return;
  end if;

  update public.expenses e
  set amount_reimbursed = least(e.amount, coalesce(e.amount_reimbursed,0) + r.reimbursed)
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

  update public.bill_sharing set status = 'finalized' where id = sharing_id_input;
end;
$$;

grant execute on function public.finalize_bill_sharing(uuid) to anon, authenticated;

-- Rollback and delete finalized/pending sharings safely in one transaction
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

