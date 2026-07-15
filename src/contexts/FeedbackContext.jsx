import { createElement, useCallback, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import { FeedbackContext } from './feedback';

const TOAST_STYLES = {
  success: { Icon: CheckCircle, className: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  error: { Icon: XCircle, className: 'border-rose-200 bg-rose-50 text-rose-900' },
  warning: { Icon: AlertTriangle, className: 'border-amber-200 bg-amber-50 text-amber-900' },
  info: { Icon: Info, className: 'border-blue-200 bg-blue-50 text-blue-900' },
};

export const FeedbackProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const nextId = useRef(0);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = ++nextId.current;
    setToasts((current) => [...current.slice(-3), { id, message, type }]);
    window.setTimeout(() => dismissToast(id), duration);
  }, [dismissToast]);

  const confirmAction = useCallback((options) => new Promise((resolve) => {
    setConfirmation({
      title: options.title || 'Xác nhận thao tác',
      message: options.message,
      confirmLabel: options.confirmLabel || 'Xác nhận',
      cancelLabel: options.cancelLabel || 'Huỷ',
      tone: options.tone || 'danger',
      resolve,
    });
  }), []);

  const closeConfirmation = useCallback((result) => {
    setConfirmation((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ showToast, confirmAction }), [confirmAction, showToast]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((toast) => {
          const { Icon, className } = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
          return (
            <div key={toast.id} className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg ${className}`}>
              {createElement(Icon, { className: 'mt-0.5 h-5 w-5 shrink-0' })}
              <p className="flex-1 text-sm font-medium">{toast.message}</p>
              <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Đóng thông báo">
                <X className="h-4 w-4 opacity-60" />
              </button>
            </div>
          );
        })}
      </div>

      {confirmation && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
          <button type="button" className="absolute inset-0 bg-slate-950/50" onClick={() => closeConfirmation(false)} aria-label="Đóng" />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <div className="flex items-start gap-3">
              <span className={`rounded-full p-2 ${confirmation.tone === 'danger' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">{confirmation.title}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{confirmation.message}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => closeConfirmation(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                {confirmation.cancelLabel}
              </button>
              <button type="button" onClick={() => closeConfirmation(true)} className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${confirmation.tone === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                {confirmation.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
};
