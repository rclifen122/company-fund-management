import { AlertTriangle, CheckCircle, Clock, History, Minus } from 'lucide-react';
import { formatVND } from '../utils/format';
import {
  EMPLOYEE_MEMBERSHIP,
  getEmployeeMembershipMode,
  isActiveFundMember,
} from '../utils/employeeMembership';

const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  number: index + 1,
  label: `T${index + 1}`,
}));

const getDateMonthKey = (value) => {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : null;
};

const getCoveredMonths = (payments, reconciliations) => {
  const coveredByEmployee = new Map();
  const reconciledByEmployee = new Map();

  payments.forEach((payment) => {
    const employeeId = String(payment.employee_id);
    if (!coveredByEmployee.has(employeeId)) {
      coveredByEmployee.set(employeeId, new Set());
    }

    const coveredMonths = Array.isArray(payment.months_covered) && payment.months_covered.length > 0
      ? payment.months_covered
      : [getDateMonthKey(payment.payment_date)].filter(Boolean);

    coveredMonths.forEach((monthKey) => {
      if (/^\d{4}-\d{2}$/.test(monthKey)) {
        coveredByEmployee.get(employeeId).add(monthKey);
      }
    });
  });

  reconciliations.forEach((reconciliation) => {
    const employeeId = String(reconciliation.employee_id);
    if (!coveredByEmployee.has(employeeId)) {
      coveredByEmployee.set(employeeId, new Set());
    }
    if (!reconciledByEmployee.has(employeeId)) {
      reconciledByEmployee.set(employeeId, new Set());
    }

    if (/^\d{4}-\d{2}$/.test(reconciliation.month_key)) {
      coveredByEmployee.get(employeeId).add(reconciliation.month_key);
      reconciledByEmployee.get(employeeId).add(reconciliation.month_key);
    }
  });

  return { coveredByEmployee, reconciledByEmployee };
};

const getMonthStatus = (employee, monthKey, coveredMonths, reconciledMonths, currentMonthKey) => {
  if (reconciledMonths.has(monthKey)) return 'reconciled';
  if (coveredMonths.has(monthKey)) return 'paid';

  const joinMonthKey = getDateMonthKey(employee.join_date);
  const leaveMonthKey = getDateMonthKey(employee.leave_date);

  if (joinMonthKey && monthKey < joinMonthKey) return 'not_applicable';
  if (leaveMonthKey && monthKey > leaveMonthKey) return 'not_applicable';

  if (!isActiveFundMember(employee) && !leaveMonthKey) return 'not_applicable';
  if (monthKey > currentMonthKey) return 'upcoming';
  if (monthKey === currentMonthKey) return 'pending';
  return 'overdue';
};

const STATUS_STYLES = {
  paid: {
    label: 'Đã nộp',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Icon: CheckCircle,
  },
  reconciled: {
    label: 'Đã nộp (đối soát lịch sử)',
    className: 'bg-teal-50 text-teal-700 border-teal-300',
    Icon: History,
  },
  pending: {
    label: 'Chờ nộp',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    Icon: Clock,
  },
  overdue: {
    label: 'Quá hạn',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
    Icon: AlertTriangle,
  },
  upcoming: {
    label: 'Chưa đến kỳ',
    className: 'bg-slate-50 text-slate-400 border-slate-200',
    Icon: Minus,
  },
  not_applicable: {
    label: 'Không tham gia',
    className: 'bg-gray-50 text-gray-300 border-gray-200',
    Icon: Minus,
  },
};

const MonthStatusCell = ({ status }) => {
  const { label, className, Icon } = STATUS_STYLES[status];

  return (
    <td className="border border-gray-200 p-1.5 text-center">
      <div
        title={label}
        aria-label={label}
        className={`mx-auto flex h-8 w-8 items-center justify-center rounded-md border ${className}`}
      >
        <Icon className="h-4 w-4" />
      </div>
    </td>
  );
};

const EmployeeRows = ({ employees, year, coveredByEmployee, reconciledByEmployee, currentMonthKey }) => {
  if (employees.length === 0) {
    return (
      <tr>
        <td colSpan="14" className="border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          Không có nhân viên phù hợp.
        </td>
      </tr>
    );
  }

  return employees.map((employee) => {
    const coveredMonths = coveredByEmployee.get(String(employee.id)) || new Set();
    const reconciledMonths = reconciledByEmployee.get(String(employee.id)) || new Set();
    const membershipMode = getEmployeeMembershipMode(employee);
    const paidMonthsInYear = MONTHS.filter(({ number }) => (
      coveredMonths.has(`${year}-${String(number).padStart(2, '0')}`)
    )).length;

    return (
      <tr key={employee.id} className="hover:bg-indigo-50/30">
        <td className="sticky left-0 z-10 min-w-56 border border-gray-200 bg-white px-4 py-3 shadow-[1px_0_0_0_#e5e7eb]">
          <div className="font-medium text-gray-900">{employee.name}</div>
          <div className="mt-0.5 text-xs text-gray-500">
            {employee.department || 'Chưa có phòng ban'} · {
              membershipMode === EMPLOYEE_MEMBERSHIP.DIRECT
                ? 'Thu trực tiếp trên từng khoản chi'
                : membershipMode === EMPLOYEE_MEMBERSHIP.INACTIVE
                  ? 'Đã ngừng tham gia'
                  : `${formatVND(employee.monthly_contribution || employee.monthly_contribution_amount || 0)}/tháng`
            }
          </div>
        </td>
        {MONTHS.map(({ number }) => {
          const monthKey = `${year}-${String(number).padStart(2, '0')}`;
          const status = getMonthStatus(employee, monthKey, coveredMonths, reconciledMonths, currentMonthKey);
          return <MonthStatusCell key={monthKey} status={status} />;
        })}
        <td className="border border-gray-200 px-3 py-3 text-center font-semibold text-gray-700">
          {paidMonthsInYear}/12
        </td>
      </tr>
    );
  });
};

const EmployeePaymentMatrix = ({
  employees,
  payments,
  reconciliations = [],
  searchTerm,
  onSearchChange,
  selectedYear,
  onYearChange,
  availableYears,
  onOpenReconciliation,
  reconciliationAvailable = false,
}) => {
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('vi-VN');
  const matchingEmployees = employees
    .filter((employee) => {
      if (!normalizedSearch) return true;
      return [employee.name, employee.department]
        .some((value) => String(value || '').toLocaleLowerCase('vi-VN').includes(normalizedSearch));
    })
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi-VN'));

  const activeEmployees = matchingEmployees.filter(isActiveFundMember);
  const directEmployees = matchingEmployees.filter((employee) => (
    getEmployeeMembershipMode(employee) === EMPLOYEE_MEMBERSHIP.DIRECT
  ));
  const inactiveEmployees = matchingEmployees.filter((employee) => (
    getEmployeeMembershipMode(employee) === EMPLOYEE_MEMBERSHIP.INACTIVE
  ));
  const { coveredByEmployee, reconciledByEmployee } = getCoveredMonths(payments, reconciliations);
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Employee Payment Status</h3>
            <p className="mt-1 text-sm text-gray-500">
              Theo dõi tháng đã thu quỹ của từng nhân viên trong năm {selectedYear}.
            </p>
            {!reconciliationAvailable && (
              <p className="mt-1 text-xs font-medium text-amber-700">
                Chạy script V11 trên Supabase để bật chức năng đối soát lịch sử.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onOpenReconciliation}
              disabled={!reconciliationAvailable}
              title={reconciliationAvailable
                ? 'Đánh dấu các tháng đã thu trước khi dùng ứng dụng'
                : 'Cần chạy script database đối soát trước'}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <History className="h-4 w-4" />
              Đối soát lịch sử
            </button>
            <input
              type="search"
              placeholder="Tìm nhân viên hoặc phòng ban..."
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              className="min-w-64 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <select
              value={selectedYear}
              onChange={(event) => onYearChange(Number(event.target.value))}
              aria-label="Chọn năm theo dõi đóng quỹ"
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>Năm {year}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-600">
          {Object.entries(STATUS_STYLES).map(([status, statusStyle]) => {
            const LegendIcon = statusStyle.Icon;
            return (
              <span key={status} className="inline-flex items-center gap-1.5">
                <span className={`flex h-5 w-5 items-center justify-center rounded border ${statusStyle.className}`}>
                  <LegendIcon className="h-3 w-3" />
                </span>
                {statusStyle.label}
              </span>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1120px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-20 min-w-56 border border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Nhân viên
              </th>
              {MONTHS.map(({ number, label }) => (
                <th key={number} className="w-16 border border-gray-200 px-2 py-3 text-center text-xs font-semibold uppercase text-gray-600">
                  {label}
                </th>
              ))}
              <th className="w-20 border border-gray-200 px-3 py-3 text-center text-xs font-semibold uppercase text-gray-600">
                Đã nộp
              </th>
            </tr>
          </thead>

          <tbody>
            <tr className="bg-emerald-50">
              <th colSpan="14" className="border border-emerald-100 px-4 py-2 text-left text-sm font-semibold text-emerald-800">
                Đang tham gia Quỹ ({activeEmployees.length})
              </th>
            </tr>
            <EmployeeRows
              employees={activeEmployees}
              year={selectedYear}
              coveredByEmployee={coveredByEmployee}
              reconciledByEmployee={reconciledByEmployee}
              currentMonthKey={currentMonthKey}
            />

            <tr className="bg-blue-50">
              <th colSpan="14" className="border border-blue-100 px-4 py-2 text-left text-sm font-semibold text-blue-800">
                Thu trực tiếp trên từng khoản chi ({directEmployees.length})
              </th>
            </tr>
            <EmployeeRows
              employees={directEmployees}
              year={selectedYear}
              coveredByEmployee={coveredByEmployee}
              reconciledByEmployee={reconciledByEmployee}
              currentMonthKey={currentMonthKey}
            />

            <tr className="bg-slate-100">
              <th colSpan="14" className="border border-slate-200 px-4 py-2 text-left text-sm font-semibold text-slate-700">
                Đã ngừng tham gia ({inactiveEmployees.length})
              </th>
            </tr>
            <EmployeeRows
              employees={inactiveEmployees}
              year={selectedYear}
              coveredByEmployee={coveredByEmployee}
              reconciledByEmployee={reconciledByEmployee}
              currentMonthKey={currentMonthKey}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeePaymentMatrix;
