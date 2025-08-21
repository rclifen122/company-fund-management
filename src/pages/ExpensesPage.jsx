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

  console.log('ExpensesPage rendering - loading:', loading, 'expenses count:', expenses.length);

  // Fetch real data from Supabase
  useEffect(() => {
    const fetchExpensesData = async () => {
      try {
        setLoading(true);

        // Check if we're in development mode
        const isDevelopmentMode = 
          !import.meta.env.VITE_SUPABASE_URL || 
          import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co' ||
          import.meta.env.VITE_DEV_MODE === 'true';

        if (isDevelopmentMode) {
          // Use mock data in development mode
          const mockExpenses = [
            {
              id: 1,
              amount: 500000,
              category: 'events',
              description: 'Company New Year Party',
              expense_date: '2024-01-20',
              receipt_url: null,
              notes: 'Food, decorations, and entertainment',
              created_by: 'Admin'
            },
            {
              id: 2,
              amount: 150000,
              category: 'gifts',
              description: 'Employee Birthday Gifts',
              expense_date: '2024-01-25',
              receipt_url: 'receipt_001.jpg',
              notes: 'Gift cards for January birthdays',
              created_by: 'Admin'
            },
            {
              id: 3,
              amount: 75000,
              category: 'office_supplies',
              description: 'Office Cleaning Supplies',
              expense_date: '2024-01-30',
              receipt_url: 'receipt_002.jpg',
              notes: 'Monthly cleaning supplies purchase',
              created_by: 'Admin'
            }
          ];

          setTimeout(() => {
            setExpenses(mockExpenses);
            setLoading(false);
          }, 1000);
          return;
        }

        // Fetch real data from Supabase
        console.log('Fetching expenses data from Supabase...');

        const supabaseResponse = await supabase
          .from('expenses')
          .select('*')
          .order('created_at', { ascending: false });

        console.log('Supabase response:', supabaseResponse);

        if (supabaseResponse.error) {
          console.error('Supabase error:', supabaseResponse.error);
          throw supabaseResponse.error;
        }

        // Process expenses data with extra safety
        const expensesData = supabaseResponse.data || [];
        console.log('Raw expenses data:', expensesData);

        const processedExpenses = expensesData.map(expense => {
          // Ensure all required fields exist
          return {
            id: expense.id || Date.now(),
            amount: Number(expense.amount || 0),
            category: expense.category || 'other',
            description: expense.description || 'No description',
            expense_date: expense.expense_date || new Date().toISOString().split('T')[0],
            receipt_url: expense.receipt_url || null,
            notes: expense.notes || '',
            created_by: 'Admin',
            created_at: expense.created_at || new Date().toISOString()
          };
        });

        console.log('Processed expenses:', processedExpenses);
        setExpenses(processedExpenses);
        setLoading(false);

      } catch (error) {
        console.error('Error fetching expenses data:', error);
        setError(error.message);
        // Fall back to mock data on error
        const mockExpenses = [
          {
            id: 1,
            amount: 500000,
            category: 'events',
            description: 'Company New Year Party',
            expense_date: '2024-01-20',
            receipt_url: null,
            notes: 'Food, decorations, and entertainment',
            created_by: 'Admin'
          }
        ];
        setExpenses(mockExpenses);
        setLoading(false);
      }
    };

    fetchExpensesData();

    const channel = supabase.channel('expenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (payload) => {
        console.log('Change received!', payload);
        if (payload.eventType === 'INSERT') {
          setExpenses(currentExpenses => [payload.new, ...currentExpenses]);
        }
        if (payload.eventType === 'UPDATE') {
          setExpenses(currentExpenses => currentExpenses.map(expense => 
            expense.id === payload.new.id ? payload.new : expense
          ));
        }
        if (payload.eventType === 'DELETE') {
          setExpenses(currentExpenses => currentExpenses.filter(expense => expense.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Load fund collection data (payments + employee totals)
  useEffect(() => {
    const loadFundCollectionData = async () => {
      try {
        // Check if we're in development mode
        const isDevelopmentMode = 
          !import.meta.env.VITE_SUPABASE_URL || 
          import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co' ||
          import.meta.env.VITE_DEV_MODE === 'true';

        if (isDevelopmentMode) {
          setTotalFundCollected(15000000); // Demo value
          return;
        }

        // Fetch both payments and employees data
        const [paymentsResponse, employeesResponse] = await Promise.all([
          supabase.from('fund_payments').select('amount, employee_id'),
          supabase.from('employees').select('id, total_paid, leave_date')
        ]);

        const paymentsData = paymentsResponse.data || [];
        const employeesData = employeesResponse.data || [];

        // Calculate total avoiding double counting
        // For employees who left (have leave_date), use their calculated total_paid
        const employeesWhoLeft = employeesData.filter(e => e.leave_date);
        const totalsFromLeavers = employeesWhoLeft.reduce((sum, employee) => {
          return sum + (employee.total_paid || 0);
        }, 0);

        // For active employees, use manual payments (avoid double counting with leavers)
        const leaverIds = employeesWhoLeft.map(e => e.id);
        const paymentsFromActiveEmployees = paymentsData
          .filter(p => !leaverIds.includes(p.employee_id))
          .reduce((sum, payment) => sum + (payment.amount || 0), 0);

        const total = totalsFromLeavers + paymentsFromActiveEmployees;

        console.log('ExpensesPage fund calculation:', {
          employeesWhoLeft: employeesWhoLeft.length,
          totalsFromLeavers,
          paymentsFromActiveEmployees,
          total
        });

        setTotalFundCollected(total);
        
      } catch (error) {
        console.error('Error loading fund collection data:', error);
        setTotalFundCollected(0);
      }
    };

    loadFundCollectionData();
  }, []);

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

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'events': return <Calendar className="h-4 w-4" />;
      case 'gifts': return <Users className="h-4 w-4" />;
      case 'office_supplies': return <FileText className="h-4 w-4" />;
      case 'other': return <DollarSign className="h-4 w-4" />;
      default: return <Receipt className="h-4 w-4" />;
    }
  };

  const getCategoryLabel = (category) => {
    switch (category) {
      case 'events': return 'Sự kiện';
      case 'gifts': return 'Quà tặng';
      case 'office_supplies': return 'Văn phòng phẩm';
      case 'other': return 'Khác';
      default: return category;
    }
  };

  // Add missing getCategoryName function
  const getCategoryName = (category) => {
    return getCategoryLabel(category);
  };



  // Enhanced Expense Calculations - with null safety
  const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  
  // Current month calculations - with null safety
  const currentMonthExpenses = expenses
    .filter(e => {
      if (!e.expense_date) return false;
      try {
        const expenseDate = new Date(e.expense_date);
        const today = new Date();
        return expenseDate.getMonth() === today.getMonth() && 
               expenseDate.getFullYear() === today.getFullYear();
      } catch (error) {
        console.warn('Invalid date format:', e.expense_date);
        return false;
      }
    })
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Category breakdown - with null safety
  const expensesByCategory = expenses.reduce((acc, expense) => {
    const category = expense.category || 'other';
    const amount = expense.amount || 0;
    acc[category] = (acc[category] || 0) + amount;
    return acc;
  }, {});

  // Monthly trends (last 6 months)
  const monthlyExpenses = Array.from({length: 6}, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      month: date.toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' }),
      amount: expenses
        .filter(e => {
          if (!e.expense_date) return false;
          try {
            const expenseDate = new Date(e.expense_date);
            return expenseDate.getMonth() === date.getMonth() && 
                   expenseDate.getFullYear() === date.getFullYear();
          } catch (error) {
            return false;
          }
        })
        .reduce((sum, e) => sum + (e.amount || 0), 0)
    };
  }).reverse();

  // Enhanced filtering
  const filteredExpenses = expenses.filter(expense => {
    // Text search - with null safety
    const description = expense.description || '';
    const notes = expense.notes || '';
    const matchesSearch = description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notes.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Category filter - with null safety
    const category = expense.category || '';
    const matchesCategory = filterCategory === 'all' || category === filterCategory;
    
    // Date filter - with null safety
    let matchesDate = true;
    if (expense.expense_date && dateFilter !== 'all') {
      try {
        const expenseDate = new Date(expense.expense_date);
        const today = new Date();
        const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        if (dateFilter === 'today') {
          matchesDate = expenseDate.toDateString() === today.toDateString();
        } else if (dateFilter === 'week') {
          matchesDate = expenseDate >= oneWeekAgo;
        } else if (dateFilter === 'month') {
          matchesDate = expenseDate >= oneMonthAgo;
        }
      } catch (error) {
        console.warn('Invalid date format in filter:', expense.expense_date);
        matchesDate = false;
      }
    }
    
    return matchesSearch && matchesCategory && matchesDate;
  });

  // Sort expenses - with null safety
  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    switch (sortBy) {
      case 'amount':
        const amountA = a.amount || 0;
        const amountB = b.amount || 0;
        return amountB - amountA;
      case 'category':
        const categoryA = a.category || '';
        const categoryB = b.category || '';
        return categoryA.localeCompare(categoryB);
      case 'date':
      default:
        try {
          const dateA = a.expense_date ? new Date(a.expense_date) : new Date(0);
          const dateB = b.expense_date ? new Date(b.expense_date) : new Date(0);
          return dateB - dateA;
        } catch (error) {
          return 0;
        }
    }
  });

  // Financial calculations - integrate with fund collection data
  // Calculate total fund collected from both manual payments and employee totals
  const [totalFundCollected, setTotalFundCollected] = useState(0);
  const remainingBalance = totalFundCollected - totalExpenses;
  const expenseRate = totalFundCollected > 0 ? (totalExpenses / totalFundCollected) * 100 : 0;
  const averageExpenseAmount = expenses.length > 0 ? totalExpenses / expenses.length : 0;

  // Handle expense submission
  const handleExpenseSubmit = async (expenseData) => {
    try {
      // Check if we're in development mode
      const isDevelopmentMode = 
        !import.meta.env.VITE_SUPABASE_URL || 
        import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co' ||
        import.meta.env.VITE_DEV_MODE === 'true';

      if (isDevelopmentMode) {
        console.log('Expense data (Demo mode):', expenseData);
        alert('Expense recorded successfully! (Demo mode)');
        return;
      }

      // Insert expense into Supabase
      const { data, error } = await supabase
        .from('expenses')
        .insert([{
          amount: expenseData.amount,
          category: expenseData.category,
          description: expenseData.description,
          expense_date: expenseData.expense_date,
          notes: expenseData.notes,
          receipt_url: expenseData.receipt_url || null
        }]);

      if (error) throw error;

      alert('Expense recorded successfully!');
      
    } catch (error) {
      console.error('Error recording expense:', error);
      alert('Error recording expense: ' + error.message);
    }
  };

  // Handle edit expense
  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setShowEditForm(true);
  };

  // Handle delete expense
  const handleDeleteExpense = async (expense) => {
    if (!confirm(`Are you sure you want to delete this expense: "${expense.description}"?`)) {
      return;
    }

    try {
      // Check if we're in development mode
      const isDevelopmentMode = 
        !import.meta.env.VITE_SUPABASE_URL || 
        import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co' ||
        import.meta.env.VITE_DEV_MODE === 'true';

      if (isDevelopmentMode) {
        console.log('Delete expense (Demo mode):', expense);
        alert('Expense deleted successfully! (Demo mode)');
        return;
      }

      // Delete expense from Supabase
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expense.id);

      if (error) throw error;

      alert('Expense deleted successfully!');
      
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Error deleting expense: ' + error.message);
    }
  };

  // Enhanced handleExpenseSubmit to support both create and update
  const handleExpenseSubmitEnhanced = async (expenseData) => {
    try {
      // Check if we're in development mode
      const isDevelopmentMode = 
        !import.meta.env.VITE_SUPABASE_URL || 
        import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co' ||
        import.meta.env.VITE_DEV_MODE === 'true';

      if (isDevelopmentMode) {
        console.log(`${editingExpense ? 'Update' : 'Create'} expense (Demo mode):`, expenseData);
        alert(`Expense ${editingExpense ? 'updated' : 'recorded'} successfully! (Demo mode)`);
        return;
      }

      if (editingExpense) {
        // Update existing expense
        const { error } = await supabase
          .from('expenses')
          .update({
            amount: expenseData.amount,
            category: expenseData.category,
            description: expenseData.description,
            expense_date: expenseData.expense_date,
            notes: expenseData.notes,
            receipt_url: expenseData.receipt_url || null
          })
          .eq('id', editingExpense.id);

        if (error) throw error;
        alert('Expense updated successfully!');
      } else {
        // Insert new expense
        const { error } = await supabase
          .from('expenses')
          .insert([{
            amount: expenseData.amount,
            category: expenseData.category,
            description: expenseData.description,
            expense_date: expenseData.expense_date,
            notes: expenseData.notes,
            receipt_url: expenseData.receipt_url || null
          }]);

        if (error) throw error;
        alert('Expense recorded successfully!');
      }

      // Reset edit state and close modal
      setEditingExpense(null);
      setShowEditForm(false);
      setShowExpenseModal(false);
      
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Error saving expense: ' + error.message);
    }
  };

  if (error) {
    return (
      <Layout>
        <div className="p-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <h2 className="font-bold">Error Loading Expenses Page</h2>
            <p>{error}</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản Lý Chi Phí</h1>
            <p className="mt-1 text-sm text-gray-500">
              Theo dõi và quản lý các khoản chi tiêu từ quỹ công ty
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowExpenseModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nhập Chi Phí
            </button>
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              <Download className="h-4 w-4 mr-2" />
              Xuất Excel
            </button>
          </div>
        </div>

        {/* Enhanced Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tổng Quỹ</p>
                <p className="text-2xl font-bold text-gray-900 currency-vnd">
                  {formatVND(totalFundCollected)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Quỹ khả dụng
                </p>
              </div>
              <Banknote className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tổng Chi</p>
                <p className="text-2xl font-bold text-gray-900 currency-vnd">
                  {formatVND(totalExpenses)}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  {Math.round(expenseRate)}% quỹ đã dùng
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tháng Này</p>
                <p className="text-2xl font-bold text-gray-900 currency-vnd">
                  {formatVND(currentMonthExpenses)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {expenses.filter(e => {
                    const expenseDate = new Date(e.expense_date);
                    const today = new Date();
                    return expenseDate.getMonth() === today.getMonth() && 
                           expenseDate.getFullYear() === today.getFullYear();
                  }).length} giao dịch
                </p>
              </div>
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Số Dư</p>
                <p className={`text-2xl font-bold currency-vnd ${remainingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatVND(remainingBalance)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {remainingBalance >= 0 ? 'Còn lại' : 'Vượt quỹ'}
                </p>
              </div>
              <Receipt className={`h-8 w-8 ${remainingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </div>
        </div>

        {/* Enhanced Category Breakdown */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Chi Tiêu Theo Danh Mục</h3>
            <div className="text-sm text-gray-500">
              {Object.keys(expensesByCategory).length} danh mục
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {Object.entries(expensesByCategory).map(([category, amount]) => (
              <div key={category} className="text-center">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 ${getCategoryColor(category)}`}>
                  {getCategoryIcon(category)}
                </div>
                <p className="text-sm font-medium text-gray-900">{getCategoryLabel(category)}</p>
                <p className="text-lg font-bold text-gray-900 currency-vnd">{formatVND(amount)}</p>
                <p className="text-xs text-gray-500">
                  {((amount / totalExpenses) * 100).toFixed(1)}% tổng chi
                </p>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-1">
                    <div 
                      className="bg-indigo-600 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${(amount / totalExpenses) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
            {Object.keys(expensesByCategory).length === 0 && (
              <div className="col-span-4 text-center py-8">
                <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Chưa có chi tiêu nào</p>
                <p className="text-xs text-gray-400">Bắt đầu thêm chi tiêu để xem phân tích</p>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Filters */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm chi tiêu, mô tả..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">Tất cả danh mục</option>
                <option value="events">Sự kiện</option>
                <option value="gifts">Quà tặng</option>
                <option value="office_supplies">Văn phòng phẩm</option>
                <option value="other">Khác</option>
              </select>

              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">Tất cả thời gian</option>
                <option value="today">Hôm nay</option>
                <option value="week">7 ngày qua</option>
                <option value="month">30 ngày qua</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="date">Sắp xếp: Ngày</option>
                <option value="amount">Sắp xếp: Số tiền</option>
                <option value="category">Sắp xếp: Danh mục</option>
              </select>

              {(filterCategory !== 'all' || dateFilter !== 'all' || searchTerm || sortBy !== 'date') && (
                <button
                  onClick={() => {
                    setFilterCategory('all');
                    setDateFilter('all');
                    setSearchTerm('');
                    setSortBy('date');
                  }}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          </div>
          
          <div className="mt-4 flex justify-between items-center text-sm text-gray-500">
            <span>Hiển thị {sortedExpenses.length} trên {expenses.length} chi tiêu</span>
            <span>Tổng: {formatVND(sortedExpenses.reduce((sum, e) => sum + e.amount, 0))}</span>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Expense Records</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receipt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(expense.expense_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(expense.category)}`}>
                        <span className="mr-1">{getCategoryIcon(expense.category)}</span>
                        {getCategoryName(expense.category)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {expense.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                      -{formatVND(expense.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.receipt_url ? (
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 text-green-500 mr-1" />
                          <span className="text-green-600">Available</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">No receipt</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {expense.notes}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleEditExpense(expense)}
                          className="text-indigo-600 hover:text-indigo-900 p-1 rounded transition-colors"
                          title="Edit Expense"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteExpense(expense)}
                          className="text-red-600 hover:text-red-900 p-1 rounded transition-colors"
                          title="Delete Expense"
                        >
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

        {filteredExpenses.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg">No expenses found</div>
            <p className="text-gray-500 mt-2">Try adjusting your search or filter criteria</p>
          </div>
        )}

        {/* Monthly Spending Trend - Placeholder for future chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Spending Trends</h3>
          <div className="text-center py-8 text-gray-500">
            <Receipt className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>Chart visualization will be implemented with Recharts</p>
            <p className="text-sm">Monthly expense trends and category breakdowns</p>
          </div>
        </div>

        {/* Create Expense Modal */}
        <ExpenseModal
          isOpen={showExpenseModal}
          onClose={() => setShowExpenseModal(false)}
          onSubmit={handleExpenseSubmitEnhanced}
        />

        {/* Edit Expense Modal */}
        <ExpenseModal
          isOpen={showEditForm}
          onClose={() => {
            setShowEditForm(false);
            setEditingExpense(null);
          }}
          onSubmit={handleExpenseSubmitEnhanced}
          expense={editingExpense}
          isEditing={true}
        />
      </div>
    </Layout>
  );
};

export default ExpensesPage;
