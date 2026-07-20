begin;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id uuid,
  actor_email text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at
  on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_table_record
  on public.audit_logs (table_name, record_id);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read
  on public.audit_logs
  for select
  to authenticated
  using (public.is_app_admin());

revoke all on table public.audit_logs from public, anon, authenticated;
grant select on table public.audit_logs to authenticated;

create or replace function public.capture_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
  row_id text;
  claims jsonb;
begin
  old_row := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_row := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  row_id := coalesce(new_row ->> 'id', old_row ->> 'id', new_row ->> 'employee_id', old_row ->> 'employee_id');
  claims := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);

  insert into public.audit_logs (
    table_name,
    record_id,
    action,
    actor_id,
    actor_email,
    old_data,
    new_data
  ) values (
    tg_table_name,
    row_id,
    tg_op,
    auth.uid(),
    claims ->> 'email',
    old_row,
    new_row
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.capture_audit_log() from public, anon, authenticated;

do $$
declare
  audited_table text;
begin
  foreach audited_table in array array[
    'employees',
    'fund_payments',
    'fund_payment_reconciliations',
    'expenses',
    'bill_sharing',
    'bill_sharing_expenses',
    'bill_sharing_participants'
  ]
  loop
    if to_regclass(format('public.%I', audited_table)) is not null then
      execute format('drop trigger if exists capture_audit_log_trigger on public.%I', audited_table);
      execute format(
        'create trigger capture_audit_log_trigger after insert or update or delete on public.%I for each row execute function public.capture_audit_log()',
        audited_table
      );
    end if;
  end loop;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'audit_logs'
  ) then
    alter publication supabase_realtime add table public.audit_logs;
  end if;
end;
$$;

commit;
