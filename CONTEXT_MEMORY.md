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
2.  A `bill_sharing` event is created to associate this expense with participants.
3.  Non-fund members pay their share directly (`direct` payments).
4.  A user clicks the **Finalize** button on the `bill_sharing` event in the UI.
5.  This triggers the `finalize_bill_sharing` database function, which calculates the total amount reimbursed from direct payers.
6.  The function then proportionally distributes and updates the `amount_reimbursed` field on the original, linked `expense` records.
7.  The `ExpensesPage` UI is updated to show the original amount, the amount reimbursed, and the final net cost, providing a clear view of the fund's actual expenditure.

## Pages - Key Behaviors
- **Fund Collection (`FundCollectionPage.jsx`)**
  - Lists payments and calculates totals for **fund-participating employees only**.
- **Expenses (`ExpensesPage.jsx`)**
  - Displays all expenses with columns for **Total Amount**, **Amount Reimbursed**, and **Net Cost**.
  - Shows the `sharing_status` of an expense (e.g., `Not Shared`, `Partially Reimbursed`).
- **Bill Sharing (`BillSharingPage.jsx`)**
  - Allows selection of multiple birthday people with updated calculation logic.
  - Users can **Finalize** a sharing event, which triggers the reimbursement workflow.

## Data Model (Supabase/Postgres)
- **Employees (`employees`)**
  - `participates_in_fund` (boolean): Controls if an employee is part of the fund. Used to filter views in Fund Collection.
- **Non-Fund Members (`non_fund_members`)**
  - New table to explicitly manage employees not in the fund.
  - Synced with `employees.participates_in_fund` via database triggers.
- **Expenses (`expenses`)**
  - `amount_reimbursed` (decimal): Stores the total amount reimbursed for this expense from bill sharing. Defaults to 0.
  - `net_amount` (generated decimal): Automatically calculated as `amount - amount_reimbursed`.
  - `sharing_status` (text): Tracks the reimbursement status (e.g., `not_shared`, `partially_reimbursed`, `fully_reimbursed`).
- **Bill Sharing (`bill_sharing`)**
  - `status` (text): Used in the finalization workflow (e.g., `pending`, `finalized`).

- **Database Functions**
  - `finalize_bill_sharing(sharing_id)`: A key function that calculates reimbursements from a sharing event and applies them proportionally to the original expenses. It updates the `amount_reimbursed` and `sharing_status` on the `expenses` table and sets the `bill_sharing` status to `finalized`.

## Calculations - Notable Rules
- **Bill Sharing (Multi-Birthday Logic)**:
  - If `N` people participate and `B` people have a birthday:
  - A non-birthday person pays: `Total Cost / (N - 1)`.
  - A birthday person pays: `(Total Cost / (N - 1)) * (B - 1) / B`.
  - This handles all cases, including 0 or 1 birthday person.

---
*This is a living document. Last updated to reflect the reimbursement and finalization features.*