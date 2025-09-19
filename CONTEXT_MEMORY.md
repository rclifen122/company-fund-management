# Project Context Memory

Snapshot of repository structure, tech stack, runtime behavior, and data model to accelerate future work. Keep updated as changes land.

## Current Status (2025-09-19)
- Dashboard metrics incorrect / dashboard not updating.
  - Root cause identified: `HomePage.jsx` logs `correctedCurrentBalance` before it is defined, which can cause a runtime ReferenceError and push the dashboard into error fallback (mock data). Fix: compute `correctedCurrentBalance` before using it in logs or move the log after the variable is declared.
  - Secondary cause: reimbursements not applied because bill sharing finalize/delete RPCs were not available, so `expenses.amount_reimbursed` and `net_amount` never update, leading to stale totals.
- Bill Sharing create/delete “does nothing”.
  - Cause: missing/uncached RPCs in Supabase (PostgREST schema cache) for `public.delete_bill_sharing(sharing_id_input uuid)` and finalize.
  - Action: added `db/sql/repair_bill_sharing_rpcs.sql` which recreates both RPCs with SECURITY DEFINER, grants `EXECUTE` to `anon, authenticated`, and adds a permissive expenses policy. After running, reset API cache in Supabase Settings → API.
  - Pending deletion uses direct table deletes (no RPC); if nothing happens, ensure RLS policies exist on `bill_sharing*` tables per migrations and that the migrations were applied.
- Environment check: ensure not in demo/dev mode if expecting real data (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set, and `VITE_DEV_MODE` is not `true`).

### Bill Sharing UI Enhancements (2025-09-19)
- Sharing History cards show live breakdown before finalize:
  - Fund Paid, Direct Collected, Direct Outstanding, and a progress bar.
  - Per-participant badges (Fund/Direct) and statuses (Paid/Pending).
- Expense names above total with category and date; expandable list (Show all / Hide).
- Quick actions: Copy expenses to clipboard; View details modal with linked expenses table and fund/direct metrics.
- Toast notifications for create, delete, finalize, mark Paid/Pending, and copy actions.

## Purpose
- Company internal fund management web app with Vietnamese UI and business logic.
- Tracks employee contributions, expenses, dashboards, and bill-sharing flows.
- Includes a reimbursement workflow to track non-fund member contributions to expenses.

## Tech Stack
- Frontend: React 18 + Vite, React Router, Tailwind CSS, lucide-react icons, Recharts.
- Backend: Supabase (PostgreSQL) via `@supabase/supabase-js`.
- Tooling: ESLint (flat config), PostCSS, Tailwind, Vite.

## Scripts (package.json)
- `dev`: Vite dev server.
- `build`: Vite build.
- `preview`: Vite preview.
- `lint`: ESLint.

## Reimbursement Workflow
1.  An `expense` is paid out from the central company fund.
2.  A `bill_sharing` event is created to associate one or more expenses with selected employees.
3.  Participants are split into:
    - Fund participants → auto-paid from fund (not saved as participants).
    - Direct participants → saved in `bill_sharing_participants` with `payment_method = 'direct'`.
4.  Direct participants are marked Paid as they contribute.
5.  When all direct participants are Paid, the sharing auto-finalizes (or can be manually finalized).
6.  Finalization runs `finalize_bill_sharing`, which proportionally updates `expenses.amount_reimbursed` for linked expenses and sets `sharing_status`.
7.  The UI and dashboard rely on `expenses.net_amount` (amount − amount_reimbursed), so reimbursements reduce net spend and flow back to the fund balance.

## Pages - Key Behaviors
- **Fund Collection (`FundCollectionPage.jsx`)**
  - Lists payments and calculates totals for **fund-participating employees only**.
- **Expenses (`ExpensesPage.jsx`)**
  - Displays all expenses with columns for **Total Amount**, **Amount Reimbursed**, and **Net Cost (net_amount)**.
  - Shows the `sharing_status` of an expense (e.g., `Not Shared`, `Partially Reimbursed`).
- **Bill Sharing (`BillSharingPage.jsx`)**
  - Allows selection of multiple birthday people with updated calculation logic.
  - Only direct payers are persisted as participants; fund payers are auto-paid.
  - Auto-finalizes when all direct payers are Paid (or manual finalize), applying reimbursements to expenses.
  - Deletion:
    - Pending sharings delete participants + links + sharing.
    - Finalized sharings call `delete_bill_sharing` to rollback reimbursements then delete rows.
  - UX Enhancements:
    - Sharing cards: live Fund/Direct totals, outstanding, progress; copy; details modal; expandable expense list.
    - Selection lists: Fund/Direct filters and bulk actions (select/clear shown; mark/unmark shown birthdays).
    - Toasts for user feedback.

## Data Model (Supabase/Postgres)
- **Employees (`employees`)**
  - `participates_in_fund` (boolean): Controls if an employee is part of the fund. Used to filter views in Fund Collection.
- **Non-Fund Members (`non_fund_members`)**
  - New table to explicitly manage employees not in the fund.
  - Synced with `employees.participates_in_fund` via database triggers.
- **Expenses (`expenses`)**
  - `amount_reimbursed` (numeric): Total reimbursed for this expense from direct payers in bill sharing.
  - `net_amount` (generated or computed): `amount - coalesce(amount_reimbursed, 0)`; used across dashboard and charts.
  - `sharing_status` (text): `not_shared` | `partially_reimbursed` | `fully_reimbursed`.
- **Bill Sharing (`bill_sharing`)**
  - `status` (text): Used in the finalization workflow (e.g., `pending`, `finalized`).

- **Database Functions**
  - `finalize_bill_sharing(sharing_id)`: SECURITY DEFINER. Sums Paid direct contributions, distributes proportionally to linked expenses, updates `amount_reimbursed` and `sharing_status`, then marks sharing `finalized`.
  - `delete_bill_sharing(sharing_id)`: SECURITY DEFINER. If finalized, subtracts proportional reimbursements, updates `sharing_status`, then deletes participants, links, and sharing.

## Ops Notes
- Non-fund switch script for DƯƠNG ANH THƯ (run on effective date):
  - Path: `db/sql/2025-10-01_mark_duong_anh_thu_non_fund.sql`
  - Uses her UUID to upsert into `non_fund_members` and set `employees.participates_in_fund=false`.
  - Includes verification SELECTs; adjust date/ID to reuse for other employees.

## Calculations - Notable Rules
- **Bill Sharing (Multi-Birthday Logic)**:
  - If `N` people participate and `B` people have a birthday:
  - A non-birthday person pays: `Total Cost / (N - 1)`.
  - A birthday person pays: `(Total Cost / (N - 1)) * (B - 1) / B`.
  - This handles all cases, including 0 or 1 birthday person.

---
## Integrity & Constraints
- Unique pairs prevent duplicates: `(bill_sharing_id, expense_id)` and `(bill_sharing_id, employee_id)`.
- FKs ensure valid relationships and cascade delete of linked rows.
- Finalized sharings are not deletable in the UI to preserve accounting history.

---
*This is a living document. Last updated: 2025-09-19 — Bill Sharing UI enhancements, toast feedback, filters/bulk actions, and non-fund ops script path.*
