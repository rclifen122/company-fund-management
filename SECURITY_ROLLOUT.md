# Security rollout

The frontend now expects the guarded RPCs in
`migrations/V9__security_hardening.sql` and the integrity protections in
`migrations/V10__financial_integrity_hardening.sql`. Apply both database
migrations in order before deploying the new frontend.

## 1. Confirm the administrator

In the Supabase SQL editor, audit every existing profile and find the account
that should administer the app:

```sql
select id, email from auth.users order by created_at;

select p.id, p.email, p.role
from public.profiles p
order by p.email;
```

Remove any profile that should not have full access before applying
the migration. The current schema historically defaulted profiles to `admin`,
so do not assume existing rows are trusted merely because of their role value.

Ensure that account has an admin profile, replacing the example email:

```sql
insert into public.profiles (id, email, role)
select id, email, 'admin'
from auth.users
where email = 'your-admin@company.com'
on conflict (id) do update
set email = excluded.email,
    role = 'admin';
```

The migration intentionally aborts if no admin profile exists.

## 2. Apply the migration

Open `migrations/V9__security_hardening.sql`, review it, and run the complete
file in the Supabase SQL editor. It will:

- remove anonymous table and privileged-RPC access;
- replace permissive RLS policies with admin-only policies;
- make bill-sharing creation transactional and server-calculated;
- make finalization idempotent and concurrency-safe;
- store the exact reimbursement ledger used for rollback;
- prevent payment changes after finalization.

The policy section deliberately replaces all existing policies on the listed
application tables. Review it first if the live project has extra roles or
tenant-specific policies that are not represented in this repository.

## 3. Disable public registration

The `/signup` route has been removed. Also disable public sign-ups in Supabase:

**Authentication → Providers → Email → Allow new users to sign up: Off**

Create future administrators through the Supabase dashboard and add their
`profiles.role = 'admin'` row explicitly.

## 4. Check legacy finalized sharings

Old finalized sharings have no immutable `reimbursement_applied` ledger. The
new delete RPC refuses to delete those records instead of performing an unsafe
best-effort rollback. Reconcile those records manually before deletion.

## 5. Apply V10 after V9

Back up the database, then run the complete
`migrations/V10__financial_integrity_hardening.sql` file in the Supabase SQL
editor. V10 does not delete rows or recalculate existing monetary totals. It:

- secures `fund_summary` with the caller's RLS context;
- prevents one expense from being linked to multiple sharing records;
- replaces legacy cascading bill-sharing foreign keys with `ON DELETE RESTRICT`;
- blocks amount changes and deletion while an expense is linked;
- makes `fund_payments` the protected source of truth for `employees.total_paid`;
- validates new monetary values and covered-month keys;
- marks already-linked, unreimbursed expenses as `sharing_status = 'shared'`.

V10 intentionally aborts and rolls back the whole migration if an expense is
already linked to more than one sharing. Check this before running it:

```sql
select expense_id, count(*) as sharing_count
from public.bill_sharing_expenses
group by expense_id
having count(*) > 1;
```

An empty result is safe to proceed. If rows are returned, do not delete them
blindly; reconcile the duplicate sharing records and their reimbursement ledger
first.

After V10 succeeds, compare the cached employee totals with the payment ledger:

```sql
select
  e.id,
  e.name,
  e.total_paid as cached_total,
  coalesce(sum(fp.amount), 0) as ledger_total
from public.employees e
left join public.fund_payments fp on fp.employee_id = e.id
group by e.id, e.name, e.total_paid
having e.total_paid is distinct from coalesce(sum(fp.amount), 0)
order by e.name;
```

V10 does not automatically change mismatches because legacy installations may
have incomplete payment history. Review any returned rows manually.

## 6. Deploy and verify

After both SQL migrations succeed, deploy the frontend and verify:

1. Anonymous REST requests cannot select application tables or `fund_summary`.
2. A signed-in account without an admin profile cannot read or mutate data.
3. An admin can create a sharing, mark payments, finalize once, and delete it.
4. A finalized sharing does not allow participant payment changes.
5. An expense already linked to sharing cannot be selected, deleted, or have its amount changed.
6. A Supabase request failure shows an error instead of sample financial data.
