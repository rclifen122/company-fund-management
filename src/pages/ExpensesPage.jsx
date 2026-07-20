import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import PageTransition from '../components/PageTransition';
import ExpenseModal from '../components/ExpenseModal';
import { supabase } from '../supabase';
import { formatVND, formatDate } from '../utils/format';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useFeedback } from '../contexts/feedback';
import { ErrorState, PageSkeleton } from '../components/PageState';
import { isDevelopmentMode } from '../utils/env';
import { DEMO_EXPENSES } from '../utils/demoData';
import { summarizePendingBillFinancials } from '../utils/pendingBillFinancials';

const ExpensesPage = () => {
  const { showToast, confirmAction } = useFeedback();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [error, setError] = useState(null);

  const fetchExpensesData = async () => {
    setError(null);
    try {
      if (isDevelopmentMode()) {
        setExpenses(DEMO_EXPENSES.map((expense) => ({ ...expense })));
        return;
      }
      const [expensesResponse, pendingBillsResponse] = await Promise.all([
        supabase
          .from('expenses')
          .select('*')
          .order('expense_date', { ascending: false }),
        supabase
          .from('bill_sharing')
          .select(`
            bill_sharing_expenses(expense_id, amount),
            bill_sharing_participants(amount_owed, payment_method, payment_status)
          `)
          .eq('status', 'pending'),
      ]);

      if (expensesResponse.error) throw expensesResponse.error;
      if (pendingBillsResponse.error) throw pendingBillsResponse.error;

      const pendingFinancials = summarizePendingBillFinancials(pendingBillsResponse.data || []);

      const processedExpenses = (expensesResponse.data || []).map((expense) => {
        const amount = Number(expense.amount || 0);
        const storedReimbursement = Number(expense.amount_reimbursed || 0);
        const pendingPaidDirect = pendingFinancials.paidDirectByExpense.get(expense.id) || 0;
        const effectiveReimbursement = Math.min(amount, storedReimbursement + pendingPaidDirect);

        return {
          ...expense,
          amount,
          amount_reimbursed: effectiveReimbursement,
          net_amount: amount - effectiveReimbursement,
          sharing_status: expense.sharing_status || 'not_shared'
        };
      });
      setExpenses(processedExpenses);
    } catch (err) {
      console.error('Error fetching expenses data:', err);
      setError(err.message);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchExpensesData()]).finally(() => setLoading(false));

    if (isDevelopmentMode()) return undefined;

    const channel = supabase.channel('expenses-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        fetchExpensesData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bill_sharing_participants' }, () => {
        fetchExpensesData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);



  const getSharingStatusBadge = (status) => {
    const statusStyles = {
      shared: 'bg-blue-100 text-blue-800',
      partially_reimbursed: 'bg-yellow-100 text-yellow-800',
      fully_reimbursed: 'bg-green-100 text-green-800',
      not_shared: 'bg-gray-100 text-gray-800',
    };
    const statusText = {
      shared: 'Đã chia sẻ',
      partially_reimbursed: 'Hoàn trả một phần',
      fully_reimbursed: 'Đã hoàn trả',
      not_shared: 'Chưa chia sẻ',
    };
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[status] || statusStyles.not_shared}`}>{statusText[status] || statusText.not_shared}</span>;
  };

  const handleExpenseSubmit = async (expenseData) => {
    try {
      const isEditing = !!editingExpense;

      // Build payload with only columns that exist in the expenses table
      const payload = {
        amount: Number(expenseData.amount || 0),
        category: expenseData.category,
        description: expenseData.description,
        expense_date: expenseData.expense_date,
        notes: expenseData.notes || null,
      };

      // If a URL was provided explicitly, keep it. Ignore receipt_file here to avoid unknown column errors.
      if (expenseData.receipt_url) {
        // If a URL was provided explicitly, keep it
        payload.receipt_url = expenseData.receipt_url;
      }

      let error;
      if (isDevelopmentMode()) {
        setExpenses((current) => isEditing
          ? current.map((expense) => expense.id === editingExpense.id
            ? { ...expense, ...payload, net_amount: Number(payload.amount) - Number(expense.amount_reimbursed || 0) }
            : expense)
          : [{ id: `demo-expense-${Date.now()}`, ...payload, amount_reimbursed: 0, net_amount: Number(payload.amount), sharing_status: 'not_shared' }, ...current]);
      } else if (isEditing) {
        // Update existing expense
        ({ error } = await supabase.from('expenses').update(payload).eq('id', editingExpense.id));
      } else {
        // Insert new expense
        ({ error } = await supabase.from('expenses').insert([payload]));
      }

      if (error) throw error;

      setShowExpenseModal(false);
      setEditingExpense(null);
      showToast(isEditing ? 'Đã cập nhật chi phí.' : 'Đã thêm chi phí.');
    } catch (err) {
      showToast(`Không thể lưu chi phí: ${err.message}`, 'error');
      throw err;
    }
  };

  const handleDeleteExpense = async (expense) => {
    if (expense.sharing_status !== 'not_shared') {
      showToast('Hãy xoá lần chia tiền liên quan trước khi xoá chi phí này.', 'warning');
      return;
    }
    const accepted = await confirmAction({
      title: 'Xoá chi phí',
      message: `Bạn có chắc muốn xoá “${expense.description}”? Thao tác này không thể hoàn tác.`,
      confirmLabel: 'Xoá chi phí',
    });
    if (!accepted) return;
    if (isDevelopmentMode()) {
      setExpenses((current) => current.filter((item) => item.id !== expense.id));
      showToast('Đã xoá chi phí.');
      return;
    }
    const { error } = await supabase.from('expenses').delete().eq('id', expense.id);
    if (error) showToast(`Không thể xoá chi phí: ${error.message}`, 'error');
    else showToast('Đã xoá chi phí.');
  };

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setShowExpenseModal(true);
  };

  const totalNetExpenses = expenses.reduce((sum, expense) => sum + expense.net_amount, 0);

  if (loading) return <Layout><PageSkeleton rows={6} /></Layout>;
  if (error) return <Layout><ErrorState message={error} onRetry={fetchExpensesData} /></Layout>;

  return (
    <Layout>
      <PageTransition className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quản Lý Chi Phí</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Tổng chi ròng: {formatVND(totalNetExpenses)}</p>
          </div>
          <button onClick={() => { setEditingExpense(null); setShowExpenseModal(true); }} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 transition-all duration-200">
            <Plus className="h-4 w-4 mr-2" />
            Nhập Chi Phí
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-card overflow-hidden">
          <div className="space-y-3 p-4 md:hidden">
            {expenses.length === 0 && <p className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">Chưa có chi phí nào. Hãy nhập khoản chi đầu tiên.</p>}
            {expenses.map((expense) => (
              <article key={expense.id} className="rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{expense.description}</p>
                    <p className="mt-1 text-xs text-gray-500">{formatDate(expense.expense_date)} · {expense.category}</p>
                  </div>
                  {getSharingStatusBadge(expense.sharing_status)}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-gray-500">Tổng tiền</dt><dd className="font-semibold text-gray-900">{formatVND(expense.amount)}</dd></div>
                  <div><dt className="text-xs text-gray-500">Chi phí thực</dt><dd className="font-semibold text-red-600">{formatVND(expense.net_amount)}</dd></div>
                </dl>
                <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-3">
                  <button onClick={() => handleEditExpense(expense)} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700"><Edit className="h-3.5 w-3.5" /> Chỉnh sửa</button>
                  <button onClick={() => handleDeleteExpense(expense)} disabled={expense.sharing_status !== 'not_shared'} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:border-gray-200 disabled:text-gray-400"><Trash2 className="h-3.5 w-3.5" /> Xoá</button>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/80 dark:bg-gray-700/30">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mô Tả</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng Tiền</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Đã Hoàn Lại</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chi Phí Thực</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng Thái</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800/80 divide-y divide-gray-100 dark:divide-gray-700/50">
                {expenses.length === 0 && <tr><td colSpan="7" className="px-6 py-12 text-center text-sm text-gray-500">Chưa có chi phí nào. Hãy nhập khoản chi đầu tiên.</td></tr>}
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(expense.expense_date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{expense.description}</div>
                      <div className="text-xs text-gray-500">{expense.category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">{formatVND(expense.amount)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{formatVND(expense.amount_reimbursed)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">{formatVND(expense.net_amount)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getSharingStatusBadge(expense.sharing_status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button onClick={() => handleEditExpense(expense)} title={expense.sharing_status !== 'not_shared' ? 'Chỉnh thông tin; số tiền đã bị khoá do đã chia' : 'Chỉnh chi phí'} className="text-indigo-600 hover:text-indigo-900 p-1 rounded"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => handleDeleteExpense(expense)} disabled={expense.sharing_status !== 'not_shared'} title={expense.sharing_status !== 'not_shared' ? 'Hãy xoá lần chia tiền trước' : 'Xoá chi phí'} className="text-red-600 hover:text-red-900 p-1 rounded disabled:text-gray-400 disabled:cursor-not-allowed"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <ExpenseModal
          isOpen={showExpenseModal}
          onClose={() => { setShowExpenseModal(false); setEditingExpense(null); }}
          onSubmit={handleExpenseSubmit}
          expense={editingExpense}
          isEditing={!!editingExpense}
          lockAmount={Boolean(editingExpense) && editingExpense.sharing_status !== 'not_shared'}
        />
      </PageTransition>
    </Layout>
  );
};

export default ExpensesPage;
