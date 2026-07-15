import { AlertCircle, RefreshCw } from 'lucide-react';

export const PageSkeleton = ({ rows = 5 }) => (
  <div className="animate-pulse space-y-5" aria-label="Đang tải dữ liệu">
    <div className="h-8 w-52 rounded-lg bg-gray-200 dark:bg-gray-700" />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="h-28 rounded-xl bg-gray-200 dark:bg-gray-800" />
      ))}
    </div>
    <div className="rounded-xl bg-white p-5 dark:bg-gray-800">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="mb-3 h-12 rounded-lg bg-gray-100 last:mb-0 dark:bg-gray-700" />
      ))}
    </div>
  </div>
);

export const ErrorState = ({ title = 'Không thể tải dữ liệu', message, onRetry }) => (
  <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm dark:border-rose-900 dark:bg-gray-800">
    <AlertCircle className="mx-auto h-10 w-10 text-rose-500" />
    <h2 className="mt-3 font-semibold text-gray-900 dark:text-white">{title}</h2>
    {message && <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">{message}</p>}
    {onRetry && (
      <button type="button" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
        <RefreshCw className="h-4 w-4" /> Thử lại
      </button>
    )}
  </div>
);
