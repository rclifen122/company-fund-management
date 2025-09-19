# Company Fund Management Web Application

A modern, responsive web application for managing company internal funds, built with React and Supabase. Designed specifically for Vietnamese businesses with complete Vietnamese UI and business logic.

![React](https://img.shields.io/badge/React-18+-blue)
![Vite](https://img.shields.io/badge/Vite-5+-purple)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3+-green)
![Supabase](https://img.shields.io/badge/Supabase-Backend-orange)

## What's New (2025-09-19)

- Bill Sharing: live breakdown before finalize (Fund Paid, Direct Collected, Direct Outstanding, progress bar), per-participant Fund/Direct badges, expense names (description - category - date) above totals with expand/collapse, Copy expenses to clipboard, Details modal, and toast notifications.
- Selection UX: filters (All/Fund/Direct) and bulk actions in "Select Participants" and "Select Birthday People" blocks to quickly select or mark shown users.
- Ops script: ready-to-run SQL to flip an employee to non-fund on the effective date: `db/sql/2025-10-01_mark_duong_anh_thu_non_fund.sql` (uses UUID; includes verification queries).

## 🚀 Features

### 📊 Dashboard
- **Real-time Financial Metrics**: Track total collections, expenses, current balance, and collection rates
- **12-Month Fund Flow Chart**: Visual representation of yearly financial data (T1-T12)
- **Employee Status Overview**: Monitor payment status (paid, pending, overdue)
- **Expense Category Analysis**: Pie chart breakdown of spending by category
- **Overdue Payment Alerts**: Automatic notifications for late payments

### 💰 Fund Collection Management
- **Multi-month Payment Support**: Employees can pay for multiple months at once
- **Payment History with Filtering**: Advanced filtering by month (T1-T12), payment method, employee
- **Payment Status Tracking**: Real-time status updates (paid/pending/overdue)
- **Multiple Payment Methods**: Support for cash, bank transfer, and e-wallet
- **Total Row Summary**: Automatic calculation of filtered payment totals

### 👥 Employee Management
- **Complete Employee Database**: Maintain detailed employee records
- **Department Organization**: Track employees by department
- **Contribution Monitoring**: Track individual and total contributions
- **Leave Date Support**: Handle employees who have left the company
- **Payment Status Dashboard**: Visual overview of all employee payment statuses

### 💸 Expense Management
- **Categorized Expense Tracking**: Events, gifts, office supplies, and other categories
- **Receipt Management**: Upload and store receipt images
- **Monthly Expense Reports**: Track spending patterns over time
- **Expense Filtering**: Filter by category, date, and amount

## 🛠️ Technology Stack

- **Frontend**: React 18+ with Vite
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with Lucide React icons
- **Charts**: Recharts library for data visualization
- **Backend**: Supabase (PostgreSQL database)
- **Authentication**: Supabase Auth
- **Deployment**: Docker & Docker Compose
- **Development**: ESLint, PostCSS

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 18 or higher)
- **npm** or **yarn**
- **Git**
- **Docker** (optional, for containerized deployment)
- **Supabase Account** (free tier available)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/rclifen122/company-fund-management.git
cd company-fund-management
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

```bash
# Copy the environment template
cp .env.example .env
```

Edit the `.env` file with your Supabase credentials:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
VITE_DEV_MODE=false
```

### 4. Database Setup

See the [Database Setup](#-database-setup) section below for detailed instructions.

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view the application.

## 🗄️ Database Setup

### Step 1: Create Supabase Project

1. Go to [Supabase](https://supabase.com)
2. Create a new account or sign in
3. Click "New Project"
4. Choose your organization and fill in project details
5. Wait for the project to be created (2-3 minutes)

### Step 2: Get Your Credentials

1. Go to **Settings** → **API**
2. Copy your **Project URL** and **anon public key**
3. Update your `.env` file with these values

### Step 3: Create Database Tables

Run the following SQL commands in the Supabase SQL Editor:

#### 3.1 Create Tables

```sql
-- Employees table
CREATE TABLE employees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  department TEXT,
  monthly_contribution_amount DECIMAL(15, 2) DEFAULT 100000,
  total_paid DECIMAL(15, 2) DEFAULT 0,
  join_date DATE NOT NULL,
  leave_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Fund payments table
CREATE TABLE fund_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  payment_date DATE NOT NULL,
  months_covered TEXT[] NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Expenses table
CREATE TABLE expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  amount DECIMAL(15, 2) NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('events', 'gifts', 'office_supplies', 'other')),
  description TEXT NOT NULL,
  expense_date DATE NOT NULL,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin')),
  company_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

#### 3.2 Create Indexes for Performance

```sql
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_fund_payments_employee_id ON fund_payments(employee_id);
CREATE INDEX idx_fund_payments_payment_date ON fund_payments(payment_date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_expense_date ON expenses(expense_date);
```

#### 3.3 Create Database Functions and Triggers

```sql
-- Function to update employee total_paid automatically
CREATE OR REPLACE FUNCTION update_employee_total_paid()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE employees 
        SET total_paid = total_paid + NEW.amount 
        WHERE id = NEW.employee_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE employees 
        SET total_paid = total_paid - OLD.amount 
        WHERE id = OLD.employee_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE employees 
        SET total_paid = total_paid - OLD.amount + NEW.amount 
        WHERE id = NEW.employee_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Trigger to automatically update total_paid
CREATE TRIGGER trigger_update_employee_total_paid
    AFTER INSERT OR UPDATE OR DELETE ON fund_payments
    FOR EACH ROW EXECUTE PROCEDURE update_employee_total_paid();

-- Fund summary view
CREATE VIEW fund_summary AS
SELECT 
  (SELECT COALESCE(SUM(total_paid), 0) FROM employees) AS total_collected,
  (SELECT COALESCE(SUM(amount), 0) FROM expenses) AS total_spent,
  (SELECT COALESCE(SUM(total_paid), 0) FROM employees) - 
  (SELECT COALESCE(SUM(amount), 0) FROM expenses) AS current_balance,
  (SELECT COUNT(*) FROM employees WHERE status = 'active') AS total_employees,
  NOW() AS last_updated;
```

#### 3.4 Set Up Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies (admin-only access)
CREATE POLICY "Admin can view all employees" ON employees FOR ALL USING (true);
CREATE POLICY "Admin can view all payments" ON fund_payments FOR ALL USING (true);
CREATE POLICY "Admin can view all expenses" ON expenses FOR ALL USING (true);
CREATE POLICY "Admin can view profile" ON profiles FOR ALL USING (auth.uid() = id);
```

## Bill Sharing Workflow

The Bill Sharing feature lets you split selected expenses among employees, collect money from non‑fund participants, and reimburse the original expenses proportionally.

- Create Sharing
  - Select one or more expenses and the participating employees.
  - Birthday logic: supports single or multiple birthday people (birthday people do not pay for themselves; see CONTEXT_MEMORY for details).
  - Fund vs Direct: employees who participate in the fund are treated as “auto paid from fund” and are not tracked as participants. Only direct payers are saved as `bill_sharing_participants` with `payment_method = 'direct'`.

- Collect Payments
  - Mark each direct participant as Paid once they pay.
  - When all direct payers are paid, the app automatically finalizes the sharing.

- Finalize & Reimburse
  - Finalization runs the `finalize_bill_sharing(sharing_id_input)` function.
  - It sums all Paid direct contributions and distributes that amount proportionally across the linked expenses, updating `expenses.amount_reimbursed` and `expenses.sharing_status`.
  - The dashboard, monthly chart, and category breakdown all use the expense `net_amount` (amount − amount_reimbursed), so reimbursements effectively flow back to the fund.

- Delete Sharing
  - Pending sharings can be deleted directly (participants + links are removed).
  - Finalized sharings can be deleted via rollback: the app calls `delete_bill_sharing(sharing_id_input)` which subtracts the previously applied reimbursements from linked expenses and then deletes the sharing and its children.

- Schema Notes
  - Tables: `bill_sharing`, `bill_sharing_expenses`, `bill_sharing_participants` with foreign keys and unique constraints.
  - RPCs:
    - `finalize_bill_sharing(sharing_id_input uuid)` applies reimbursements and sets sharing to `finalized`.
    - `delete_bill_sharing(sharing_id_input uuid)` rolls back reimbursements (if finalized) and deletes the sharing and its links.
- Migrations:
    - `db/migrations/2025-09-08_bill_sharing_integrity.sql`
    - `db/migrations/2025-09-08b_bill_sharing_rollback_and_security.sql`

### Bill Sharing UI Enhancements (Sept 2025)
- Sharing cards show Fund Paid, Direct Collected, Direct Outstanding, and a progress bar before finalize.
- Expense names (description - category - date) appear above totals; expand to view all.
- Copy expenses to clipboard; Details modal with linked expenses table and fund/direct metrics.
- Toast notifications for create, delete, finalize, mark Paid/Pending, and copy.
- Selection filters (All/Fund/Direct) and bulk actions in participant and birthday selection lists.

### Permissions
- The finalize/delete RPCs are defined as `SECURITY DEFINER` and grant `EXECUTE` to app roles so they can update `expenses` under RLS.
- A permissive RLS policy on `public.expenses` is included in the migration for admin usage. Tighten to your auth model as needed.

#### 3.5 Insert Sample Data (Optional)

```sql
-- Sample employees
INSERT INTO employees (name, email, phone, department, join_date) VALUES
('Nguyễn Văn A', 'vana@company.com', '0901234567', 'IT', '2024-01-01'),
('Trần Thị B', 'thib@company.com', '0901234568', 'HR', '2024-01-15'),
('Lê Văn C', 'vanc@company.com', '0901234569', 'Finance', '2024-02-01');

-- Sample payments
INSERT INTO fund_payments (employee_id, amount, payment_date, months_covered) VALUES
((SELECT id FROM employees WHERE name = 'Nguyễn Văn A'), 300000, '2024-01-01', ARRAY['2024-01', '2024-02', '2024-03']),
((SELECT id FROM employees WHERE name = 'Trần Thị B'), 100000, '2024-01-15', ARRAY['2024-01']);

-- Sample expenses
INSERT INTO expenses (amount, category, description, expense_date) VALUES
(500000, 'events', 'Company New Year Party', '2024-01-20'),
(150000, 'gifts', 'Employee Birthday Gifts', '2024-01-25'),
(75000, 'office_supplies', 'Office Cleaning Supplies', '2024-01-30');
```

## 🐳 Docker Deployment

### Prerequisites
- Docker and Docker Compose installed

### Quick Deploy

1. **Build and run with Docker Compose**:
```bash
docker-compose up --build -d
```

2. **Access the application**:
   - Open [http://localhost:8080](http://localhost:8080)

### Custom Configuration

Edit `docker-compose.yml` to customize:
- Port mapping (default: 8080)
- Environment variables
- Volume mounts

## 📦 Build for Production

```bash
# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

The built files will be in the `dist/` directory.

## 🏗️ Project Structure

```
company-fund-management/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable React components
│   │   ├── EmployeeModal.jsx
│   │   ├── ExpenseModal.jsx
│   │   ├── Layout.jsx
│   │   ├── PaymentModal.jsx
│   │   ├── ProtectedRoute.jsx
│   │   └── StatCard.jsx
│   ├── pages/             # Page components
│   │   ├── HomePage.jsx   # Dashboard with charts
│   │   ├── FundCollectionPage.jsx
│   │   ├── EmployeesPage.jsx
│   │   ├── ExpensesPage.jsx
│   │   └── ...
│   ├── App.jsx            # Main app component
│   ├── main.jsx           # Application entry point
│   └── supabase.js        # Supabase configuration
├── .env.example           # Environment template
├── package.json           # Dependencies and scripts
├── tailwind.config.js     # Tailwind CSS configuration
├── vite.config.js         # Vite configuration
└── README.md              # This file
```

## 📱 Usage Guide

### Dashboard
- View real-time financial metrics
- Monitor 12-month fund flow chart (T1-T12)
- Check employee payment status overview
- Review expense category breakdowns

### Fund Collection
- Record new employee payments
- Filter payment history by month (T1-T12)
- View payment totals and summaries
- Track multi-month payments

### Employee Management
- Add/edit employee information
- Monitor payment status
- Track department organization
- Handle employee departures

### Expense Management
- Record fund expenditures
- Categorize expenses
- Upload receipt images
- Generate expense reports

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | - | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | - | ✅ |
| `VITE_DEV_MODE` | Enable development mode | `false` | ❌ |

### Development Mode

Set `VITE_DEV_MODE=true` to use mock data instead of Supabase (useful for UI development).

## 🚨 Troubleshooting

### Common Issues

1. **Build fails with dependency errors**
   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Database connection issues**
   - Verify your Supabase URL and anon key
   - Check if your Supabase project is active
   - Ensure RLS policies are set correctly

3. **Charts not displaying**
   - Check browser console for JavaScript errors
   - Verify Recharts is installed: `npm list recharts`

4. **Authentication problems**
   - Verify Supabase auth configuration
   - Check if email confirmation is required
   - Ensure auth policies are set up

5. **Docker deployment issues**
   ```bash
   # Check container logs
   docker-compose logs financial-webapp
   
   # Rebuild containers
   docker-compose down
   docker-compose up --build
   ```

### Performance Optimization

- **Database indexes**: Ensure all recommended indexes are created
- **Query optimization**: Use appropriate filtering in large datasets
- **Caching**: Consider implementing browser caching for static assets

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow React best practices
- Use Tailwind CSS for styling
- Maintain Vietnamese language consistency
- Add proper error handling
- Write descriptive commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

1. **Issues**: Open an issue on GitHub
2. **Documentation**: Check this README and code comments
3. **Community**: Join discussions in GitHub Discussions

## 🔮 Roadmap

- [ ] Export data to Excel/CSV
- [ ] Email notifications for overdue payments
- [ ] Multi-company support
- [ ] Advanced reporting dashboard
- [ ] Mobile app companion
- [ ] Integration with Vietnamese banking APIs
- [ ] Automated backup system

---

**Built with ❤️ for Vietnamese businesses**

Made by **rclifen122** | [GitHub](https://github.com/rclifen122)
