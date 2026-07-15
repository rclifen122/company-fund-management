import { useEffect, useState } from 'react';
import { Calendar, CreditCard, DollarSign, FileText, User, X } from 'lucide-react';
import { buildMonthAllocations } from '../utils/fundPaymentAllocation';

const DEFAULT_MONTHLY_AMOUNT = 100000;

const createInitialFormData = () => ({
  employee_id: '',
  amount: '',
  payment_date: new Date().toISOString().split('T')[0],
  months_covered: [],
  extra_months: [],
  payment_method: 'cash',
  notes: '',
});

const formatVND = (value) => new Intl.NumberFormat('vi-VN').format(Number(value) || 0);

const formatMonth = (monthKey) => {
  const [year, month] = String(monthKey).split('-');
  return `tháng ${Number(month)} năm ${year}`;
};

const generateMonthOptions = () => {
  const options = [];
  const currentDate = new Date();

  for (let offset = -3; offset <= 3; offset += 1) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    options.push({
      value,
      label: date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' }),
    });
  }

  return options;
};

const PaymentModal = ({ isOpen, onClose, onSubmit, employees = [] }) => {
  const [formData, setFormData] = useState(createInitialFormData);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(createInitialFormData());
      setErrors({});
    }
  }, [isOpen]);

  const monthOptions = generateMonthOptions();
  const selectedEmployee = employees.find(
    (employee) => String(employee.id) === String(formData.employee_id)
  );
  const monthlyAmount = Number(selectedEmployee?.monthly_contribution_amount) > 0
    ? Number(selectedEmployee.monthly_contribution_amount)
    : DEFAULT_MONTHLY_AMOUNT;
  const enteredAmount = Number(formData.amount) || 0;
  const regularTotal = formData.months_covered.length * monthlyAmount;
  const extraAmount = Math.max(enteredAmount - regularTotal, 0);
  const hasExtraAmount = formData.months_covered.length > 0 && extraAmount > 0;
  const activeExtraMonths = hasExtraAmount
    ? formData.extra_months.filter((monthKey) => formData.months_covered.includes(monthKey))
    : [];
  const allocations = buildMonthAllocations(
    formData.months_covered,
    monthlyAmount,
    enteredAmount,
    activeExtraMonths
  );

  const clearError = (field) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleAmountChange = (event) => {
    const amount = event.target.value.replace(/[^\d]/g, '');
    setFormData((current) => ({
      ...current,
      amount,
      extra_months: Number(amount) > current.months_covered.length * monthlyAmount
        ? current.extra_months
        : [],
    }));
    clearError('amount');
    clearError('extra_months');
  };

  const handleMonthToggle = (monthValue) => {
    setFormData((current) => {
      const months = current.months_covered.includes(monthValue)
        ? current.months_covered.filter((monthKey) => monthKey !== monthValue)
        : [...current.months_covered, monthValue].sort();
      const stillHasExtra = Number(current.amount) > months.length * monthlyAmount;

      return {
        ...current,
        months_covered: months,
        extra_months: stillHasExtra
          ? current.extra_months.filter((monthKey) => months.includes(monthKey))
          : [],
      };
    });
    clearError('months_covered');
    clearError('amount');
    clearError('extra_months');
  };

  const handleExtraMonthToggle = (monthValue) => {
    if (!hasExtraAmount) return;
    setFormData((current) => ({
      ...current,
      extra_months: current.extra_months.includes(monthValue)
        ? current.extra_months.filter((monthKey) => monthKey !== monthValue)
        : [...current.extra_months, monthValue].sort(),
    }));
    clearError('extra_months');
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.employee_id) newErrors.employee_id = 'Vui lòng chọn nhân viên.';
    if (enteredAmount <= 0) newErrors.amount = 'Vui lòng nhập số tiền hợp lệ.';
    if (!formData.payment_date) newErrors.payment_date = 'Vui lòng chọn ngày thanh toán.';
    if (formData.months_covered.length === 0) {
      newErrors.months_covered = 'Vui lòng chọn ít nhất một tháng.';
    } else if (enteredAmount < regularTotal) {
      newErrors.amount = `Số tiền phải từ ${formatVND(regularTotal)}đ để ghi nhận đủ ${formData.months_covered.length} tháng.`;
    }
    if (hasExtraAmount && activeExtraMonths.length === 0) {
      newErrors.extra_months = 'Hãy chọn ít nhất một tháng nhận phần tiền đóng thêm.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const allocationEntries = Object.entries(allocations).sort(([first], [second]) => first.localeCompare(second));
      const allocationNote = hasExtraAmount
        ? `[Phân bổ theo tháng] ${allocationEntries.map(([monthKey, amount]) => `${formatMonth(monthKey)}: ${formatVND(amount)}đ`).join('; ')}`
        : '';
      const submitData = {
        employee_id: formData.employee_id,
        amount: enteredAmount,
        payment_date: formData.payment_date,
        months_covered: formData.months_covered,
        payment_method: formData.payment_method,
        notes: [formData.notes.trim(), allocationNote].filter(Boolean).join('\n'),
      };

      const saved = await onSubmit(submitData);
      if (saved !== false) onClose();
    } catch (error) {
      console.error('Không thể lưu khoản thu:', error);
      setErrors({ submit: 'Có lỗi xảy ra khi lưu khoản thu.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <button
          type="button"
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
          aria-label="Đóng cửa sổ"
        />

        <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900">Ghi Nhận Thu Quỹ</h3>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={isSubmitting} aria-label="Đóng">
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            <div>
              <label className="mb-2 flex items-center text-sm font-medium text-gray-700" htmlFor="payment-employee">
                <User className="mr-2 h-4 w-4" /> Nhân viên
              </label>
              <select
                id="payment-employee"
                value={formData.employee_id}
                onChange={(event) => {
                  setFormData((current) => ({ ...current, employee_id: event.target.value, extra_months: [] }));
                  clearError('employee_id');
                  clearError('amount');
                  clearError('extra_months');
                }}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                disabled={isSubmitting}
              >
                <option value="">Chọn nhân viên...</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>
              {errors.employee_id && <p className="mt-1 text-sm text-red-600">{errors.employee_id}</p>}
            </div>

            <div>
              <label className="mb-2 flex items-center text-sm font-medium text-gray-700" htmlFor="payment-amount">
                <DollarSign className="mr-2 h-4 w-4" /> Số tiền
              </label>
              <div className="relative">
                <input
                  id="payment-amount"
                  type="text"
                  inputMode="numeric"
                  value={formData.amount ? formatVND(formData.amount) : ''}
                  onChange={handleAmountChange}
                  placeholder="100.000"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 pr-12 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                  disabled={isSubmitting}
                />
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-gray-500">VND</span>
              </div>
              {selectedEmployee && formData.months_covered.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-emerald-700">
                  <span>Mức chuẩn: {formatVND(regularTotal)}đ ({formData.months_covered.length} tháng × {formatVND(monthlyAmount)}đ)</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((current) => ({ ...current, amount: String(regularTotal), extra_months: [] }));
                      clearError('amount');
                      clearError('extra_months');
                    }}
                    className="text-xs font-medium text-indigo-600 underline hover:text-indigo-800"
                  >
                    Dùng mức chuẩn
                  </button>
                </div>
              )}
              {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount}</p>}
            </div>

            <div>
              <label className="mb-2 flex items-center text-sm font-medium text-gray-700" htmlFor="payment-date">
                <Calendar className="mr-2 h-4 w-4" /> Ngày thanh toán
              </label>
              <input
                id="payment-date"
                type="date"
                value={formData.payment_date}
                onChange={(event) => {
                  setFormData((current) => ({ ...current, payment_date: event.target.value }));
                  clearError('payment_date');
                }}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                disabled={isSubmitting}
              />
              {errors.payment_date && <p className="mt-1 text-sm text-red-600">{errors.payment_date}</p>}
            </div>

            <div>
              <p className="mb-2 flex items-center text-sm font-medium text-gray-700">
                <Calendar className="mr-2 h-4 w-4" /> Tháng đóng quỹ
              </p>
              <div className="grid max-h-32 grid-cols-2 gap-2 overflow-y-auto">
                {monthOptions.map((month) => (
                  <label key={month.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.months_covered.includes(month.value)}
                      onChange={() => handleMonthToggle(month.value)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      disabled={isSubmitting}
                    />
                    <span className="ml-2 text-sm text-gray-700">{month.label}</span>
                  </label>
                ))}
              </div>
              {errors.months_covered && <p className="mt-1 text-sm text-red-600">{errors.months_covered}</p>}
            </div>

            <div className={`rounded-lg border p-4 transition ${hasExtraAmount ? 'border-indigo-200 bg-indigo-50/60' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Tháng có mức đóng cao hơn</p>
                  <p className="mt-1 text-xs text-gray-600">
                    {hasExtraAmount
                      ? `Đang dư ${formatVND(extraAmount)}đ. Chọn tháng nhận phần tiền này.`
                      : 'Phần này sẽ bật khi tổng tiền lớn hơn mức chuẩn của các tháng đã chọn.'}
                  </p>
                </div>
                {hasExtraAmount && <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">+{formatVND(extraAmount)}đ</span>}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {formData.months_covered.length > 0 ? formData.months_covered.map((monthKey) => (
                  <label key={monthKey} className={`flex items-center rounded-md border px-2.5 py-2 ${hasExtraAmount ? 'cursor-pointer border-indigo-200 bg-white' : 'cursor-not-allowed border-gray-200'}`}>
                    <input
                      type="checkbox"
                      checked={activeExtraMonths.includes(monthKey)}
                      onChange={() => handleExtraMonthToggle(monthKey)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      disabled={!hasExtraAmount || isSubmitting}
                    />
                    <span className="ml-2 text-xs text-gray-700">{formatMonth(monthKey)}</span>
                  </label>
                )) : <p className="col-span-2 text-xs text-gray-500">Chưa có tháng nào được chọn.</p>}
              </div>
              {errors.extra_months && <p className="mt-2 text-sm text-red-600">{errors.extra_months}</p>}

              {hasExtraAmount && activeExtraMonths.length > 0 && (
                <div className="mt-3 rounded-md bg-white p-3 text-xs text-gray-700 shadow-sm ring-1 ring-indigo-100">
                  <p className="font-semibold text-gray-800">Phân bổ dự kiến</p>
                  <div className="mt-2 space-y-1">
                    {formData.months_covered.map((monthKey) => (
                      <div key={monthKey} className="flex justify-between gap-3">
                        <span className="capitalize">{formatMonth(monthKey)}</span>
                        <span className="font-semibold">{formatVND(allocations[monthKey])}đ</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 font-semibold">
                    <span>Tổng cộng</span><span>{formatVND(enteredAmount)}đ</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 flex items-center text-sm font-medium text-gray-700" htmlFor="payment-method">
                <CreditCard className="mr-2 h-4 w-4" /> Phương thức thanh toán
              </label>
              <select
                id="payment-method"
                value={formData.payment_method}
                onChange={(event) => setFormData((current) => ({ ...current, payment_method: event.target.value }))}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                disabled={isSubmitting}
              >
                <option value="cash">Tiền mặt</option>
                <option value="bank_transfer">Chuyển khoản</option>
                <option value="other">Khác</option>
              </select>
            </div>

            <div>
              <label className="mb-2 flex items-center text-sm font-medium text-gray-700" htmlFor="payment-notes">
                <FileText className="mr-2 h-4 w-4" /> Ghi chú
              </label>
              <textarea
                id="payment-notes"
                value={formData.notes}
                onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
                rows={3}
                placeholder="Ghi chú thêm..."
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                disabled={isSubmitting}
              />
            </div>

            {errors.submit && <div className="rounded-md border border-red-200 bg-red-50 p-3"><p className="text-sm text-red-600">{errors.submit}</p></div>}

            <div className="flex space-x-3 pt-4">
              <button type="button" onClick={onClose} className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50" disabled={isSubmitting}>Hủy</button>
              <button type="submit" className="flex-1 rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50" disabled={isSubmitting}>
                {isSubmitting ? 'Đang lưu...' : 'Lưu giao dịch'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
