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
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month, custom
  const [sortBy, setSortBy] = useState('date'); // date, amount, category
  const [error, setError] = useState(null);

  // Fetch real data from Supabase
  useEffect(() => {
    const fetchExpensesData = async () => {
      try {
        setLoading(true);

        const isDevelopmentMode = 
          !import.meta.env.VITE_SUPABASE_URL || 
          import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co' ||
          import.meta.env.VITE_DEV_MODE === 'true';

        if (isDevelopmentMode) {
          const mockExpenses = [
            {
              id: 1,
              amount: 500000,
              category: 'events',
              description: 'Company New Year Party',
              expense_date: '2024-01-20',
              receipt_url: null,
              notes: 'Food, decorations, and entertainment',
              created_by: 'Admin',
              amount_reimbursed: 100000,
              net_amount: 400000,
              sharing_status: 'partially_reimbursed'
            },
          ];
          setTimeout(() => {
            setExpenses(mockExpenses);
            setLoading(false);
          }, 1000);
          return;
        }

        const supabaseResponse = await supabase
          .from('expenses')
          .select('*')
          .order('created_at', { ascending: false });

        if (supabaseResponse.error) {
          throw supabaseResponse.error;
        }

        const expensesData = supabaseResponse.data || [];
        const processedExpenses = expensesData.map(expense => ({
          id: expense.id || Date.now(),
          amount: Number(expense.amount || 0),
          category: expense.category || 'other',
          description: expense.description || 'No description',
          expense_date: expense.expense_date || new Date().toISOString().split('T')[0],
          receipt_url: expense.receipt_url || null,
          notes: expense.notes || '',
          created_by: 'Admin',
          created_at: expense.created_at || new Date().toISOString(),
          amount_reimbursed: Number(expense.amount_reimbursed || 0),
          net_amount: Number(expense.net_amount !== null ? expense.net_amount : (expense.amount || 0)),
          sharing_status: expense.sharing_status || 'not_shared'
        }));

        setExpenses(processedExpenses);
        setLoading(false);

      } catch (error) {
        console.error('Error fetching expenses data:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchExpensesData();

    const channel = supabase.channel('expenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (payload) => {
        fetchExpensesData(); // Refetch all data on any change
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Other useEffects remain the same...

  const formatVND = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const getCategoryColor = (category) => {
    const colors = {
      events: 'bg-purple-100 text-purple-800',
      gifts: 'bg-pink-100 text-pink-800',
      office_supplies: 'bg-blue-100 text-blue-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getSharingStatusBadge = (status) => {
    switch (status) {
      case 'shared':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">Đã chia sẻ</span>;
      case 'partially_reimbursed':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Hoàn trả một phần</span>;
      case 'fully_reimbursed':
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Đã hoàn trả</span>;
      case 'not_shared':
      default:
        return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">Chưa chia sẻ</span>;
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    const description = expense.description || '';
    const notes = expense.notes || '';
    const matchesSearch = description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notes.toLowerCase().includes(searchTerm.toLowerCase());
    const category = expense.category || '';
    const matchesCategory = filterCategory === 'all' || category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    switch (sortBy) {
      case 'amount':
        return (b.amount || 0) - (a.amount || 0);
      case 'category':
        return (a.category || '').localeCompare(b.category || '');
      case 'date':
      default:
        return new Date(b.expense_date) - new Date(a.expense_date);
    }
  });

  // The rest of the component logic remains largely the same...

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header and summary cards remain the same */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Expense Records</h3>
          </div>
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
                      <div className="text-sm text-gray-500">{expense.category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">{formatVND(expense.amount)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{formatVND(expense.amount_reimbursed)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">{formatVND(expense.net_amount)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getSharingStatusBadge(expense.sharing_status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button onClick={() => handleEditExpense(expense)} className="text-indigo-600 hover:text-indigo-900 p-1 rounded transition-colors" title="Edit Expense">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteExpense(expense)} className="text-red-600 hover:text-red-900 p-1 rounded transition-colors" title="Delete Expense">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* Modals and other components remain the same */}
        <ExpenseModal
          isOpen={showExpenseModal || showEditForm}
          onClose={() => {
            setShowExpenseModal(false);
            setShowEditForm(false);
            setEditingExpense(null);
          }}
          onSubmit={handleExpenseSubmitEnhanced}
          expense={editingExpense}
          isEditing={!!editingExpense}
        />
      </div>
    </Layout>
  );
};

export default ExpensesPage;