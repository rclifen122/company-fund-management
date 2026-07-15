import { createElement, useEffect, useState } from 'react';
import { PiggyBank, Receipt, UserMinus, X } from 'lucide-react';
import {
  EMPLOYEE_MEMBERSHIP,
  getEmployeeMembershipMode,
} from '../utils/employeeMembership';

const OPTIONS = [
  {
    mode: EMPLOYEE_MEMBERSHIP.FUND,
    title: 'Tham gia Quỹ',
    description: 'Nhân viên đóng quỹ hàng tháng và được chi từ quỹ chung.',
    Icon: PiggyBank,
    style: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400',
  },
  {
    mode: EMPLOYEE_MEMBERSHIP.DIRECT,
    title: 'Thu trực tiếp',
    description: 'Không đóng quỹ hàng tháng; chỉ thanh toán phần được chia trên từng chi phí.',
    Icon: Receipt,
    style: 'border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-400',
  },
  {
    mode: EMPLOYEE_MEMBERSHIP.INACTIVE,
    title: 'Ngừng tham gia',
    description: 'Không phát sinh nghĩa vụ mới. Toàn bộ lịch sử thu và chi vẫn được giữ lại.',
    Icon: UserMinus,
    style: 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-400',
  },
];

const EmployeeMembershipModal = ({ employee, isOpen, isSaving, onClose, onSave }) => {
  const currentMode = getEmployeeMembershipMode(employee);
  const [selectedMode, setSelectedMode] = useState(currentMode);

  useEffect(() => {
    setSelectedMode(getEmployeeMembershipMode(employee));
  }, [employee]);

  if (!isOpen || !employee) return null;

  const handleSubmit = async () => {
    if (selectedMode === currentMode) {
      onClose();
      return;
    }

    await onSave(selectedMode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        type="button"
        aria-label="Đóng"
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quản lý tham gia</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Chọn cách <strong>{employee.name}</strong> tham gia các khoản thu và chi.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {OPTIONS.map(({ mode, title, description, Icon: MembershipIcon, style }) => {
            const isSelected = selectedMode === mode;
            return (
              <button
                type="button"
                key={mode}
                onClick={() => setSelectedMode(mode)}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${style} ${
                  isSelected ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
                }`}
              >
                {createElement(MembershipIcon, { className: 'mt-0.5 h-5 w-5 shrink-0' })}
                <span className="flex-1">
                  <span className="flex items-center gap-2 font-semibold">
                    {title}
                    {mode === currentMode && (
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium">Hiện tại</span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm font-normal opacity-80">{description}</span>
                </span>
                <span
                  className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${
                    isSelected ? 'border-indigo-600 bg-indigo-600 ring-2 ring-white' : 'border-current opacity-40'
                  }`}
                />
              </button>
            );
          })}
        </div>

        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Thao tác này không xoá nhân viên, các lần đóng quỹ hay lịch sử chia chi phí trước đây.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || selectedMode === currentMode}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Đang cập nhật...' : 'Cập nhật'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeMembershipModal;
