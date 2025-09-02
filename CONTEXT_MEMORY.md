# Project Context Memory

Snapshot of repository structure, tech stack, runtime behavior, and data model to accelerate future work. Keep updated as changes land.

## Purpose
- Company internal fund management web app with Vietnamese UI and business logic.
- Tracks employee contributions, expenses, dashboards, and bill-sharing flows.

## Tech Stack
- Frontend: React 18 + Vite, React Router, Tailwind CSS, lucide-react icons, Recharts.
- Backend: Supabase (PostgreSQL) via `@supabase/supabase-js`.
- Tooling: ESLint (flat config), PostCSS, Tailwind, Vite.

## Scripts (package.json)
- `dev`: Vite dev server.
- `build`: Vite build.
- `preview`: Vite preview.
- `lint`: ESLint.

## Environment
- `.env` keys:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_DEV_MODE` (when `true`, pages use mock data)
- Local dev: `.env` present with placeholders and `VITE_DEV_MODE=true`.
- Supabase client (`src/supabase.js`): `persistSession: false`.

## Repo Structure (high-level)
- `src/`
  - `main.jsx`, `App.jsx` (routes + entry)
  - `supabase.js` (client init)
  - `components/` (Layout, ProtectedRoute, StatCard, EmployeeModal, PaymentModal, ExpenseModal)
  - `pages/` (Home, Employees, Fund Collection, Expenses, Settings, Bill Sharing, Auth)
- `migrations/` (SQL for bill sharing + schema changes)
- `public/` (static assets)
- Root configs: `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `eslint.config.js`

## Routing
- Public: `/login`, `/signup`, `/forgot-password`, `/update-password`.
- Protected: `/`, `/employees`, `/fund-collection`, `/expenses`, `/settings`, `/bill-sharing`.
- Note: `ProtectedRoute` currently bypasses auth (intended for internal/demo use).

## Pages - Key Behaviors
- Home (`HomePage.jsx`)
  - Dashboard metrics, 12-month chart, expenses pie, recent activities.
  - Dev-mode mock data; otherwise aggregates from Supabase with careful total logic (avoid double counting; includes employees who left).
- Fund Collection (`FundCollectionPage.jsx`)
  - Lists payments, filters, status badges; add payments via `PaymentModal`.
  - Computes total using: for leavers use `employees.total_paid`; for active, sum `fund_payments` (avoid double count).
  - Realtime: subscribes to `employees` and `fund_payments` changes and refreshes state (no hard reloads).
- Employees (`EmployeesPage.jsx`)
  - List, search, filters; CRUD via `EmployeeModal` (demo-mode inserts are mocked).
  - Derives current-month status from payments and dates.
  - Realtime: subscribes to `employees` and `fund_payments`; updates list without hard reloads.
- Expenses (`ExpensesPage.jsx`)
  - List, search, filters, sorting; CRUD via `ExpenseModal` (demo-mode mocked).
  - Total/current-month/category breakdowns; also computes fund total similar to other pages.
- Bill Sharing (`BillSharingPage.jsx`)
  - Select expenses/employees/birthday people; compute fund vs direct payments.
  - Participants list supports filters: All / Fund / Direct / Active; employees loaded from DB, sorted by name, using `participates_in_fund`.
  - Realtime: subscribes to `employees` and `expenses` to refresh lists live.
  - Persists sharing and participant records to Supabase when configured.
- Auth pages (`LoginPage.jsx`, `SignUpPage.jsx`, `ForgotPasswordPage.jsx`, `UpdatePasswordPage.jsx`)
  - Login simulates success in dev-mode; otherwise uses Supabase Auth flows.

## Components
- `Layout.jsx`: Responsive sidebar + header; navigation and sign-out.
- `ProtectedRoute.jsx`: Pass-through wrapper (no auth enforcement currently).
- `StatCard.jsx`: Simple KPI card.
- `EmployeeModal.jsx` / `ExpenseModal.jsx` / `PaymentModal.jsx`: Validated forms; date/amount helpers; Vietnamese labels.

## Data Model (Supabase/Postgres)
- Employees `employees`
  - Fields: `id`, `name`, `email`, `phone`, `department`, `monthly_contribution_amount`, `total_paid`, `join_date`, `leave_date`, `status`, timestamps.
  - Added: `participates_in_fund BOOLEAN DEFAULT TRUE` (via migration).
- Fund Payments `fund_payments`
  - Fields: `id`, `employee_id` (FK), `amount`, `payment_date`, `months_covered TEXT[]`, `payment_method`, `notes`, `recorded_by`, timestamps.
- Expenses `expenses`
  - Fields: `id`, `amount`, `category`, `description`, `expense_date`, `receipt_url`, `notes`, `created_by`, timestamps.
- Profiles `profiles`
  - Fields: `id` (FK to `auth.users`), `email`, `full_name`, `role`, `company_name`, `phone`, timestamps.
- Views/Functions/Triggers (per README)
  - Trigger `update_employee_total_paid` on `fund_payments` to adjust `employees.total_paid` on insert/update/delete.
  - View `fund_summary` provides `total_collected`, `total_spent`, `current_balance`, `total_employees`.
  - Indexes on common query fields.
- Bill Sharing (migration `V2__create_bill_sharing_tables.sql`)
  - `bill_sharing`: `id`, `total_amount`, `sharing_date`, `status`, `created_at`.
  - `bill_sharing_expenses`: composite PK, links expenses to sharings with `amount`.
  - `bill_sharing_participants`: `id`, `bill_sharing_id`, `employee_id`, `amount_owed`, `is_birthday_person`, `payment_method` ('fund'|'direct'), `payment_status` ('pending'|'paid'), `payment_date`.

## Realtime
- Migration `V3__enable_realtime.sql` adds tables to `supabase_realtime` publication:
  - `employees`, `fund_payments`, `expenses`, `bill_sharing`, `bill_sharing_expenses`, `bill_sharing_participants`.
- `REPLICA IDENTITY FULL` set on these tables so UPDATE/DELETE events include `old` rows.
- Frontend subscriptions:
  - Employees: `employees` + `fund_payments`.
  - Fund Collection: `employees` + `fund_payments`.
  - Expenses: `expenses` (pre-existing).
  - Bill Sharing: `employees` + `expenses`.

## Calculations - Notable Rules
- Avoid double counting:
  - Employees who left: trust `employees.total_paid`.
  - Active employees: sum `fund_payments` (excluding leaver IDs).
- Monthly status:
  - If current month in `months_covered` -> `paid`.
  - Else if last payment >45 days ago -> `overdue`; else `pending`.
  - Employees with `leave_date` considered `completed` in dashboard context.

## Configuration Notes
- Vite alias ensures `react-router-dom` resolves consistently.
- Tailwind content globs include `index.html` and all files under `src`.
- Styling baseline in `src/index.css`; extra `.currency-vnd` utility.
 - Vercel: `vercel.json` rewrites `/(.*)` -> `/` to prevent deep-route reload errors.

## Known Issues / Observations
- Vietnamese diacritics appear mojibake in several JSX/MD files (likely encoding mismatch). Consider normalizing to UTF-8.
- `ProtectedRoute` skips auth; enable real checks when moving beyond internal/demo use.
- `persistSession: false` means auth state is ephemeral; adjust for production.

## Data Seeds / Lists
- `full_employees_list.csv`: Names + note column (not directly wired in UI yet).

## Current Local Setup
- `.env` present with placeholder Supabase URL and key; `VITE_DEV_MODE=true` so mock data paths are active.

## Quick Tasks Backlog (suggested)
- Fix encoding of Vietnamese strings across repo.
- Toggle `ProtectedRoute` to enforce auth when Supabase is configured.
- Implement production session persistence.
- Wire file uploads for receipts to Supabase storage.
- Add unit/integration tests around fund and bill-sharing calculations.
- Ensure RLS policies align with admin-only usage patterns.

---
Last updated: commit time of this file.

