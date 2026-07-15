import { useCallback, useEffect, useState } from 'react';
import { History, Search } from 'lucide-react';
import Layout from '../components/Layout';
import PageTransition from '../components/PageTransition';
import { ErrorState, PageSkeleton } from '../components/PageState';
import { supabase } from '../supabase';
import { isDevelopmentMode } from '../utils/env';

const DEMO_LOGS = [
  { id: 'demo-1', table_name: 'employees', record_id: 'NV-014', action: 'UPDATE', actor_email: 'mactuananh.work@gmail.com', old_data: { name: 'TRẦN THANH KIM', membership_mode: 'fund' }, new_data: { name: 'TRẦN THANH KIM', membership_mode: 'direct' }, created_at: new Date().toISOString() },
  { id: 'demo-2', table_name: 'fund_payment_reconciliations', record_id: 'DS-072026', action: 'INSERT', actor_email: 'nguyennhi01296161485@gmail.com', old_data: null, new_data: { employee_name: 'ĐẶNG THỊ LAN', month_key: '2026-07', note: 'Đối soát từ bảng theo dõi cũ' }, created_at: new Date(Date.now() - 45 * 60000).toISOString() },
  { id: 'demo-3', table_name: 'expenses', record_id: 'CP-103', action: 'UPDATE', actor_email: 'phuonglinhvi311@gmail.com', old_data: { description: 'Tiệc sinh nhật', amount: 800000 }, new_data: { description: 'Tiệc sinh nhật tháng 7', amount: 850000 }, created_at: new Date(Date.now() - 3 * 3600000).toISOString() },
];

const TABLE_LABELS = {
  employees: 'Nhân viên',
  fund_payments: 'Thu quỹ',
  fund_payment_reconciliations: 'Đối soát lịch sử',
  expenses: 'Chi phí',
  bill_sharing: 'Lần chia tiền',
  bill_sharing_expenses: 'Chi phí được chia',
  bill_sharing_participants: 'Người tham gia chia tiền',
};

const ACTION_LABELS = {
  INSERT: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xoá',
};

const getObjectName = (log) => (
  log.new_data?.name
  || log.old_data?.name
  || log.new_data?.description
  || log.old_data?.description
  || log.new_data?.month_key
  || log.old_data?.month_key
  || log.record_id
  || 'Không xác định'
);

const AuditLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [tableFilter, setTableFilter] = useState('all');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (isDevelopmentMode()) {
      setLogs(DEMO_LOGS);
      setLoading(false);
      return;
    }
    const { data, error: fetchError } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (fetchError) setError(fetchError.message);
    else setLogs(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const normalizedSearch = search.trim().toLocaleLowerCase('vi-VN');
  const filteredLogs = logs.filter((log) => {
    const matchesTable = tableFilter === 'all' || log.table_name === tableFilter;
    const matchesSearch = !normalizedSearch || [
      log.actor_email,
      getObjectName(log),
      TABLE_LABELS[log.table_name],
      ACTION_LABELS[log.action],
    ].some((value) => String(value || '').toLocaleLowerCase('vi-VN').includes(normalizedSearch));
    return matchesTable && matchesSearch;
  });

  return (
    <Layout>
      <PageTransition className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <History className="h-6 w-6 text-indigo-600" /> Nhật Ký Hoạt Động
          </h1>
          <p className="mt-1 text-sm text-gray-500">Theo dõi ai đã thay đổi dữ liệu, nội dung thay đổi và thời điểm thực hiện.</p>
        </div>

        {loading ? <PageSkeleton rows={7} /> : error ? (
          <ErrorState
            title="Chưa thể tải nhật ký hoạt động"
            message="Hãy chạy script V12 trên Supabase, sau đó thử lại."
            onRetry={fetchLogs}
          />
        ) : (
          <>
            <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm người thực hiện hoặc nội dung..." className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm" />
              </div>
              <select value={tableFilter} onChange={(event) => setTableFilter(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="all">Tất cả loại dữ liệu</option>
                {Object.entries(TABLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>

            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <details key={log.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white">{log.actor_email || 'Hệ thống'}</span>
                        <span className="mx-2 text-gray-400">·</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{ACTION_LABELS[log.action] || log.action} {TABLE_LABELS[log.table_name] || log.table_name}</span>
                        <p className="mt-1 text-sm text-gray-500">{getObjectName(log)}</p>
                      </div>
                      <time className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString('vi-VN')}</time>
                    </div>
                  </summary>
                  <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 text-xs lg:grid-cols-2">
                    <pre className="max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 whitespace-pre-wrap">Trước thay đổi:{'\n'}{JSON.stringify(log.old_data, null, 2) || 'Không có'}</pre>
                    <pre className="max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 whitespace-pre-wrap">Sau thay đổi:{'\n'}{JSON.stringify(log.new_data, null, 2) || 'Không có'}</pre>
                  </div>
                </details>
              ))}
              {filteredLogs.length === 0 && <p className="py-10 text-center text-sm text-gray-500">Không tìm thấy hoạt động phù hợp.</p>}
            </div>
          </>
        )}
      </PageTransition>
    </Layout>
  );
};

export default AuditLogPage;
