import { getCoveredMonthKeys, getFundStartMonthKey } from './fundPolicy.js';

export const DEFAULT_MONTHLY_CONTRIBUTION = 100000;

const coverageKey = (employeeId, monthKey) => `${String(employeeId)}::${monthKey}`;

export const getMonthlyContribution = (employee) => {
  const amount = Number(employee?.monthly_contribution_amount);
  return amount > 0 ? amount : DEFAULT_MONTHLY_CONTRIBUTION;
};

export const buildEmployeeMonthCoverage = (payments = [], reconciliations = []) => {
  const coverage = new Map();

  payments.forEach((payment) => {
    getCoveredMonthKeys(payment).forEach((monthKey) => {
      coverage.set(coverageKey(payment.employee_id, monthKey), 'paid');
    });
  });

  reconciliations.forEach((item) => {
    const key = coverageKey(item.employee_id, item.month_key);
    if (!coverage.has(key)) coverage.set(key, 'reconciled');
  });

  return coverage;
};

export const getBulkPaymentEligibility = (employee, monthKey, coverage) => {
  const existingStatus = coverage.get(coverageKey(employee.id, monthKey));
  if (existingStatus) {
    return {
      eligible: false,
      status: existingStatus,
      label: existingStatus === 'reconciled' ? 'Đã đối soát' : 'Đã đóng',
    };
  }

  const startMonthKey = getFundStartMonthKey(employee);
  if (startMonthKey && monthKey < startMonthKey) {
    return { eligible: false, status: 'not_started', label: 'Chưa đến kỳ' };
  }

  return { eligible: true, status: 'unpaid', label: 'Chưa đóng' };
};

export const buildBulkPaymentRows = ({
  employees,
  selectedEmployeeIds,
  amountsByEmployee,
  monthKey,
  paymentDate,
  paymentMethod,
  notes,
}) => {
  const selectedIds = new Set(selectedEmployeeIds.map(String));

  return employees
    .filter((employee) => selectedIds.has(String(employee.id)))
    .map((employee) => ({
      employee_id: employee.id,
      amount: Number(amountsByEmployee[String(employee.id)] ?? getMonthlyContribution(employee)),
      payment_date: paymentDate,
      months_covered: [monthKey],
      payment_method: paymentMethod || 'cash',
      notes: String(notes || '').trim(),
    }));
};
