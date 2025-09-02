import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import ExpenseModal from '../components/ExpenseModal';
import { supabase } from '../supabase';
import { Plus, Receipt, Calendar, DollarSign, TrendingDown, Search, Filter, FileText, PieChart, BarChart3, Eye, Download, Camera, AlertCircle, CheckCircle, Users, Banknote, Edit, Trash2 } from 'lucide-react';

const ExpensesPage = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
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
    Promise.all([
      fetchExpensesData(),
      // Other data fetching can be added here
    ]).finally(() => setLoading(false));

    const channel = supabase.channel('expenses-changes')
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

  const getCategoryColor = (category) => {
    const colors = { events: 'bg-purple-100 text-purple-800', gifts: 'bg-pink-100 text-pink-800', office_supplies: 'bg-blue-100 text-blue-800', other: 'bg-gray-100 text-gray-800' };
    return colors[category] || colors.other;
  };

  const getSharingStatusBadge = (status) => {
    switch (status) {
      case 'shared':
      case 'partially_reimbursed':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Đã chia sẻ</span>;
      case 'fully_reimbursed':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Đã hoàn trả</span>;
      case 'not_shared':
      default:
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Chưa chia sẻ</span>;
    }
  };

  const handleExpenseSubmit = async (expenseData) => {
    const isEditing = !!editingExpense;
    const { data, error } = isEditing
      ? await supabase.from('expenses').update(expenseData).eq('id', editingExpense.id)
      : await supabase.from('expenses').insert([expenseData]);

    if (error) {
      alert('Error saving expense: ' + error.message);
    } else {
      alert(`Expense ${isEditing ? 'updated' : 'recorded'} successfully!`);
      setShowExpenseModal(false);
      setEditingExpense(null);
      fetchExpensesData();
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) alert('Error deleting expense: ' + error.message);
    else alert('Expense deleted successfully!');
  };

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setShowExpenseModal(true);
  };

  const sortedExpenses = [...expenses].sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));

  if (loading) {
    return <Layout><div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div></div></Layout>;
  }

  if (error) {
    return <Layout><div className="p-6"><div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded"><h2>Error</h2><p>{error}</p></div></div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản Lý Chi Phí</h1>
            <p className="mt-1 text-sm text-gray-500">Theo dõi và quản lý các khoản chi tiêu từ quỹ công ty</p>
          </div>
          <button onClick={() => { setEditingExpense(null); setShowExpenseModal(true); }} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-2" />
            Nhập Chi Phí
          </button>
        </div>

        {/* Table */}
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
                {sortedExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(expense.expense_date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{expense.description}</div>
                      <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${getCategoryColor(expense.category)}`}>{expense.category}</div>
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
          onClose={() => setShowExpenseModal(false)}
          onSubmit={handleExpenseSubmit}
          expense={editingExpense}
          isEditing={!!editingExpense}
        />
      </div>
    </Layout>
  );
};

export default ExpensesPage;
