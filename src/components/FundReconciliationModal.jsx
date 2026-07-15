import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, History, X } from 'lucide-react';

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

const getPaymentMonthKeys = (payments, employeeId, year) => new Set(
  payments
    .filter((payment) => String(payment.employee_id) === String(employeeId))
    .flatMap((payment) => (
      Array.isArray(payment.months_covered) && payment.months_covered.length > 0
        ? payment.months_covered
        : [String(payment.payment_date || '').slice(0, 7)]
    ))
    .filter((monthKey) => String(monthKey).startsWith(`${year}-`))
);

const getReconciledMonthKeys = (reconciliations, employeeId, year) => new Set(
  reconciliations
    .filter((item) => (
      String(item.employee_id) === String(employeeId)
      && String(item.month_key).startsWith(`${year}-`)
    ))
    .map((item) => item.month_key)
);

const FundReconciliationModal = ({
  isOpen,
  employees,
  payments,
  reconciliations,
  initialYear,
  availableYears,
  isSaving,
  onClose,
  onSave,
}) => {
  const sortedEmployees = useMemo(() => (
    [...employees].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi-VN'))
  ), [employees]);
  const [employeeId, setEmployeeId] = useState('');
  const [year, setYear] = useState(initialYear);
  const [selectedMonthKeys, setSelectedMonthKeys] = useState(new Set());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setEmployeeId((current) => current || String(sortedEmployees[0]?.id || ''));
    setYear(initialYear);
    setSaved(false);
  }, [initialYear, isOpen, sortedEmployees]);

  useEffect(() => {
    setSelectedMonthKeys(getReconciledMonthKeys(reconciliations, employeeId, year));
  }, [employeeId, reconciliations, year]);

  if (!isOpen) return null;

  const actualPaymentMonths = getPaymentMonthKeys(payments, employeeId, year);
  const yearOptions = [...new Set([
    ...availableYears,
    new Date().getFullYear(),
    new Date().getFullYear() - 1,
    new Date().getFullYear() - 2,
  ])].sort((a, b) => b - a);

  const toggleMonth = (monthKey) => {
    if (actualPaymentMonths.has(monthKey)) return;

    setSelectedMonthKeys((current) => {
      const next = new Set(current);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    const success = await onSave({
      employeeId,
      year,
      monthKeys: [...selectedMonthKeys].sort(),
    });
    setSaved(success === true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        type="button"
        aria-label="Đóng"
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <History className="h-5 w-5 text-teal-700" />
              Đối soát đóng quỹ lịch sử
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Dùng cho các tháng đã thu trước khi nhập dữ liệu vào ứng dụng.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
          <strong>Không thay đổi tiền quỹ:</strong> thao tác này chỉ đánh dấu trạng thái tháng đã thu,
          không tạo giao dịch thu và không cộng vào số dư hiện tại.
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_150px]">
          <label className="text-sm font-medium text-gray-700">
            Nhân viên
            <select
              value={employeeId}
              onChange={(event) => {
                setEmployeeId(event.target.value);
                setSaved(false);
              }}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {sortedEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Năm
            <select
              value={year}
              onChange={(event) => {
                setYear(Number(event.target.value));
                setSaved(false);
              }}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {yearOptions.map((optionYear) => (
                <option key={optionYear} value={optionYear}>{optionYear}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {MONTHS.map((month) => {
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            const isActualPayment = actualPaymentMonths.has(monthKey);
            const isReconciled = selectedMonthKeys.has(monthKey);
            return (
              <button
                type="button"
                key={monthKey}
                onClick={() => toggleMonth(monthKey)}
                disabled={isActualPayment || isSaving}
                title={isActualPayment ? 'Đã có giao dịch thu thực tế' : undefined}
                className={`rounded-lg border px-2 py-3 text-sm font-medium transition ${
                  isActualPayment
                    ? 'cursor-not-allowed border-emerald-200 bg-emerald-50 text-emerald-700'
                    : isReconciled
                      ? 'border-teal-500 bg-teal-100 text-teal-800 ring-2 ring-teal-500/20'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50'
                }`}
              >
                <span className="flex items-center justify-center gap-1">
                  {(isActualPayment || isReconciled) && <CheckCircle className="h-4 w-4" />}
                  T{month}
                </span>
                <span className="mt-1 block text-[10px] font-normal">
                  {isActualPayment ? 'Đã thu' : isReconciled ? 'Đối soát' : 'Chưa đánh dấu'}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Ô “Đã thu” có giao dịch thật nên không thể thay đổi tại đây. Ô “Đối soát” có thể bật hoặc bỏ đánh dấu.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !employeeId}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : saved ? 'Đã lưu ✓' : 'Lưu đối soát'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FundReconciliationModal;
