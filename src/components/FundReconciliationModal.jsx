import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, History, X } from 'lucide-react';

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

const getPaymentMonths = (payments, employeeId, year) => new Set(
  payments
    .filter((payment) => String(payment.employee_id) === String(employeeId))
    .flatMap((payment) => (
      Array.isArray(payment.months_covered) && payment.months_covered.length > 0
        ? payment.months_covered
        : [String(payment.payment_date || '').slice(0, 7)]
    ))
    .filter((monthKey) => String(monthKey).startsWith(`${year}-`))
);

const getReconciledMonths = (reconciliations, employeeId, year) => new Set(
  reconciliations
    .filter((item) => String(item.employee_id) === String(employeeId) && String(item.month_key).startsWith(`${year}-`))
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
  const sortedEmployees = useMemo(
    () => [...employees].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi-VN')),
    [employees]
  );
  const [employeeId, setEmployeeId] = useState('');
  const [year, setYear] = useState(initialYear);
  const [selectedMonths, setSelectedMonths] = useState(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setEmployeeId((current) => current || String(sortedEmployees[0]?.id || ''));
    setYear(initialYear);
  }, [initialYear, isOpen, sortedEmployees]);

  useEffect(() => {
    if (!isOpen || !employeeId) return;
    setSelectedMonths(getReconciledMonths(reconciliations, employeeId, year));
  }, [employeeId, isOpen, reconciliations, year]);

  if (!isOpen) return null;

  const paidMonths = getPaymentMonths(payments, employeeId, year);
  const years = [...new Set([initialYear, 2025, ...availableYears])].filter(Number.isInteger).sort((a, b) => b - a);

  const toggleMonth = (monthKey) => {
    if (paidMonths.has(monthKey) || isSaving) return;
    setSelectedMonths((current) => {
      const next = new Set(current);
      if (next.has(monthKey)) next.delete(monthKey); else next.add(monthKey);
      return next;
    });
  };

  const handleSave = async () => {
    const success = await onSave({ employeeId, year, monthKeys: [...selectedMonths].sort() });
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-950/50" onClick={onClose} aria-label="Đóng" />
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"><History className="h-5 w-5 text-teal-600" /> Đối Soát Lịch Sử Thu Quỹ</h2>
            <p className="mt-1 text-sm text-gray-500">Đánh dấu những tháng đã thu trước đây nhưng chưa có giao dịch trong hệ thống.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Thao tác này chỉ cập nhật trạng thái tháng đã thu, không cộng thêm tiền vào số dư quỹ.
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_150px]">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Nhân viên
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700">
              {sortedEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Năm
            <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700">
              {years.map((item) => <option key={item} value={item}>Năm {item}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {MONTHS.map((month) => {
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            const isPaid = paidMonths.has(monthKey);
            const isSelected = selectedMonths.has(monthKey);
            return (
              <button key={monthKey} type="button" onClick={() => toggleMonth(monthKey)} disabled={isPaid || isSaving} title={isPaid ? 'Đã có giao dịch thu thực tế' : undefined} className={`rounded-xl border p-3 text-center transition ${isPaid ? 'cursor-not-allowed border-emerald-200 bg-emerald-50 text-emerald-700' : isSelected ? 'border-teal-400 bg-teal-50 text-teal-700 ring-2 ring-teal-500/10' : 'border-gray-200 text-gray-600 hover:border-teal-300 hover:bg-gray-50'}`}>
                <span className="block text-sm font-semibold">T{month}</span>
                <span className="mt-1 flex min-h-4 items-center justify-center text-[10px] font-medium">{(isPaid || isSelected) && <CheckCircle className="mr-1 h-3.5 w-3.5" />}{isPaid ? 'Đã thu' : isSelected ? 'Đánh dấu' : 'Chưa chọn'}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-5">
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Huỷ</button>
          <button type="button" onClick={handleSave} disabled={isSaving || !employeeId} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">{isSaving ? 'Đang lưu...' : 'Lưu đối soát'}</button>
        </div>
      </div>
    </div>
  );
};

export default FundReconciliationModal;
