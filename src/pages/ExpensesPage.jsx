import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import ExpenseModal from '../components/ExpenseModal';
import { supabase } from '../supabase';
import { Plus, Receipt, Calendar, DollarSign, TrendingDown, Search, Filter, FileText, Edit, Trash2, Banknote } from 'lucide-react';

const ExpensesPage = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [error, setError] = useState(null);
  const [totalFundCollected, setTotalFundCollected] = useState(0);

  const fetchExpensesData = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });

      if (error) throw error;

      const processedExpenses = (data || []).map(expense => ({
        ...expense,
        amount: Number(expense.amount || 0),
        amount_reimbursed: Number(expense.amount_reimbursed || 0),
        net_amount: Number(expense.net_amount !== null ? expense.net_amount : (expense.amount || 0)),
        sharing_status: expense.sharing_status || 'not_shared'
      }));
      setExpenses(processedExpenses);
    } catch (err) {
      console.error('Error fetching expenses data:', err);
      setError(err.message);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchExpensesData()]).finally(() => setLoading(false));

    const channel = supabase.channel('expenses-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, payload => {
        fetchExpensesData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const formatVND = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('vi-VN');

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
      if (isEditing) {
        // Update existing expense
        ({ error } = await supabase.from('expenses').update(payload).eq('id', editingExpense.id));
      } else {
        // Insert new expense
        ({ error } = await supabase.from('expenses').insert([payload]));
      }

      if (error) throw error;

      setShowExpenseModal(false);
      setEditingExpense(null);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm('Are you sure?')) return;
    await supabase.from('expenses').delete().eq('id', expenseId);
  };

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setShowExpenseModal(true);
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalNetExpenses = expenses.reduce((sum, expense) => sum + expense.net_amount, 0);

  if (loading) return <Layout><div>Loading...</div></Layout>;
  if (error) return <Layout><div>Error: {error}</div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản Lý Chi Phí</h1>
            <p className="mt-1 text-sm text-gray-500">Tổng chi ròng: {formatVND(totalNetExpenses)}</p>
          </div>
          <button onClick={() => { setEditingExpense(null); setShowExpenseModal(true); }} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-2" />
            Nhập Chi Phí
          </button>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reimbursed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
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
                        <button onClick={() => handleEditExpense(expense)} className="text-indigo-600 hover:text-indigo-900 p-1 rounded"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => handleDeleteExpense(expense.id)} className="text-red-600 hover:text-red-900 p-1 rounded"><Trash2 className="h-4 w-4" /></button>
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
        />
      </div>
    </Layout>
  );
};

export default ExpensesPage;
