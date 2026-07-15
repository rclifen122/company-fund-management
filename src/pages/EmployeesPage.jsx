import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import PageTransition from '../components/PageTransition';
import EmployeeModal from '../components/EmployeeModal';
import EmployeeMembershipModal from '../components/EmployeeMembershipModal';
import { supabase } from '../supabase';
import { isDevelopmentMode } from '../utils/env';
import { formatVND, formatDate } from '../utils/format';
import { getStatusColor, getPaymentStatusColor, getDepartmentColor } from '../utils/helpers';
import {
  EMPLOYEE_MEMBERSHIP,
  getEmployeeMembershipMode,
  getMembershipUpdate,
  isActiveFundMember,
} from '../utils/employeeMembership';
import { Search, Plus, Edit, Settings2, Users, Phone, Mail, DollarSign } from 'lucide-react';

const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [membershipEmployee, setMembershipEmployee] = useState(null);
  const [savingMembership, setSavingMembership] = useState(false);

  // Fetch real data from Supabase (reusable)
  const fetchEmployeesData = async () => {
      try {
        setLoading(true);

        if (isDevelopmentMode()) {
          // Use mock data in development mode
          const mockEmployees = [
            {
              id: 1,
              name: 'Nguyễn Văn A',
              email: 'vana@company.com',
              phone: '0901234567',
              department: 'IT',
              monthly_contribution_amount: 100000,
              total_paid: 300000,
              join_date: '2024-01-01',
              leave_date: null,
              status: 'active',
              participates_in_fund: true,
              months_paid: 3,
              current_month_status: 'paid'
            },
            {
              id: 2,
              name: 'Trần Thị B',
              email: 'thib@company.com',
              phone: '0901234568',
              department: 'HR',
              monthly_contribution_amount: 100000,
              total_paid: 200000,
              join_date: '2024-01-15',
              leave_date: null,
              status: 'active',
              participates_in_fund: false,
              months_paid: 2,
              current_month_status: 'direct'
            },
            {
              id: 3,
              name: 'Lê Văn C',
              email: 'vanc@company.com',
              phone: '0901234569',
              department: 'Finance',
              monthly_contribution_amount: 100000,
              total_paid: 300000,
              join_date: '2024-02-01',
              leave_date: '2024-05-01',
              status: 'inactive',
              participates_in_fund: false,
              months_paid: 3,
              current_month_status: 'inactive'
            }
          ];

          setTimeout(() => {
            setEmployees(mockEmployees);
            setLoading(false);
          }, 1000);
          return;
        }

        // Fetch real data from Supabase
        console.log('Fetching employees data from Supabase...');

        const employeesResponse = await supabase
          .from('employees')
          .select('*')
          .order('created_at', { ascending: false });

        console.log('Employees response:', employeesResponse);
        if (employeesResponse.error) {
          console.error('Employees error:', employeesResponse.error);
          throw employeesResponse.error;
        }

        // Get payments for calculating current month status
        const paymentsResponse = await supabase
          .from('fund_payments')
          .select('employee_id, payment_date, amount, months_covered');

        console.log('Payments response:', paymentsResponse);
        
        const employeesData = employeesResponse.data || [];
        const paymentsData = paymentsResponse.data || [];

        // Process employees data to add payment status
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const processedEmployees = employeesData?.map(employee => {
          // Find payments for this employee
          const employeePayments = paymentsData?.filter(p => p.employee_id === employee.id) || [];
          
          const coveredMonths = new Set(employeePayments.flatMap(payment => {
            if (Array.isArray(payment.months_covered) && payment.months_covered.length > 0) {
              return payment.months_covered;
            }

            return payment.payment_date ? [String(payment.payment_date).slice(0, 7)] : [];
          }));
          const fallbackMonthsPaid = Number(employee.monthly_contribution_amount) > 0
            ? Math.round(Number(employee.total_paid) / Number(employee.monthly_contribution_amount))
            : 0;
          const monthsPaid = coveredMonths.size || fallbackMonthsPaid;

          // Find latest payment
          const latestPayment = employeePayments
            .slice()
            .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0];

          // Determine current month status
          let status = 'pending';
          const membershipMode = getEmployeeMembershipMode(employee);
          if (membershipMode === EMPLOYEE_MEMBERSHIP.INACTIVE) {
            status = 'inactive';
          } else if (membershipMode === EMPLOYEE_MEMBERSHIP.DIRECT) {
            status = 'direct';
          } else if (coveredMonths.has(currentMonthKey)) {
            status = 'paid';
          } else if (latestPayment) {
            const lastPaymentDate = new Date(latestPayment.payment_date);
            const daysSinceLastPayment = Math.floor(
              (now - lastPaymentDate) / (1000 * 60 * 60 * 24)
            );
            
            console.log(`Employee ${employee.name}:`, {
              lastPaymentDate: latestPayment.payment_date,
              daysSinceLastPayment,
              currentDate: now.toISOString().split('T')[0]
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
            monthly_contribution_amount: Number(employee.monthly_contribution_amount),
            total_paid: Number(employee.total_paid),
            months_paid: monthsPaid,
            current_month_status: status
          };
        }) || [];

        setEmployees(processedEmployees);
        setLoading(false);

      } catch (error) {
        console.error('Error fetching employees data:', error);
        // Fall back to mock data on error
        const mockEmployees = [
          {
            id: 1,
            name: 'Nguyễn Văn A',
            email: 'vana@company.com',
            phone: '0901234567',
            department: 'IT',
            monthly_contribution_amount: 100000,
            total_paid: 300000,
            join_date: '2024-01-01',
            leave_date: null,
            status: 'active',
            participates_in_fund: true,
            months_paid: 3,
            current_month_status: 'paid'
          }
        ];
        setEmployees(mockEmployees);
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchEmployeesData();
  }, []);

  // Realtime updates: refresh data on employees/payments changes
  useEffect(() => {
    if (isDevelopmentMode()) return;

    const employeesChannel = supabase
      .channel('employees-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, async () => {
        await fetchEmployeesData();
      })
      .subscribe();

    const paymentsChannel = supabase
      .channel('fund_payments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_payments' }, async () => {
        await fetchEmployeesData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(employeesChannel);
      supabase.removeChannel(paymentsChannel);
    };
  }, []);



  // Handle employee submission (create or update)
  const handleEmployeeSubmit = async (employeeData) => {
    try {
      const isInactive = employeeData.status === 'inactive' || Boolean(employeeData.leave_date);
      const normalizedData = {
        name: employeeData.name.trim(),
        email: employeeData.email.trim(),
        phone: employeeData.phone.trim(),
        department: employeeData.department,
        monthly_contribution_amount: Number(employeeData.monthly_contribution_amount),
        join_date: employeeData.join_date,
        leave_date: employeeData.leave_date || null,
        status: isInactive ? 'inactive' : 'active',
        participates_in_fund: isInactive ? false : employeeData.participates_in_fund !== false,
      };

      if (isDevelopmentMode()) {
        console.log('Employee data (Demo mode):', normalizedData);
        if (editingEmployee) {
          setEmployees(current => current.map(employee => (
            employee.id === editingEmployee.id
              ? {
                ...employee,
                ...normalizedData,
                current_month_status: normalizedData.status === 'inactive'
                  ? 'inactive'
                  : normalizedData.participates_in_fund ? employee.current_month_status : 'direct',
              }
              : employee
          )));
        } else {
          setEmployees(current => [{
            id: `demo-${Date.now()}`,
            ...normalizedData,
            total_paid: 0,
            months_paid: 0,
            current_month_status: normalizedData.participates_in_fund ? 'pending' : 'direct',
          }, ...current]);
        }
        alert(editingEmployee ? 'Đã cập nhật nhân viên (Demo mode).' : 'Đã thêm nhân viên (Demo mode).');
        setEditingEmployee(null);
        setShowEditForm(false);
        setShowCreateForm(false);
        return;
      }

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(normalizedData)
          .eq('id', editingEmployee.id);

        if (error) throw error;
        alert('Đã cập nhật nhân viên.');
      } else {
        const { error } = await supabase
          .from('employees')
          .insert([normalizedData]);

        if (error) throw error;
        alert('Đã thêm nhân viên.');
      }

      // Reset form state and refresh data without full reload
      setEditingEmployee(null);
      setShowEditForm(false);
      setShowCreateForm(false);
      await fetchEmployeesData();
      
    } catch (error) {
      console.error('Error saving employee:', error);
      alert('Không thể lưu nhân viên: ' + error.message);
      throw error;
    }
  };

  // Handle edit employee
  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setShowEditForm(true);
  };

  const handleMembershipChange = async (mode) => {
    if (!membershipEmployee) return;

    setSavingMembership(true);
    try {
      const updateData = getMembershipUpdate(mode);

      if (isDevelopmentMode()) {
        setEmployees(current => current.map(employee => (
          employee.id === membershipEmployee.id
            ? {
              ...employee,
              ...updateData,
              current_month_status: mode === EMPLOYEE_MEMBERSHIP.FUND
                ? 'pending'
                : mode === EMPLOYEE_MEMBERSHIP.DIRECT ? 'direct' : 'inactive',
            }
            : employee
        )));
        setMembershipEmployee(null);
        return;
      }

      const { error } = await supabase
        .from('employees')
        .update(updateData)
        .eq('id', membershipEmployee.id);

      if (error) throw error;

      await fetchEmployeesData();
      setMembershipEmployee(null);
    } catch (error) {
      console.error('Error updating employee membership:', error);
      alert('Không thể cập nhật hình thức tham gia: ' + error.message);
    } finally {
      setSavingMembership(false);
    }
  };



  const filteredEmployees = employees.filter(employee => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('vi-VN');
    const matchesSearch = [employee.name, employee.email, employee.department]
      .some(value => String(value || '').toLocaleLowerCase('vi-VN').includes(normalizedSearch));
    const matchesStatus = filterStatus === 'all'
      || getEmployeeMembershipMode(employee) === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const activeEmployees = employees.filter(employee => (
    getEmployeeMembershipMode(employee) !== EMPLOYEE_MEMBERSHIP.INACTIVE
  ));
  const activeFundEmployees = employees.filter(isActiveFundMember);
  const totalEmployees = activeEmployees.length;
  const totalCollected = employees
    .reduce((sum, employee) => sum + Number(employee.total_paid || 0), 0);
  const paidThisMonth = activeFundEmployees.filter(employee => employee.current_month_status === 'paid').length;
  const overdueCount = activeFundEmployees.filter(employee => employee.current_month_status === 'overdue').length;

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
      <PageTransition className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quản Lý Nhân Viên</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Quản lý thông tin nhân viên và theo dõi đóng góp
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
          >
            <Plus className="h-4 w-4 mr-2" />
            Thêm Nhân Viên
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800/80 p-6 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-card">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-indigo-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">NV Đang Làm</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalEmployees}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/80 p-6 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-card">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Tổng Thu</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatVND(totalCollected)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/80 p-6 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-card">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Đã Nộp Tháng Này</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{paidThisMonth}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/80 p-6 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-card">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <span className="text-red-600 dark:text-red-400 font-bold">!</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Quá Hạn</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{overdueCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800/80 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-card space-y-4 sm:space-y-0 sm:flex sm:items-center sm:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm nhân viên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl leading-5 bg-white dark:bg-gray-700/50 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="block pl-3 pr-10 py-2 text-base border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 rounded-xl bg-white dark:bg-gray-700/50 text-gray-900 dark:text-white transition-all duration-200"
            >
              <option value="all">Tất cả</option>
              <option value="fund">Tham gia Quỹ</option>
              <option value="direct">Direct</option>
              <option value="inactive">Ngừng tham gia</option>
            </select>
          </div>
        </div>

        {/* Employees Table */}
        <div className="bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700/50">
              <thead className="bg-gray-50/80 dark:bg-gray-700/30">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Nhân Viên
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Phòng Ban
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Hình Thức
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Mức Đóng Tháng
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tổng Đã Đóng
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ngày Vào
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ngày Nghỉ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Thanh Toán
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Trạng Thái
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800/80 divide-y divide-gray-100 dark:divide-gray-700/50">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors duration-150">
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
                          <div className="text-sm text-gray-500 flex items-center">
                            <Mail className="h-3 w-3 mr-1" />
                            {employee.email}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <Phone className="h-3 w-3 mr-1" />
                            {employee.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDepartmentColor(employee.department)}`}>
                        {employee.department || 'Chưa có'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getEmployeeMembershipMode(employee) === EMPLOYEE_MEMBERSHIP.FUND ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                          Quỹ
                        </span>
                      ) : getEmployeeMembershipMode(employee) === EMPLOYEE_MEMBERSHIP.DIRECT ? (
                        <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                          Direct
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          Ngừng tham gia
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getEmployeeMembershipMode(employee) === EMPLOYEE_MEMBERSHIP.FUND
                        ? formatVND(employee.monthly_contribution_amount)
                        : <span className="text-gray-400">Không thu hàng tháng</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatVND(employee.total_paid)}
                      <div className="text-xs text-gray-500">{employee.months_paid} tháng</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(employee.join_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {employee.leave_date ? (
                        <span className="text-red-600">{formatDate(employee.leave_date)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(employee.current_month_status)}`}>
                        {employee.current_month_status === 'paid' ? 'Đã nộp' :
                         employee.current_month_status === 'pending' ? 'Chờ nộp' :
                         employee.current_month_status === 'overdue' ? 'Quá hạn' :
                         employee.current_month_status === 'direct' ? 'Theo từng chi phí' : 'Không hoạt động'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(getEmployeeMembershipMode(employee) === EMPLOYEE_MEMBERSHIP.INACTIVE ? 'inactive' : 'active')}`}>
                        {getEmployeeMembershipMode(employee) === EMPLOYEE_MEMBERSHIP.INACTIVE ? 'Không hoạt động' : 'Hoạt động'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleEditEmployee(employee)}
                          className="text-indigo-600 hover:text-indigo-900 p-1 rounded transition-colors"
                          title="Chỉnh sửa thông tin"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => setMembershipEmployee(employee)}
                          className="text-slate-600 hover:text-indigo-700 p-1 rounded transition-colors"
                          title="Quản lý hình thức tham gia"
                        >
                          <Settings2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredEmployees.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg">No employees found</div>
            <p className="text-gray-500 mt-2">Try adjusting your search or filter criteria</p>
          </div>
        )}

        {/* Create Employee Modal */}
        <EmployeeModal
          isOpen={showCreateForm}
          onClose={() => {
            setShowCreateForm(false);
            setEditingEmployee(null);
          }}
          onSubmit={handleEmployeeSubmit}
        />

        {/* Edit Employee Modal */}
        <EmployeeModal
          isOpen={showEditForm}
          onClose={() => {
            setShowEditForm(false);
            setEditingEmployee(null);
          }}
          onSubmit={handleEmployeeSubmit}
          employee={editingEmployee}
          isEditing={true}
        />

        <EmployeeMembershipModal
          employee={membershipEmployee}
          isOpen={Boolean(membershipEmployee)}
          isSaving={savingMembership}
          onClose={() => {
            if (!savingMembership) setMembershipEmployee(null);
          }}
          onSave={handleMembershipChange}
        />
      </PageTransition>
    </Layout>
  );
};

export default EmployeesPage;
