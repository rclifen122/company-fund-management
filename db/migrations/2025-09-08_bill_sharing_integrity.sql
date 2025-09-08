-- Bill Sharing integrity, relationships, and finalize workflow
-- Apply in Supabase SQL editor or via Supabase CLI

-- UUID helpers (either pgcrypto or uuid-ossp)
create extension if not exists pgcrypto;

-- Expenses: ensure reimbursement fields exist and net amount is generated
alter table if exists public.expenses
  add column if not exists amount_reimbursed numeric(15,2) not null default 0,
  add column if not exists sharing_status text not null default 'not_shared';

-- If supported, use generated column for net amount (otherwise create a view or trigger)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'expenses' and column_name = 'net_amount'
  ) then
    execute 'alter table public.expenses add column net_amount numeric(15,2) generated always as ((amount - coalesce(amount_reimbursed,0))) stored';
  end if;
exception when others then
  -- Fallback: if generated column is not supported (older PG), just add a normal column
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'expenses' and column_name = 'net_amount'
  ) then
    alter table public.expenses add column net_amount numeric(15,2);
    update public.expenses set net_amount = amount - coalesce(amount_reimbursed,0);
  end if;
end$$;

-- Bill sharing tables (create if missing)
create table if not exists public.bill_sharing (
  id uuid primary key,
  total_amount numeric(15,2) not null,
  sharing_date date not null,
  status text not null default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.bill_sharing_expenses (
  bill_sharing_id uuid not null references public.bill_sharing(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete restrict,
  amount numeric(15,2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.bill_sharing_participants (
  id uuid primary key,
  bill_sharing_id uuid not null references public.bill_sharing(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  amount_owed numeric(15,2) not null,
  is_birthday_person boolean default false,
  payment_method text check (payment_method in ('fund','direct')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid')),
  payment_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Defaults for ids if you prefer server-side UUIDs
do $$
begin
  if not exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='bill_sharing' and column_name='id' and column_default is not null
  ) then
    execute 'alter table public.bill_sharing alter column id set default gen_random_uuid()';
  end if;
  if not exists (
    select 1 from information_schema.columns where table_schema='public' and table_name='bill_sharing_participants' and column_name='id' and column_default is not null
  ) then
    execute 'alter table public.bill_sharing_participants alter column id set default gen_random_uuid()';
  end if;
end$$;

-- Uniqueness to prevent duplicates
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'uq_bill_sharing_expenses_pair'
  ) then
    alter table public.bill_sharing_expenses add constraint uq_bill_sharing_expenses_pair unique (bill_sharing_id, expense_id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'uq_bill_sharing_participants_pair'
  ) then
    alter table public.bill_sharing_participants add constraint uq_bill_sharing_participants_pair unique (bill_sharing_id, employee_id);
  end if;
end $$;

-- Helpful indexes
create index if not exists idx_bsp_sharing on public.bill_sharing_participants(bill_sharing_id);
create index if not exists idx_bse_sharing on public.bill_sharing_expenses(bill_sharing_id);
create index if not exists idx_bsp_employee on public.bill_sharing_participants(employee_id);

-- Finalize function: distribute direct payments to linked expenses (proportionally)
create or replace function public.finalize_bill_sharing(sharing_id_input uuid)
returns void
language plpgsql
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
           /* proportional share */
           (bse.amount / total_expenses_in_sharing) * total_direct_paid as reimbursed
    from public.bill_sharing_expenses bse
    where bse.bill_sharing_id = sharing_id_input
  ) r
  where e.id = r.expense_id;

  -- Optionally update sharing_status on expenses
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

-- Simple RLS policies (adjust to your auth). Assumes admin-only usage.
-- Enable RLS if not enabled
alter table public.bill_sharing enable row level security;
alter table public.bill_sharing_expenses enable row level security;
alter table public.bill_sharing_participants enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bill_sharing' and policyname='Allow all for admin') then
    create policy "Allow all for admin" on public.bill_sharing for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bill_sharing_expenses' and policyname='Allow all for admin') then
    create policy "Allow all for admin" on public.bill_sharing_expenses for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bill_sharing_participants' and policyname='Allow all for admin') then
    create policy "Allow all for admin" on public.bill_sharing_participants for all using (true) with check (true);
  end if;
end $$;

