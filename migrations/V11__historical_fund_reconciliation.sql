begin;

-- Status-only ledger for fund payments collected before this application was
-- adopted. Rows in this table never participate in fund balance calculations.
create table if not exists public.fund_payment_reconciliations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  month_key text not null,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint fund_payment_reconciliations_month_key_check
    check (month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint fund_payment_reconciliations_employee_month_unique
    unique (employee_id, month_key)
);

create index if not exists idx_fund_payment_reconciliations_month
  on public.fund_payment_reconciliations (month_key, employee_id);

alter table public.fund_payment_reconciliations enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fund_payment_reconciliations'
  ) then
    alter publication supabase_realtime
      add table public.fund_payment_reconciliations;
  end if;
end;
$$;

drop policy if exists fund_payment_reconciliations_admin_all
  on public.fund_payment_reconciliations;
create policy fund_payment_reconciliations_admin_all
  on public.fund_payment_reconciliations
  for all
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

revoke all on table public.fund_payment_reconciliations from public, anon, authenticated;
grant select, insert, update, delete
  on table public.fund_payment_reconciliations to authenticated;

commit;
