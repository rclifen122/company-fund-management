# Project Context Memory

Snapshot of repository structure, tech stack, runtime behavior, and data model to accelerate future work. Keep updated as changes land.

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
  - Pending sharings can be deleted; finalized sharings are protected from deletion.

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
  - `finalize_bill_sharing(sharing_id)`: Sums Paid direct contributions, distributes proportionally to linked expenses, updates `amount_reimbursed` and `sharing_status`, then marks sharing `finalized`.

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
*This is a living document. Last updated: direct-only participants, auto-finalize, delete rules, and net expense usage.*
