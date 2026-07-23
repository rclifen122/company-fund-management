import { createElement, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, Minus, PiggyBank, Receipt, UserMinus } from 'lucide-react';
import {
  EMPLOYEE_MEMBERSHIP,
  getEmployeeMembershipMode,
  isActiveFundMember,
} from '../utils/employeeMembership';
import { getCoveredMonthKeys } from '../utils/fundPolicy';

const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  number: index + 1,
  label: `T${index + 1}`,
}));

const TABS = [
  { mode: EMPLOYEE_MEMBERSHIP.FUND, label: 'Đang tham gia Quỹ', Icon: PiggyBank },
  { mode: EMPLOYEE_MEMBERSHIP.DIRECT, label: 'Thu trực tiếp từng khoản', Icon: Receipt },
  { mode: EMPLOYEE_MEMBERSHIP.INACTIVE, label: 'Đã ngừng tham gia', Icon: UserMinus },
];

const STATUS_STYLES = {
  paid: { label: 'Đã nộp', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', Icon: CheckCircle },
  pending: { label: 'Chờ nộp', className: 'border-amber-200 bg-amber-50 text-amber-700', Icon: Clock },
  overdue: { label: 'Quá hạn', className: 'border-rose-200 bg-rose-50 text-rose-700', Icon: AlertTriangle },
  upcoming: { label: 'Chưa đến kỳ', className: 'border-slate-200 bg-slate-50 text-slate-400', Icon: Minus },
  not_applicable: { label: 'Không tham gia', className: 'border-gray-200 bg-gray-50 text-gray-300', Icon: Minus },
};

const getMonthKey = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : null;
};

const buildCoveredMonths = (payments, reconciliations) => {
  const result = new Map();
  const addMonth = (employeeId, monthKey) => {
    if (!employeeId || !/^\d{4}-\d{2}$/.test(monthKey || '')) return;
    const key = String(employeeId);
    if (!result.has(key)) result.set(key, new Set());
    result.get(key).add(monthKey);
  };

  payments.forEach((payment) => {
    getCoveredMonthKeys(payment).forEach((monthKey) => addMonth(payment.employee_id, monthKey));
  });

  // Những tháng đã đối soát trước đây được xem như tháng đã nộp bình thường.
  reconciliations.forEach((item) => addMonth(item.employee_id, item.month_key));
  return result;
};

const getStatus = (employee, monthKey, coveredMonths, currentMonthKey) => {
  if (coveredMonths.has(monthKey)) return 'paid';
  if (!isActiveFundMember(employee)) return 'not_applicable';
  const joinMonthKey = getMonthKey(employee.join_date);
  if (joinMonthKey && monthKey < joinMonthKey) return 'not_applicable';
  if (monthKey > currentMonthKey) return 'upcoming';
  if (monthKey === currentMonthKey) return 'pending';
  return 'overdue';
};

const StatusIcon = ({ status, compact = false }) => {
  const style = STATUS_STYLES[status];
  return (
    <span title={style.label} aria-label={style.label} className={`mx-auto flex items-center justify-center rounded-md border ${compact ? 'h-7 w-full' : 'h-8 w-8'} ${style.className}`}>
      {createElement(style.Icon, { className: compact ? 'h-3.5 w-3.5' : 'h-4 w-4' })}
    </span>
  );
};

const EmployeeRows = ({ employees, year, coveredByEmployee, currentMonthKey }) => {
  if (employees.length === 0) {
    return <tr><td colSpan="14" className="border border-gray-200 px-4 py-8 text-center text-sm text-gray-500">Không có nhân viên phù hợp.</td></tr>;
  }

  return employees.map((employee) => {
    const coveredMonths = coveredByEmployee.get(String(employee.id)) || new Set();
    const paidMonths = MONTHS.filter(({ number }) => coveredMonths.has(`${year}-${String(number).padStart(2, '0')}`)).length;
    return (
      <tr key={employee.id} className="hover:bg-indigo-50/30">
        <td className="sticky left-0 z-10 min-w-56 border border-gray-200 bg-white px-4 py-3 font-medium text-gray-900 shadow-[1px_0_0_0_#e5e7eb]">{employee.name}</td>
        {MONTHS.map(({ number }) => {
          const monthKey = `${year}-${String(number).padStart(2, '0')}`;
          return <td key={monthKey} className="border border-gray-200 p-1.5 text-center"><StatusIcon status={getStatus(employee, monthKey, coveredMonths, currentMonthKey)} /></td>;
        })}
        <td className="border border-gray-200 px-3 py-3 text-center font-semibold text-gray-700">{paidMonths}/12</td>
      </tr>
    );
  });
};

const MobileEmployeeCards = ({ employees, year, coveredByEmployee, currentMonthKey }) => (
  <div className="space-y-3 p-4 md:hidden">
    {employees.map((employee) => {
      const coveredMonths = coveredByEmployee.get(String(employee.id)) || new Set();
      const paidMonths = MONTHS.filter(({ number }) => coveredMonths.has(`${year}-${String(number).padStart(2, '0')}`)).length;
      return (
        <article key={employee.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3"><p className="font-semibold text-gray-900">{employee.name}</p><span className="text-xs font-semibold text-gray-500">{paidMonths}/12 tháng</span></div>
          <div className="mt-3 grid grid-cols-6 gap-1.5">
            {MONTHS.map(({ number, label }) => {
              const monthKey = `${year}-${String(number).padStart(2, '0')}`;
              const status = getStatus(employee, monthKey, coveredMonths, currentMonthKey);
              return <div key={monthKey} className="text-center"><span className="mb-1 block text-[10px] font-semibold text-gray-500">{label}</span><StatusIcon status={status} compact /></div>;
            })}
          </div>
        </article>
      );
    })}
    {employees.length === 0 && <p className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">Không có nhân viên phù hợp.</p>}
  </div>
);

const EmployeePaymentMatrix = ({
  employees,
  payments,
  reconciliations = [],
  searchTerm,
  onSearchChange,
  selectedYear,
  onYearChange,
  availableYears,
}) => {
  const [activeTab, setActiveTab] = useState(EMPLOYEE_MEMBERSHIP.FUND);
  const coveredByEmployee = useMemo(() => buildCoveredMonths(payments, reconciliations), [payments, reconciliations]);
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('vi-VN');
  const matchingEmployees = employees
    .filter((employee) => !normalizedSearch || String(employee.name || '').toLocaleLowerCase('vi-VN').includes(normalizedSearch))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi-VN'));
  const groups = {
    [EMPLOYEE_MEMBERSHIP.FUND]: matchingEmployees.filter(isActiveFundMember),
    [EMPLOYEE_MEMBERSHIP.DIRECT]: matchingEmployees.filter((employee) => getEmployeeMembershipMode(employee) === EMPLOYEE_MEMBERSHIP.DIRECT),
    [EMPLOYEE_MEMBERSHIP.INACTIVE]: matchingEmployees.filter((employee) => getEmployeeMembershipMode(employee) === EMPLOYEE_MEMBERSHIP.INACTIVE),
  };
  const visibleEmployees = groups[activeTab];
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return (
    <section className="overflow-hidden rounded-lg bg-white shadow">
      <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Tình Trạng Đóng Quỹ Theo Tháng</h2>
            <p className="mt-1 text-sm text-gray-500">Theo dõi các tháng đã thu của từng nhân viên trong năm {selectedYear}.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input type="search" placeholder="Tìm theo tên nhân viên..." value={searchTerm} onChange={(event) => onSearchChange(event.target.value)} className="min-w-64 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <select value={selectedYear} onChange={(event) => onYearChange(Number(event.target.value))} aria-label="Chọn năm theo dõi đóng quỹ" className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              {availableYears.map((year) => <option key={year} value={year}>Năm {year}</option>)}
            </select>
          </div>
        </div>

        <div role="tablist" aria-label="Nhóm nhân viên" className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {TABS.map((tab) => (
            <button key={tab.mode} type="button" role="tab" aria-selected={activeTab === tab.mode} onClick={() => setActiveTab(tab.mode)} className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition ${activeTab === tab.mode ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/10' : 'border-gray-200 text-gray-600 hover:border-indigo-200 hover:bg-gray-50'}`}>
              <span className="inline-flex items-center gap-2">{createElement(tab.Icon, { className: 'h-4 w-4' })}{tab.label}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold">{groups[tab.mode].length}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-600">
          {Object.entries(STATUS_STYLES).map(([status, style]) => (
            <span key={status} className="inline-flex items-center gap-1.5"><span className={`flex h-5 w-5 items-center justify-center rounded border ${style.className}`}>{createElement(style.Icon, { className: 'h-3 w-3' })}</span>{style.label}</span>
          ))}
        </div>
      </div>

      <MobileEmployeeCards employees={visibleEmployees} year={selectedYear} coveredByEmployee={coveredByEmployee} currentMonthKey={currentMonthKey} />

      <div className="hidden max-h-[70vh] overflow-auto md:block">
        <table className="min-w-[1120px] w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-40 min-w-56 border border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 shadow-[1px_0_0_0_#e5e7eb]">Nhân viên</th>
              {MONTHS.map(({ number, label }) => <th key={number} className="sticky top-0 z-30 w-16 border border-gray-200 bg-gray-50 px-2 py-3 text-center text-xs font-semibold uppercase text-gray-600">{label}</th>)}
              <th className="sticky top-0 z-30 w-20 border border-gray-200 bg-gray-50 px-3 py-3 text-center text-xs font-semibold uppercase text-gray-600">Đã nộp</th>
            </tr>
          </thead>
          <tbody><EmployeeRows employees={visibleEmployees} year={selectedYear} coveredByEmployee={coveredByEmployee} currentMonthKey={currentMonthKey} /></tbody>
        </table>
      </div>
    </section>
  );
};

export default EmployeePaymentMatrix;
