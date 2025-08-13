import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import PaymentModal from '../components/PaymentModal';
import { supabase } from '../supabase';
import { Plus, Calendar, TrendingUp, Users, PiggyBank, Search, Filter, Eye, Download, CreditCard, Banknote, Smartphone, CheckCircle, Clock, AlertTriangle, UserCheck } from 'lucide-react';

const FundCollectionPage = () => {
  const [payments, setPayments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all'); // all, cash, bank_transfer, e_wallet
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month, custom
  const [monthFilter, setMonthFilter] = useState('all'); // all, T1, T2, T3... T12
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  // Fetch real data from Supabase
  useEffect(() => {
    const fetchFundCollectionData = async () => {
      try {
        setLoading(true);

        // Check if we're in development mode
        const isDevelopmentMode = 
          !import.meta.env.VITE_SUPABASE_URL || 
          import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co' ||
          import.meta.env.VITE_DEV_MODE === 'true';

        if (isDevelopmentMode) {
          // Use mock data in development mode
          const mockEmployees = [
            {
              id: 1,
              name: 'Nguyễn Văn A',
              department: 'IT',
              monthly_contribution: 100000,
              total_paid: 300000,
              current_month_status: 'paid',
              last_payment_date: '2024-01-05'
            },
            {
              id: 2,
              name: 'Trần Thị B',
              department: 'HR',
              monthly_contribution: 100000,
              total_paid: 200000,
              current_month_status: 'pending',
              last_payment_date: '2023-12-05'
            },
            {
              id: 3,
              name: 'Lê Văn C',
              department: 'Finance',
              monthly_contribution: 100000,
              total_paid: 400000,
              current_month_status: 'paid',
              last_payment_date: '2024-01-03'
            },
            {
              id: 4,
              name: 'Phạm Thị D',
              department: 'Marketing',
              monthly_contribution: 100000,
              total_paid: 100000,
              current_month_status: 'overdue',
              last_payment_date: '2023-11-15'
            }
          ];

          const mockPayments = [
            {
              id: 1,
              employee_id: 1,
              employee_name: 'Nguyễn Văn A',
              employee_department: 'IT',
              amount: 300000,
              payment_date: '2024-01-05',
              months_covered: ['2024-01', '2024-02', '2024-03'],
              payment_method: 'cash',
              notes: 'Thanh toán 3 tháng',
              recorded_by: 'Admin',
              created_at: '2024-01-05T10:30:00Z'
            },
            {
              id: 2,
              employee_id: 3,
              employee_name: 'Lê Văn C',
              employee_department: 'Finance',
              amount: 100000,
              payment_date: '2024-01-03',
              months_covered: ['2024-01'],
              payment_method: 'bank_transfer',
              notes: 'Thanh toán tháng 1',
              recorded_by: 'Admin',
              created_at: '2024-01-03T14:15:00Z'
            }
          ];

          setTimeout(() => {
            setEmployees(mockEmployees);
            setPayments(mockPayments);
            setLoading(false);
          }, 1000);
          return;
        }

        // Fetch real data from Supabase
        console.log('Fetching fund collection data from Supabase...');

        // Get ALL employees (including those who left)
        const employeesResponse = await supabase
          .from('employees')
          .select('*');

        console.log('Employees response:', employeesResponse);
        if (employeesResponse.error) {
          console.error('Employees error:', employeesResponse.error);
          throw employeesResponse.error;
        }

        // Get payments with employee info
        const paymentsResponse = await supabase
          .from('fund_payments')
          .select(`
            *,
            employees (name, department)
          `)
          .order('created_at', { ascending: false });

        console.log('Payments response:', paymentsResponse);
        if (paymentsResponse.error) {
          console.error('Payments error:', paymentsResponse.error);
          throw paymentsResponse.error;
        }

        const employeesData = employeesResponse.data || [];
        const paymentsData = paymentsResponse.data || [];

        // Process employees data to add payment status
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const processedEmployees = employeesData?.map(employee => {
          // If employee has left (has leave_date), set status accordingly
          if (employee.leave_date) {
            return {
              ...employee,
              monthly_contribution: Number(employee.monthly_contribution_amount),
              total_paid: Number(employee.total_paid),
              current_month_status: 'completed', // Special status for employees who left
              last_payment_date: employee.leave_date
            };
          }

          // For active employees, calculate payment status
          // Get all payments for this employee
          const employeePayments = paymentsData?.filter(p => p.employee_id === employee.id) || [];
          
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
            
            console.log(`Employee ${employee.name}:`, {
              lastPaymentDate: latestPayment.payment_date,
              daysSinceLastPayment,
              currentDate: now.toISOString().split('T')[0],
              currentMonthKey,
              isCurrentMonthCovered,
              monthsCovered: employeePayments.map(p => p.months_covered).flat()
            });
            
            // If payment date is in the future, consider it current
            if (lastPaymentDate > now) {
              status = 'paid';
            } else if (daysSinceLastPayment > 45) {
              status = 'overdue';
            }
          }

          return {
            ...employee,
            monthly_contribution: Number(employee.monthly_contribution_amount),
            total_paid: Number(employee.total_paid),
            current_month_status: status,
            last_payment_date: latestPayment?.payment_date || null
          };
        }) || [];

        // Process payments data to add employee info
        const processedPayments = paymentsData?.map(payment => ({
          ...payment,
          employee_name: payment.employees?.name || 'Unknown',
          employee_department: payment.employees?.department || 'Unknown',
          amount: Number(payment.amount),
          recorded_by: 'Admin' // Will be dynamic in future
        })) || [];

        setEmployees(processedEmployees);
        setPayments(processedPayments);
        setLoading(false);

      } catch (error) {
        console.error('Error fetching fund collection data:', error);
        // Fall back to mock data on error
        const mockEmployees = [
          {
            id: 1,
            name: 'Nguyễn Văn A',
            department: 'IT',
            monthly_contribution: 100000,
            total_paid: 300000,
            current_month_status: 'paid',
            last_payment_date: '2024-01-05'
          }
        ];
        setEmployees(mockEmployees);
        setPayments([]);
        setLoading(false);
      }
    };

    fetchFundCollectionData();
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

  const getPaymentStatusColor = (status) => {
    const colors = {
      paid: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      overdue: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800' // For employees who left
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getDepartmentColor = (department) => {
    const colors = {
      'IT': 'bg-blue-100 text-blue-800',
      'HR': 'bg-purple-100 text-purple-800',
      'Finance': 'bg-green-100 text-green-800',
      'Marketing': 'bg-pink-100 text-pink-800',
      'Sales': 'bg-orange-100 text-orange-800'
    };
    return colors[department] || 'bg-gray-100 text-gray-800';
  };

  // Enhanced Fund Calculations
  // Avoid double counting: Use calculated totals for employees who left, manual payments for active employees
  console.log('Calculating total fund collection...');
  console.log('Employees data:', employees.map(e => ({ name: e.name, status: e.status, total_paid: e.total_paid, leave_date: e.leave_date })));
  console.log('Payments data:', payments.map(p => ({ employee_name: p.employee_name, amount: p.amount })));
  
  // For employees who left (have leave_date), use their calculated total_paid
  const employeesWhoLeft = employees.filter(e => e.leave_date);
  const totalsFromLeavers = employeesWhoLeft.reduce((sum, employee) => {
    const total = employee.total_paid || 0;
    console.log(`Employee who left: ${employee.name}, total_paid: ${total}`);
    return sum + total;
  }, 0);
  
  // For active employees, use manual payments (avoid double counting with leavers)
  const activeEmployeeIds = employees.filter(e => !e.leave_date).map(e => e.id);
  const paymentsFromActiveEmployees = payments
    .filter(p => !employeesWhoLeft.find(emp => emp.id === p.employee_id))
    .reduce((sum, payment) => {
      console.log(`Payment from active employee: ${payment.employee_name}, amount: ${payment.amount}`);
      return sum + payment.amount;
    }, 0);
  
  const totalCollected = totalsFromLeavers + paymentsFromActiveEmployees;
  
  console.log('Calculation breakdown:', {
    totalsFromLeavers,
    paymentsFromActiveEmployees,
    totalCollected
  });
  
  const currentMonthCollected = payments
    .filter(p => new Date(p.payment_date).getMonth() === new Date().getMonth() && 
                 new Date(p.payment_date).getFullYear() === new Date().getFullYear())
    .reduce((sum, p) => sum + p.amount, 0);
  
  // Employee status calculations (exclude employees who left)
  const activeEmployees = employees.filter(e => !e.leave_date); // Only count active employees
  const paidEmployees = activeEmployees.filter(e => e.current_month_status === 'paid').length;
  const pendingEmployees = activeEmployees.filter(e => e.current_month_status === 'pending').length;
  const overdueEmployees = activeEmployees.filter(e => e.current_month_status === 'overdue').length;
  const completedEmployees = employees.filter(e => e.current_month_status === 'completed').length;
  
  // Advanced calculations (based on active employees only)
  const expectedMonthlyTotal = activeEmployees.length * 100000; // Default 100k VND per active employee
  const collectionRate = activeEmployees.length > 0 ? (paidEmployees / activeEmployees.length) * 100 : 0;
  const averagePaymentAmount = payments.length > 0 ? totalCollected / payments.length : 0;
  const totalOutstanding = pendingEmployees * 100000 + overdueEmployees * 100000;
  
  // Monthly trend calculation (last 6 months)
  const last6Months = Array.from({length: 6}, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      month: date.toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' }),
      collected: payments
        .filter(p => {
          const paymentDate = new Date(p.payment_date);
          return paymentDate.getMonth() === date.getMonth() && 
                 paymentDate.getFullYear() === date.getFullYear();
        })
        .reduce((sum, p) => sum + p.amount, 0)
    };
  }).reverse();
  
  // Payment method distribution
  const paymentMethodStats = {
    cash: payments.filter(p => p.payment_method === 'cash').reduce((sum, p) => sum + p.amount, 0),
    bank_transfer: payments.filter(p => p.payment_method === 'bank_transfer').reduce((sum, p) => sum + p.amount, 0),
    e_wallet: payments.filter(p => p.payment_method === 'e_wallet').reduce((sum, p) => sum + p.amount, 0)
  };

  const filteredEmployees = employees.filter(employee => {
    return employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           employee.department.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Filter payments based on search and filters - with null safety
  const filteredPayments = payments.filter(payment => {
    if (!payment) return false;
    
    // Text search - with null safety
    const employeeName = payment.employee_name || '';
    const employeeDepartment = payment.employee_department || '';
    const notes = payment.notes || '';
    const matchesSearch = searchTerm === '' ||
                         employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employeeDepartment.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notes.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Payment method filter
    const paymentMethod = payment.payment_method || '';
    const matchesPaymentMethod = paymentFilter === 'all' || paymentMethod === paymentFilter;
    
    // Employee filter - UUID string comparison
    const matchesEmployee = selectedEmployeeId === null || 
                           String(payment.employee_id) === String(selectedEmployeeId);
    
    // Date filter - with null safety
    let matchesDate = true;
    if (payment.payment_date && dateFilter !== 'all') {
      try {
        const paymentDate = new Date(payment.payment_date);
        const today = new Date();
        const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        if (dateFilter === 'today') {
          matchesDate = paymentDate.toDateString() === today.toDateString();
        } else if (dateFilter === 'week') {
          matchesDate = paymentDate >= oneWeekAgo;
        } else if (dateFilter === 'month') {
          matchesDate = paymentDate >= oneMonthAgo;
        }
      } catch (error) {
        console.warn('Invalid payment date:', payment.payment_date);
        matchesDate = false;
      }
    }

    // Month filter (T1-T12) - with null safety
    let matchesMonth = true;
    if (payment.payment_date && monthFilter !== 'all') {
      try {
        const paymentDate = new Date(payment.payment_date);
        const paymentMonth = paymentDate.getMonth() + 1; // JavaScript months are 0-based
        const selectedMonth = parseInt(monthFilter.replace('T', '')); // Convert T1 to 1, T2 to 2, etc.
        matchesMonth = paymentMonth === selectedMonth;
      } catch (error) {
        console.warn('Invalid payment date for month filter:', payment.payment_date);
        matchesMonth = false;
      }
    }
    
    console.log(`Filter debug for payment ${payment.id}:`, {
      employeeName,
      searchTerm,
      matchesSearch,
      paymentMethod,
      paymentFilter,
      matchesPaymentMethod,
      paymentEmployeeId: payment.employee_id,
      paymentEmployeeIdType: typeof payment.employee_id,
      selectedEmployeeId,
      selectedEmployeeIdType: typeof selectedEmployeeId,
      matchesEmployee,
      dateFilter,
      matchesDate,
      monthFilter,
      matchesMonth,
      finalResult: matchesSearch && matchesPaymentMethod && matchesEmployee && matchesDate && matchesMonth
    });
    
    return matchesSearch && matchesPaymentMethod && matchesEmployee && matchesDate && matchesMonth;
  });

  // Payment method icon mapping
  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'cash': return <Banknote className="h-4 w-4 text-green-600" />;
      case 'bank_transfer': return <CreditCard className="h-4 w-4 text-blue-600" />;
      case 'e_wallet': return <Smartphone className="h-4 w-4 text-purple-600" />;
      default: return <CreditCard className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPaymentMethodLabel = (method) => {
    switch (method) {
      case 'cash': return 'Tiền mặt';
      case 'bank_transfer': return 'Chuyển khoản';
      case 'e_wallet': return 'Ví điện tử';
      default: return method;
    }
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
      
      // Refresh the page data
      window.location.reload();
      
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Error recording payment: ' + error.message);
    }
  };

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
            <h1 className="text-2xl font-bold text-gray-900">Fund Collection</h1>
            <p className="mt-1 text-sm text-gray-500">
              Track employee contributions and fund collection status
            </p>
          </div>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nhập Quỹ
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tổng Thu Được</p>
                <p className="text-2xl font-bold text-gray-900 currency-vnd">
                  {formatVND(totalCollected)}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  +{formatVND(currentMonthCollected)} tháng này
                </p>
              </div>
              <PiggyBank className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tháng Hiện Tại</p>
                <p className="text-2xl font-bold text-gray-900 currency-vnd">
                  {formatVND(currentMonthCollected)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  / {formatVND(expectedMonthlyTotal)} dự kiến
                </p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tỷ Lệ Thu</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round(collectionRate)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {paidEmployees}/{activeEmployees.length} nhân viên hoạt động
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-indigo-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Chưa Thu</p>
                <p className="text-2xl font-bold text-gray-900 currency-vnd">
                  {formatVND(totalOutstanding)}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  {pendingEmployees + overdueEmployees} nhân viên
                </p>
              </div>
              <Users className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>

        {/* Enhanced Status Overview */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Tình Trạng Đóng Quỹ</h3>
            <div className="text-sm text-gray-500">
              Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-600">{paidEmployees}</div>
              <p className="text-sm font-medium text-gray-900">Đã Nộp</p>
              <p className="text-xs text-gray-500">Đã hoàn thành</p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-3">
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="text-2xl font-bold text-yellow-600">{pendingEmployees}</div>
              <p className="text-sm font-medium text-gray-900">Chờ Nộp</p>
              <p className="text-xs text-gray-500">Trong thời hạn</p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-3">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-red-600">{overdueEmployees}</div>
              <p className="text-sm font-medium text-gray-900">Quá Hạn</p>
              <p className="text-xs text-gray-500">Cần nhắc nhở</p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-3">
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-blue-600">{completedEmployees}</div>
              <p className="text-sm font-medium text-gray-900">Hoàn Thành</p>
              <p className="text-xs text-gray-500">Đã nghỉ việc</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Tiến độ thu quỹ tháng này (nhân viên hoạt động)</span>
              <span>{Math.round(activeEmployees.length > 0 ? (paidEmployees / activeEmployees.length) * 100 : 0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${activeEmployees.length > 0 ? (paidEmployees / activeEmployees.length) * 100 : 0}%` }}
              ></div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setSelectedEmployeeId(null)}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
            >
              <UserCheck className="h-3 w-3 mr-1" />
              Tất cả
            </button>
            <button 
              onClick={() => setSearchTerm('')}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Đã nộp ({paidEmployees})
            </button>
            <button 
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200"
            >
              <Clock className="h-3 w-3 mr-1" />
              Chờ nộp ({pendingEmployees})
            </button>
            <button 
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200"
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Quá hạn ({overdueEmployees})
            </button>
          </div>
        </div>

        {/* Employee Payment Status */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Employee Payment Status</h3>
              <div className="flex space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="block pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                >
                  <option value="current">Current Month</option>
                  <option value="last">Last Month</option>
                  <option value="all">All Time</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monthly Contribution
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Paid
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-indigo-600 font-medium">
                            {employee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {employee.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDepartmentColor(employee.department)}`}>
                        {employee.department}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatVND(employee.monthly_contribution)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatVND(employee.total_paid)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(employee.last_payment_date)}
                    </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {employee.current_month_status === 'paid' && <CheckCircle className="h-4 w-4 text-green-500 mr-2" />}
                        {employee.current_month_status === 'pending' && <Clock className="h-4 w-4 text-yellow-500 mr-2" />}
                        {employee.current_month_status === 'overdue' && <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />}
                        {employee.current_month_status === 'completed' && <CheckCircle className="h-4 w-4 text-blue-500 mr-2" />}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(employee.current_month_status)}`}>
                          {employee.current_month_status === 'paid' ? 'Đã nộp' : 
                           employee.current_month_status === 'pending' ? 'Chờ nộp' : 
                           employee.current_month_status === 'overdue' ? 'Quá hạn' : 
                           employee.current_month_status === 'completed' ? 'Hoàn thành' : 'Không xác định'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {employee.current_month_status !== 'paid' && employee.current_month_status !== 'completed' && (
                        <button 
                          onClick={() => setShowPaymentModal(true)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Record Payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment History with Advanced Filtering */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Lịch Sử Thanh Toán</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Hiển thị {filteredPayments.length} trên {payments.length} giao dịch
                </p>
              </div>
              <div className="flex gap-2">
                <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  <Eye className="h-4 w-4 mr-2" />
                  Xem chi tiết
                </button>
                <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  <Download className="h-4 w-4 mr-2" />
                  Xuất Excel
                </button>
              </div>
            </div>
            
            {/* Advanced Filters */}
            <div className="flex flex-wrap gap-4 mb-4">
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">Tất cả phương thức</option>
                <option value="cash">Tiền mặt</option>
                <option value="bank_transfer">Chuyển khoản</option>
                <option value="e_wallet">Ví điện tử</option>
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
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">Tất cả tháng</option>
                <option value="T1">T1 (Tháng 1)</option>
                <option value="T2">T2 (Tháng 2)</option>
                <option value="T3">T3 (Tháng 3)</option>
                <option value="T4">T4 (Tháng 4)</option>
                <option value="T5">T5 (Tháng 5)</option>
                <option value="T6">T6 (Tháng 6)</option>
                <option value="T7">T7 (Tháng 7)</option>
                <option value="T8">T8 (Tháng 8)</option>
                <option value="T9">T9 (Tháng 9)</option>
                <option value="T10">T10 (Tháng 10)</option>
                <option value="T11">T11 (Tháng 11)</option>
                <option value="T12">T12 (Tháng 12)</option>
              </select>

              <select
                value={selectedEmployeeId || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  const newSelectedId = value ? value : null;
                  console.log('Employee filter changed:', { value, newSelectedId, type: typeof newSelectedId });
                  setSelectedEmployeeId(newSelectedId);
                }}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Tất cả nhân viên</option>
                {employees.map(employee => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} - {employee.department}
                  </option>
                ))}
              </select>

              {(paymentFilter !== 'all' || dateFilter !== 'all' || monthFilter !== 'all' || selectedEmployeeId !== null) && (
                <button
                  onClick={() => {
                    setPaymentFilter('all');
                    setDateFilter('all');
                    setMonthFilter('all');
                    setSelectedEmployeeId(null);
                  }}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nhân viên
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Số tiền
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ngày thanh toán
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tháng đóng
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phương thức
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ghi chú
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Người ghi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {payment.employee_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDepartmentColor(payment.employee_department)}`}>
                              {payment.employee_department}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900 currency-vnd">
                        {formatVND(payment.amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(payment.payment_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {payment.months_covered.map((month, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {month}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getPaymentMethodIcon(payment.payment_method)}
                        <span className="ml-2 text-sm text-gray-900">
                          {getPaymentMethodLabel(payment.payment_method)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {payment.notes}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payment.recorded_by}
                    </td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-sm text-gray-500">
                      <div className="flex flex-col items-center">
                        <PiggyBank className="h-8 w-8 text-gray-400 mb-2" />
                        <p>Không tìm thấy giao dịch nào</p>
                        <p className="text-xs">Thử điều chỉnh bộ lọc hoặc thêm giao dịch mới</p>
                      </div>
                    </td>
                  </tr>
                )}
                
                {/* Total Row */}
                {filteredPayments.length > 0 && (
                  <tr className="bg-gray-50 border-t-2 border-gray-300">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">
                        TỔNG CỘNG
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-lg font-bold text-green-600">
                        {new Intl.NumberFormat('vi-VN', {
                          style: 'currency',
                          currency: 'VND',
                          minimumFractionDigits: 0,
                        }).format(filteredPayments.reduce((total, payment) => total + (payment.amount || 0), 0))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-700">
                        {filteredPayments.length} giao dịch
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">-</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">-</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">-</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Modal */}
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          employees={employees}
          onSubmit={handlePaymentSubmit}
        />
      </div>
    </Layout>
  );
};

export default FundCollectionPage;
