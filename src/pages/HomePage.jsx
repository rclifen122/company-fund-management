import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import PaymentModal from '../components/PaymentModal';
import ExpenseModal from '../components/ExpenseModal';
import { supabase } from '../supabase';
import { DollarSign, TrendingDown, Users, AlertTriangle, PiggyBank, Receipt, Plus, TrendingUp, Bell, Calendar, Eye, Banknote, CreditCard, Target } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

const HomePage = () => {
  const [stats, setStats] = useState({
    totalCollected: 0,
    totalExpenses: 0,
    currentBalance: 0,
    totalEmployees: 0,
    paidThisMonth: 0,
    overdueCount: 0,
    pendingCount: 0,
    completedCount: 0,
    collectionRate: 0,
    expenseRate: 0,
    monthlyGrowth: 0
  });
  const [monthlyData, setMonthlyData] = useState([]);
  const [expensesByCategory, setExpensesByCategory] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Check if we're in development mode
        const isDevelopmentMode = 
          !import.meta.env.VITE_SUPABASE_URL || 
          import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co' ||
          import.meta.env.VITE_DEV_MODE === 'true';

        if (isDevelopmentMode) {
          // Use mock data in development mode
    setStats({
            totalCollected: 1000000,
            totalExpenses: 425000,
            currentBalance: 575000,
            totalEmployees: 12,
            paidThisMonth: 8,
            overdueCount: 2,
            expectedMonthly: 1200000,
            collectionRate: 66.7,
            expenseRate: 42.5,
            monthlyGrowth: 15.2
          });

          setMonthlyData([
            { month: 'T10', collected: 400000, expenses: 120000 },
            { month: 'T11', collected: 450000, expenses: 150000 },
            { month: 'T12', collected: 500000, expenses: 200000 },
            { month: 'T1', collected: 600000, expenses: 180000 },
            { month: 'T2', collected: 700000, expenses: 250000 },
            { month: 'T3', collected: 1000000, expenses: 425000 },
          ]);

          setExpensesByCategory([
            { name: 'Sự kiện', value: 800000, color: '#8B5CF6' },
            { name: 'Quà tặng', value: 350000, color: '#EC4899' },
            { name: 'Văn phòng phẩm', value: 195000, color: '#3B82F6' },
            { name: 'Khác', value: 80000, color: '#6B7280' },
          ]);

          setRecentActivities([
            {
              id: 1,
              type: 'payment',
              description: 'Nguyễn Văn A nộp quỹ tháng 3',
              amount: '+100.000 ₫',
              time: '2 giờ trước',
              status: 'completed'
            },
            {
              id: 2,
              type: 'expense',
              description: 'Chi phí sinh nhật nhân viên',
              amount: '-150.000 ₫',
              time: '5 giờ trước',
              status: 'completed'
            },
            {
              id: 3,
              type: 'payment',
              description: 'Trần Thị B nộp quỹ 3 tháng',
              amount: '+300.000 ₫',
              time: '1 ngày trước',
              status: 'completed'
            },
          ]);

          setEmployees([
            {
              id: 1,
              name: 'Nguyễn Văn A',
              department: 'IT',
              monthly_contribution_amount: 100000
            },
            {
              id: 2,
              name: 'Trần Thị B',
              department: 'HR',
              monthly_contribution_amount: 100000
            },
            {
              id: 3,
              name: 'Lê Văn C',
              department: 'Finance',
              monthly_contribution_amount: 100000
            }
          ]);
          return;
        }

        // Fetch real data from Supabase
        console.log('Fetching real data from Supabase...');

        // Get ALL payments for proper monthly calculation
        const [allPaymentsForChartResponse, recentPaymentsResponse] = await Promise.all([
          supabase.from('fund_payments').select('*'),
          supabase.from('fund_payments').select(`
            *,
            employees (name, department)
          `).order('created_at', { ascending: false }).limit(10)
        ]);

        console.log('All payments response:', allPaymentsForChartResponse);
        console.log('Recent payments response:', recentPaymentsResponse);
        const allPaymentsData = allPaymentsForChartResponse.data || [];
        const recentPaymentsData = recentPaymentsResponse.data || [];
        
        console.log('=== RAW DATA SUMMARY ===');
        console.log('Total payments in database:', allPaymentsData.length, allPaymentsData);
        console.log('Date range of payments:', {
          earliest: allPaymentsData.length > 0 ? Math.min(...allPaymentsData.map(p => new Date(p.payment_date).getTime())) : 'none',
          latest: allPaymentsData.length > 0 ? Math.max(...allPaymentsData.map(p => new Date(p.payment_date).getTime())) : 'none'
        });

        // Calculate fund summary manually to avoid database view dependency
        const [summaryResponse, allEmployeesResponse, allPaymentsForSummaryResponse] = await Promise.all([
          supabase.from('fund_summary').select('*').single(),
          supabase.from('employees').select('id, total_paid, leave_date'),
          supabase.from('fund_payments').select('amount, employee_id') // Get all payments for calculation
        ]);

        console.log('Summary response:', summaryResponse);
        const summaryData = summaryResponse.data;
        const allEmployeesData = allEmployeesResponse.data || [];
        const allPaymentsForSummaryData = allPaymentsForSummaryResponse.data || [];

        console.log('Raw employees data:', allEmployeesData);
        console.log('Raw payments for summary data:', allPaymentsForSummaryData);

        // Calculate correct total fund collection using consistent approach
        // Since employee.total_paid is updated by triggers when payments are made,
        // we should use total_paid for ALL employees (both active and who left)
        const totalCollectedFromAllEmployees = allEmployeesData.reduce((sum, employee) => {
          return sum + (employee.total_paid || 0);
        }, 0);

        const correctedTotalCollected = totalCollectedFromAllEmployees;

        // Get ALL employees (including those who left) for proper status calculation
        const employeesResponse = await supabase
          .from('employees')
          .select('*');

        console.log('Employees response:', employeesResponse);
        const employeesData = employeesResponse.data || [];

        // Get ALL expenses for monthly chart calculation
        const expensesResponse = await supabase
          .from('expenses')
          .select('*');

        console.log('Expenses response:', expensesResponse);
        const expensesData = expensesResponse.data || [];
        const totalSpentNet = (expensesData || []).reduce((sum, e) => sum + Number((e.net_amount ?? e.amount) || 0), 0);
        const correctedCurrentBalance = correctedTotalCollected - totalSpentNet;

        console.log('HomePage fund calculation:', {
          totalEmployees: allEmployeesData.length,
          employeesWithPayments: allEmployeesData.filter(e => e.total_paid > 0).length,
          totalCollectedFromAllEmployees,
          totalSpent: summaryData?.total_spent || 0,
          totalSpentNet,
          correctedCurrentBalance,
          originalFromView: summaryData?.total_collected
        });
        
        console.log('Total expenses in database:', expensesData.length);
        if (expensesData.length > 0) {
          console.log('Expense date range:', {
            earliest: Math.min(...expensesData.map(e => new Date(e.expense_date).getTime())),
            latest: Math.max(...expensesData.map(e => new Date(e.expense_date).getTime()))
          });
        }

        // Process employees data to add payment status (similar to FundCollectionPage)
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const processedEmployees = employeesData?.map(employee => {
          // If employee has left (has leave_date), set status accordingly
          if (employee.leave_date) {
            return {
              ...employee,
              current_month_status: 'completed', // Special status for employees who left
              last_payment_date: employee.leave_date
            };
          }

          // For active employees, calculate payment status
          const employeePayments = allPaymentsData?.filter(p => p.employee_id === employee.id) || [];
          
          // Find latest payment
          const latestPayment = employeePayments
            .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0];

          // Check if current month is covered by any payment
          const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
          const isCurrentMonthCovered = employeePayments.some(payment => {
            return payment.months_covered && payment.months_covered.includes(currentMonthKey);
          });

          // Determine current month status
          let status = 'pending';
          if (isCurrentMonthCovered) {
            status = 'paid';
          } else if (latestPayment) {
            const now = new Date();
            const lastPaymentDate = new Date(latestPayment.payment_date);
            const daysSinceLastPayment = Math.floor(
              (now - lastPaymentDate) / (1000 * 60 * 60 * 24)
            );
            
            if (lastPaymentDate > now) {
              status = 'paid';
            } else if (daysSinceLastPayment > 45) {
              status = 'overdue';
            }
          }

          return {
            ...employee,
            current_month_status: status,
            last_payment_date: latestPayment?.payment_date || null
          };
        }) || [];

        // Calculate employee status counts
        const activeEmployees = processedEmployees.filter(e => !e.leave_date);
        const paidEmployees = activeEmployees.filter(e => e.current_month_status === 'paid').length;
        const pendingEmployees = activeEmployees.filter(e => e.current_month_status === 'pending').length;
        const overdueEmployees = activeEmployees.filter(e => e.current_month_status === 'overdue').length;
        const completedEmployees = processedEmployees.filter(e => e.current_month_status === 'completed').length;

        // Calculate stats - with corrected employee data
        if (employeesData) {
          const newStats = {
            totalCollected: correctedTotalCollected,
            totalExpenses: totalSpentNet,
            currentBalance: correctedCurrentBalance,
            totalEmployees: activeEmployees.length, // Only active employees
            paidThisMonth: paidEmployees,
            overdueCount: overdueEmployees,
            pendingCount: pendingEmployees,
            completedCount: completedEmployees,
            expectedMonthly: activeEmployees.length * 100000,
            collectionRate: activeEmployees.length > 0 ? 
              (paidEmployees / activeEmployees.length) * 100 : 0,
            expenseRate: correctedTotalCollected > 0 ? 
              (totalSpentNet / correctedTotalCollected) * 100 : 0,
            monthlyGrowth: 15.2
          };
          console.log('Setting new stats:', newStats);
          setStats(newStats);
        }

        // Set employees for payment modal
        setEmployees(employeesData || []);

        // Process monthly chart data using ALL payments
        const monthlyChartData = [];
        const today = new Date();
        
        for (let monthNum = 1; monthNum <= 12; monthNum++) {
          // Show all 12 months in calendar order (T1-T12)
          const targetDate = new Date(today.getFullYear(), monthNum - 1, 1);
          const monthKey = `T${monthNum}`;
          const targetMonth = monthNum - 1; // JavaScript months are 0-based
          const targetYear = targetDate.getFullYear();
          
          console.log(`Processing month ${monthKey} (${targetMonth + 1}/${targetYear})`);
          
          // Calculate monthly fund collection from payment_date ONLY
          const monthPayments = (allPaymentsData || []).filter(p => {
            if (!p.payment_date) return false;
            try {
              const paymentDate = new Date(p.payment_date);
              const matches = paymentDate.getMonth() === targetMonth && 
                            paymentDate.getFullYear() === targetYear;
              if (matches) {
                console.log(`Found payment for ${monthKey}:`, p.amount, 'on', p.payment_date);
              }
              return matches;
            } catch (error) {
              console.warn('Error parsing payment date:', p.payment_date, error);
              return false;
            }
          }).reduce((sum, p) => sum + Number(p.amount || 0), 0);
          
          // Calculate monthly expenses from expense_date ONLY (use net_amount when available)
          const monthExpenses = (expensesData || []).filter(e => {
            if (!e.expense_date) return false;
            try {
              const expenseDate = new Date(e.expense_date);
              const matches = expenseDate.getMonth() === targetMonth && 
                            expenseDate.getFullYear() === targetYear;
              if (matches) {
                console.log(`Found expense for ${monthKey}:`, (e.net_amount ?? e.amount), 'on', e.expense_date);
              }
              return matches;
            } catch (error) {
              console.warn('Error parsing expense date:', e.expense_date, error);
              return false;
            }
          }).reduce((sum, e) => sum + Number((e.net_amount ?? e.amount) || 0), 0);

          console.log(`=== ${monthKey} SUMMARY ===`);
          console.log(`Payments found: ${(allPaymentsData || []).filter(p => {
            if (!p.payment_date) return false;
            try {
              const paymentDate = new Date(p.payment_date);
              return paymentDate.getMonth() === targetMonth && paymentDate.getFullYear() === targetYear;
            } catch (error) {
              return false;
            }
          }).length} records`);
          console.log(`Expenses found: ${(expensesData || []).filter(e => {
            if (!e.expense_date) return false;
            try {
              const expenseDate = new Date(e.expense_date);
              return expenseDate.getMonth() === targetMonth && expenseDate.getFullYear() === targetYear;
            } catch (error) {
              return false;
            }
          }).length} records`);
          console.log(`Final totals: collected=${monthPayments}, expenses=${monthExpenses}`);

          monthlyChartData.push({
            month: monthKey,
            collected: monthPayments, // Only use actual payments from fund_payments table
            expenses: monthExpenses   // Only use actual expenses from expenses table
          });
        }
        console.log('Processed monthly chart data:', monthlyChartData);
        setMonthlyData(monthlyChartData);

        // Process expense categories - with null safety
        const categoryData = (expensesData || []).reduce((acc, expense) => {
          if (!expense) return acc;
          const category = expense.category || 'other';
          const amount = Number((expense.net_amount ?? expense.amount) || 0);
          acc[category] = (acc[category] || 0) + amount;
          return acc;
        }, {});

        const categoryColors = {
          events: '#8B5CF6',
          gifts: '#EC4899',
          office_supplies: '#3B82F6',
          other: '#6B7280'
        };

        const categoryLabels = {
          events: 'Sự kiện',
          gifts: 'Quà tặng',
          office_supplies: 'Văn phòng phẩm',
          other: 'Khác'
        };

        const categoryChartData = Object.entries(categoryData).map(([key, value]) => ({
          name: categoryLabels[key] || key,
          value: value,
          color: categoryColors[key] || '#6B7280'
        }));
        console.log('Processed expense category data:', categoryChartData);
        setExpensesByCategory(categoryChartData);

                // Process recent activities - with null safety
        const activities = [];
        
        // Add recent payments
        (recentPaymentsData || []).slice(0, 3).forEach(payment => {
          if (!payment) return;
          try {
            const timeAgo = payment.created_at ? 
              new Date(payment.created_at).toLocaleDateString('vi-VN') : 
              'Unknown time';
            activities.push({
              id: payment.id || Date.now(),
              type: 'payment',
              description: `${payment.employees?.name || 'Unknown Employee'} nộp quỹ`,
              amount: `+${new Intl.NumberFormat('vi-VN').format(payment.amount || 0)} ₫`,
              time: timeAgo,
              status: 'completed'
            });
          } catch (error) {
            console.warn('Error processing payment:', payment, error);
          }
        });
        
        // Add recent expenses  
        (expensesData || []).slice(0, 2).forEach(expense => {
          if (!expense) return;
          try {
            const timeAgo = expense.created_at ? 
              new Date(expense.created_at).toLocaleDateString('vi-VN') : 
              'Unknown time';
            activities.push({
              id: expense.id || Date.now(),
              type: 'expense',
              description: expense.description || 'No description',
              amount: `-${new Intl.NumberFormat('vi-VN').format(expense.amount || 0)} ₫`,
              time: timeAgo,
              status: 'completed'
            });
          } catch (error) {
            console.warn('Error processing expense:', expense, error);
          }
        });

        setRecentActivities(activities);
        setLoading(false);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setLoading(false);
        // Fall back to mock data on error
        setStats({
          totalCollected: 1000000,
          totalExpenses: 425000,
          currentBalance: 575000,
          totalEmployees: 12,
          paidThisMonth: 8,
          overdueCount: 2,
          expectedMonthly: 1200000,
          collectionRate: 66.7,
          expenseRate: 42.5,
          monthlyGrowth: 15.2
        });
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      </Layout>
    );
  }

  const formatVND = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(value);
  };

    // Handle payment submission
  const handlePaymentSubmit = async (paymentData) => {
    try {
      // Check if we're in development mode
      const isDevelopmentMode = 
        !import.meta.env.VITE_SUPABASE_URL || 
        import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co' ||
        import.meta.env.VITE_DEV_MODE === 'true';

      if (isDevelopmentMode) {
        console.log('Payment data (Demo mode):', paymentData);
        alert('Payment recorded successfully! (Demo mode)');
        return;
      }

      // Insert payment into Supabase
      const { data, error } = await supabase
        .from('fund_payments')
        .insert([{
          employee_id: paymentData.employee_id,
          amount: paymentData.amount,
          payment_date: paymentData.payment_date,
          months_covered: paymentData.months_covered,
          payment_method: paymentData.payment_method || 'cash',
          notes: paymentData.notes
        }]);

      if (error) throw error;

      alert('Payment recorded successfully!');
      
      // Refresh the dashboard data
      window.location.reload();
      
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Error recording payment: ' + error.message);
    }
  };

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

      // Prepare payload for insert
      const payload = {
        amount: Number(expenseData.amount || 0),
        category: expenseData.category,
        description: expenseData.description,
        expense_date: expenseData.expense_date,
        notes: expenseData.notes || null,
      };

      // Keep explicit receipt_url if provided. Ignore receipt_file here to avoid unknown column errors.
      if (expenseData.receipt_url) {
        payload.receipt_url = expenseData.receipt_url;
      }

      const { error } = await supabase
        .from('expenses')
        .insert([payload]);

      if (error) throw error;

      alert('Expense recorded successfully!');
      
      // Refresh the dashboard data
      window.location.reload();
      
    } catch (error) {
      console.error('Error recording expense:', error);
      alert('Error recording expense: ' + error.message);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Enhanced Header with Alerts */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bảng Điều Khiển</h1>
          <p className="mt-1 text-sm text-gray-500">
                Tổng quan tình hình tài chính quỹ công ty
              </p>
            </div>
            <div className="flex space-x-3">
              <button 
                onClick={() => navigate('/fund-collection')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nhập Quỹ
              </button>
              <button 
                onClick={() => navigate('/expenses')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nhập Chi Phí
              </button>
            </div>
          </div>

          {/* Alert System */}
          {stats.currentBalance < 200000 && (
            <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-md">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-yellow-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">
                    Cảnh báo: Số dư quỹ thấp
                  </h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Số dư hiện tại ({formatVND(stats.currentBalance)}) đang thấp hơn mức khuyến nghị 200.000 ₫. 
                    Hãy xem xét điều chỉnh chi tiêu hoặc tăng thu quỹ.
                  </p>
                </div>
              </div>
            </div>
          )}

          {stats.overdueCount > 0 && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-400 rounded-md">
              <div className="flex">
                <Bell className="h-5 w-5 text-red-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">
                    Nhắc nhở: Có {stats.overdueCount} nhân viên chưa nộp quỹ
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    Một số nhân viên đã quá hạn nộp quỹ. Hãy liên hệ để nhắc nhở họ.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Tổng Thu Quỹ"
            value={formatVND(stats.totalCollected)}
            change={`+${stats.monthlyGrowth}%`}
            changeType="positive"
            icon={Banknote}
          />
          <StatCard
            title="Tổng Chi Phí"
            value={formatVND(stats.totalExpenses)}
            change={`${stats.expenseRate}% quỹ đã dùng`}
            changeType="negative"
            icon={Receipt}
          />
          <StatCard
            title="Số Dư Hiện Tại"
            value={formatVND(stats.currentBalance)}
            change={stats.currentBalance >= 0 ? "Dương tính" : "Âm tính"}
            changeType={stats.currentBalance >= 0 ? "positive" : "negative"}
            icon={Target}
          />
          <StatCard
            title="Tỷ Lệ Thu Quỹ"
            value={`${Math.round(stats.collectionRate)}%`}
            change={`${stats.paidThisMonth}/${stats.totalEmployees} nhân viên`}
            changeType={stats.collectionRate >= 80 ? "positive" : stats.collectionRate >= 60 ? "neutral" : "negative"}
            icon={Users}
          />
        </div>

        {/* Alert Cards */}
        {(stats.overdueCount > 0 || stats.currentBalance < 200000) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.overdueCount > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                  <div>
                    <h3 className="text-sm font-medium text-red-800">
                      Overdue Payments Alert
                    </h3>
                    <p className="text-sm text-red-700">
                      {stats.overdueCount} employee(s) have overdue payments
                    </p>
                  </div>
                </div>
              </div>
            )}
            {stats.currentBalance < 200000 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mr-2" />
                  <div>
                    <h3 className="text-sm font-medium text-orange-800">
                      Low Balance Warning
                    </h3>
                    <p className="text-sm text-orange-700">
                      Fund balance is running low
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Enhanced Payment Status Overview */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">Tình Trạng Đóng Quỹ Tháng Này</h3>
            <div className="text-sm text-gray-500">
              {new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3">
                <span className="text-2xl font-bold text-green-600">{stats.paidThisMonth || 0}</span>
              </div>
              <p className="text-sm font-medium text-gray-900">Đã Nộp</p>
              <p className="text-xs text-gray-500">Hoàn thành đúng hạn</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-3">
                <span className="text-2xl font-bold text-yellow-600">{stats.pendingCount || 0}</span>
              </div>
              <p className="text-sm font-medium text-gray-900">Chờ Nộp</p>
              <p className="text-xs text-gray-500">Trong thời hạn</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-3">
                <span className="text-2xl font-bold text-red-600">{stats.overdueCount || 0}</span>
              </div>
              <p className="text-sm font-medium text-gray-900">Quá Hạn</p>
              <p className="text-xs text-gray-500">Cần nhắc nhở</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-3">
                <span className="text-2xl font-bold text-blue-600">{stats.completedCount || 0}</span>
              </div>
              <p className="text-sm font-medium text-gray-900">Hoàn Thành</p>
              <p className="text-xs text-gray-500">Đã nghỉ việc</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Tiến độ thu quỹ</span>
              <span>{Math.round(stats.collectionRate)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stats.collectionRate}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Trends Chart */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Monthly Fund Flow
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(value) => [formatVND(value), '']} />
                  <Bar dataKey="collected" name="Thu" fill="#10B981" />
                  <Bar dataKey="expenses" name="Chi" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex justify-center space-x-6">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2" />
                <span className="text-sm text-gray-600">Fund Collected</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2" />
                <span className="text-sm text-gray-600">Expenses</span>
              </div>
            </div>
          </div>

          {/* Expense Categories Chart */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Expenses by Category
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensesByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {expensesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatVND(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {expensesByCategory.map((item, index) => (
                <div key={index} className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-gray-600">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Activities</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {activity.type === 'payment' ? (
                          <PiggyBank className="h-4 w-4 text-green-600 mr-2" />
                        ) : (
                          <Receipt className="h-4 w-4 text-red-600 mr-2" />
                        )}
                      <p className="text-sm font-medium text-gray-900">
                          {activity.type === 'payment' ? 'Fund Collection' : 'Expense'}
                      </p>
                      </div>
                      <p className={`text-sm font-medium ${
                        activity.amount.startsWith('+') ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {activity.amount}
                      </p>
                    </div>
                    <p className="text-sm text-gray-500">{activity.description}</p>
                    <p className="text-xs text-gray-400">{activity.time}</p>
                  </div>
                  <div className="ml-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Completed
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        
      </div>
    </Layout>
  );
};

export default HomePage;
