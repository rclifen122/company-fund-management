import { useMemo, useState } from 'react';
import { Calendar, Check, CreditCard, FileText, Search } from 'lucide-react';
import {
  buildBulkPaymentRows,
  buildEmployeeMonthCoverage,
  getBulkPaymentEligibility,
  getMonthlyContribution,
} from '../utils/fundPaymentBatch';

const formatNumber = (value) => new Intl.NumberFormat('vi-VN').format(Number(value) || 0);

const formatMonth = (monthKey) => {
  const [year, month] = String(monthKey).split('-');
  return `tháng ${Number(month)} năm ${year}`;
};

const normalizeSearchText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase();

const generateMonthOptions = () => {
  const options = [];
  const currentDate = new Date();

  for (let offset = -3; offset <= 3; offset += 1) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    options.push({
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }),
    });
  }

  return options;
};

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const statusClasses = {
  unpaid: 'bg-amber-50 text-amber-700 ring-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  reconciled: 'bg-blue-50 text-blue-700 ring-blue-200',
  not_started: 'bg-gray-100 text-gray-600 ring-gray-200',
};

const BulkPaymentForm = ({
  employees = [],
  payments = [],
  reconciliations = [],
  onSubmit,
  onClose,
  isSubmitting,
  onSubmittingChange,
}) => {
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [amountsByEmployee, setAmountsByEmployee] = useState({});
  const [errors, setErrors] = useState({});

  const monthOptions = useMemo(generateMonthOptions, []);
  const coverage = useMemo(
    () => buildEmployeeMonthCoverage(payments, reconciliations),
    [payments, reconciliations]
  );

  const employeeRows = useMemo(() => employees.map((employee) => ({
    employee,
    eligibility: getBulkPaymentEligibility(employee, monthKey, coverage),
  })), [coverage, employees, monthKey]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalizeSearchText(searchTerm.trim());
    if (!normalizedSearch) return employeeRows;
    return employeeRows.filter(({ employee }) => normalizeSearchText(
      `${employee.name} ${employee.department || ''}`
    ).includes(normalizedSearch));
  }, [employeeRows, searchTerm]);

  const eligibleRows = employeeRows.filter(({ eligibility }) => eligibility.eligible);
  const selectedIdSet = new Set(selectedEmployeeIds.map(String));
  const allEligibleSelected = eligibleRows.length > 0
    && eligibleRows.every(({ employee }) => selectedIdSet.has(String(employee.id)));
  const totalAmount = employeeRows.reduce((total, { employee }) => {
    const employeeId = String(employee.id);
    if (!selectedIdSet.has(employeeId)) return total;
    return total + Number(amountsByEmployee[employeeId] ?? getMonthlyContribution(employee));
  }, 0);

  const clearError = (field) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleMonthChange = (event) => {
    setMonthKey(event.target.value);
    setSelectedEmployeeIds([]);
    setAmountsByEmployee({});
    setErrors({});
  };

  const toggleEmployee = (employee, eligible) => {
    if (!eligible || isSubmitting) return;
    const employeeId = String(employee.id);
    setSelectedEmployeeIds((current) => current.some((id) => String(id) === employeeId)
      ? current.filter((id) => String(id) !== employeeId)
      : [...current, employee.id]);
    clearError('employees');
    clearError('amounts');
  };

  const toggleAllEligible = () => {
    if (allEligibleSelected) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(eligibleRows.map(({ employee }) => employee.id));
    }
    clearError('employees');
    clearError('amounts');
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!monthKey) nextErrors.month = 'Vui lòng chọn tháng đóng quỹ.';
    if (!paymentDate) nextErrors.paymentDate = 'Vui lòng chọn ngày thanh toán.';
    if (selectedEmployeeIds.length === 0) {
      nextErrors.employees = 'Vui lòng chọn ít nhất một nhân viên.';
    }

    const invalidEmployee = employeeRows.find(({ employee }) => {
      const employeeId = String(employee.id);
      return selectedIdSet.has(employeeId)
        && Number(amountsByEmployee[employeeId] ?? getMonthlyContribution(employee)) < getMonthlyContribution(employee);
    });
    if (invalidEmployee) {
      nextErrors.amounts = `Số tiền của ${invalidEmployee.employee.name} phải từ ${formatNumber(getMonthlyContribution(invalidEmployee.employee))}đ.`;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    onSubmittingChange(true);
    try {
      const rows = buildBulkPaymentRows({
        employees,
        selectedEmployeeIds,
        amountsByEmployee,
        monthKey,
        paymentDate,
        paymentMethod,
        notes,
      }).map((row) => {
        const employee = employees.find((item) => String(item.id) === String(row.employee_id));
        const allocationNote = row.amount > getMonthlyContribution(employee)
          ? `[Phân bổ theo tháng] ${formatMonth(monthKey)}: ${formatNumber(row.amount)}đ`
          : '';
        return {
          ...row,
          notes: [row.notes, allocationNote].filter(Boolean).join('\n'),
        };
      });

      const saved = await onSubmit(rows);
      if (saved !== false) onClose();
    } catch (error) {
      console.error('Không thể lưu các khoản thu:', error);
      setErrors({ submit: 'Có lỗi xảy ra khi lưu các khoản thu.' });
    } finally {
      onSubmittingChange(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-2 flex items-center text-sm font-medium text-gray-700" htmlFor="bulk-payment-month">
              <Calendar className="mr-2 h-4 w-4" /> Tháng đóng quỹ
            </label>
            <select
              id="bulk-payment-month"
              value={monthKey}
              onChange={handleMonthChange}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              disabled={isSubmitting}
            >
              {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
            </select>
            {errors.month && <p className="mt-1 text-sm text-red-600">{errors.month}</p>}
          </div>

          <div>
            <label className="mb-2 flex items-center text-sm font-medium text-gray-700" htmlFor="bulk-payment-date">
              <Calendar className="mr-2 h-4 w-4" /> Ngày thanh toán
            </label>
            <input
              id="bulk-payment-date"
              type="date"
              value={paymentDate}
              onChange={(event) => {
                setPaymentDate(event.target.value);
                clearError('paymentDate');
              }}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              disabled={isSubmitting}
            />
            {errors.paymentDate && <p className="mt-1 text-sm text-red-600">{errors.paymentDate}</p>}
          </div>

          <div>
            <label className="mb-2 flex items-center text-sm font-medium text-gray-700" htmlFor="bulk-payment-method">
              <CreditCard className="mr-2 h-4 w-4" /> Phương thức
            </label>
            <select
              id="bulk-payment-method"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              disabled={isSubmitting}
            >
              <option value="cash">Tiền mặt</option>
              <option value="bank_transfer">Chuyển khoản</option>
              <option value="other">Khác</option>
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200">
          <div className="space-y-3 border-b border-gray-200 bg-gray-50 p-3 sm:flex sm:items-center sm:justify-between sm:space-y-0">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm nhân viên hoặc phòng ban..."
                className="block w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                disabled={isSubmitting}
              />
            </div>
            <button
              type="button"
              onClick={toggleAllEligible}
              disabled={eligibleRows.length === 0 || isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <Check className="mr-2 h-4 w-4" />
              {allEligibleSelected ? 'Bỏ chọn tất cả' : `Chọn tất cả chưa đóng (${eligibleRows.length})`}
            </button>
          </div>

          <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
            {filteredRows.length === 0 && (
              <p className="p-6 text-center text-sm text-gray-500">Không tìm thấy nhân viên phù hợp.</p>
            )}
            {filteredRows.map(({ employee, eligibility }) => {
              const employeeId = String(employee.id);
              const selected = selectedIdSet.has(employeeId);
              const standardAmount = getMonthlyContribution(employee);
              const amount = amountsByEmployee[employeeId] ?? standardAmount;

              return (
                <div
                  key={employee.id}
                  className={`grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto_150px] sm:items-center ${eligibility.eligible ? 'bg-white' : 'bg-gray-50/70'}`}
                >
                  <label className={`flex min-w-0 items-start gap-3 ${eligibility.eligible ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleEmployee(employee, eligibility.eligible)}
                      disabled={!eligibility.eligible || isSubmitting}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">{employee.name}</span>
                      <span className="block truncate text-xs text-gray-500">{employee.department || 'Chưa có phòng ban'} · Mức chuẩn {formatNumber(standardAmount)}đ</span>
                    </span>
                  </label>

                  <span className={`w-fit rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusClasses[eligibility.status]}`}>
                    {eligibility.label}
                  </span>

                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label={`Số tiền của ${employee.name}`}
                      value={amount === '' ? '' : formatNumber(amount)}
                      onChange={(event) => {
                        const nextAmount = event.target.value.replace(/[^\d]/g, '');
                        setAmountsByEmployee((current) => ({ ...current, [employeeId]: nextAmount }));
                        clearError('amounts');
                      }}
                      disabled={!selected || isSubmitting}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 pr-9 text-right text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-gray-500">đ</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {errors.employees && <p className="text-sm text-red-600">{errors.employees}</p>}
        {errors.amounts && <p className="text-sm text-red-600">{errors.amounts}</p>}

        <div>
          <label className="mb-2 flex items-center text-sm font-medium text-gray-700" htmlFor="bulk-payment-notes">
            <FileText className="mr-2 h-4 w-4" /> Ghi chú chung
          </label>
          <textarea
            id="bulk-payment-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="Ghi chú này sẽ được lưu vào từng giao dịch..."
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            disabled={isSubmitting}
          />
        </div>

        {errors.submit && <div className="rounded-md border border-red-200 bg-red-50 p-3"><p className="text-sm text-red-600">{errors.submit}</p></div>}
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-gray-200 bg-white p-4 shadow-[0_-8px_20px_-16px_rgba(15,23,42,0.45)] sm:flex-row sm:items-center sm:px-6">
        <div className="flex-1 text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{selectedEmployeeIds.length} người</span>
          <span className="mx-2">·</span>
          Tổng thu: <span className="font-semibold text-indigo-700">{formatNumber(totalAmount)}đ</span>
        </div>
        <div className="flex gap-3 sm:w-auto">
          <button type="button" onClick={onClose} className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:flex-none" disabled={isSubmitting}>Hủy</button>
          <button type="submit" className="flex-1 rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 sm:flex-none" disabled={isSubmitting || selectedEmployeeIds.length === 0}>
            {isSubmitting ? 'Đang lưu...' : `Ghi nhận ${selectedEmployeeIds.length} khoản thu`}
          </button>
        </div>
      </div>
    </form>
  );
};

export default BulkPaymentForm;
