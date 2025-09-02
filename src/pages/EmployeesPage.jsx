import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import EmployeeModal from '../components/EmployeeModal';
import { supabase } from '../supabase';
import { Search, Plus, Edit, Trash2, Users, Phone, Mail, DollarSign } from 'lucide-react';

const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);

  // Fetch real data from Supabase (reusable)
  const fetchEmployeesData = async () => {
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
              email: 'vana@company.com',
              phone: '0901234567',
              department: 'IT',
              monthly_contribution_amount: 100000,
              total_paid: 300000,
              join_date: '2024-01-01',
              leave_date: null,
              status: 'active',
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
              months_paid: 2,
              current_month_status: 'pending'
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
          .select('employee_id, payment_date, amount');

        console.log('Payments response:', paymentsResponse);
        
        const employeesData = employeesResponse.data || [];
        const paymentsData = paymentsResponse.data || [];

        // Process employees data to add payment status
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const processedEmployees = employeesData?.map(employee => {
          // Find payments for this employee
          const employeePayments = paymentsData?.filter(p => p.employee_id === employee.id) || [];
          
          // Count total months paid
          const monthsPaid = Math.round(Number(employee.total_paid) / Number(employee.monthly_contribution_amount));
          
          // Check current month payment status
          const currentMonthPayments = employeePayments.filter(payment => {
            const paymentDate = new Date(payment.payment_date);
            return paymentDate.getMonth() === currentMonth && 
                   paymentDate.getFullYear() === currentYear;
          });

          // Find latest payment
          const latestPayment = employeePayments
            .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0];

          // Determine current month status
          let status = 'pending';
          if (employee.status === 'inactive') {
            status = 'inactive';
          } else if (currentMonthPayments.length > 0) {
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
    const isDevelopmentMode =
      !import.meta.env.VITE_SUPABASE_URL ||
      import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co' ||
      import.meta.env.VITE_DEV_MODE === 'true';

    if (isDevelopmentMode) return;

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

  // Handle employee submission (create or update)
  const handleEmployeeSubmit = async (employeeData) => {
    try {
      // Check if we're in development mode
      const isDevelopmentMode = 
        !import.meta.env.VITE_SUPABASE_URL || 
        import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co' ||
        import.meta.env.VITE_DEV_MODE === 'true';

      if (isDevelopmentMode) {
        console.log('Employee data (Demo mode):', employeeData);
        alert(editingEmployee ? 'Employee updated successfully! (Demo mode)' : 'Employee added successfully! (Demo mode)');
        setEditingEmployee(null);
        setShowEditForm(false);
        setShowCreateForm(false);
        return;
      }

      if (editingEmployee) {
        // Update existing employee
        const updateData = {
          name: employeeData.name,
          email: employeeData.email,
          phone: employeeData.phone,
          department: employeeData.department,
          monthly_contribution_amount: employeeData.monthly_contribution_amount,
          join_date: employeeData.join_date,
          status: employeeData.status
        };

        // Only add leave_date if the column exists (temporary fix)
        if (employeeData.leave_date) {
          updateData.leave_date = employeeData.leave_date;
        }

        // If total_paid is calculated (when leave_date is set), include it
        if (employeeData.total_paid !== undefined) {
          updateData.total_paid = employeeData.total_paid;
        }

        const { error } = await supabase
          .from('employees')
          .update(updateData)
          .eq('id', editingEmployee.id);

        if (error) throw error;
        alert('Employee updated successfully!');
      } else {
        // Insert new employee
        const insertData = {
          name: employeeData.name,
          email: employeeData.email,
          phone: employeeData.phone,
          department: employeeData.department,
          monthly_contribution_amount: employeeData.monthly_contribution_amount,
          join_date: employeeData.join_date,
          status: employeeData.status,
          total_paid: employeeData.total_paid || 0 // Use calculated value or default to 0
        };

        // Only add leave_date if provided (temporary fix)
        if (employeeData.leave_date) {
          insertData.leave_date = employeeData.leave_date;
        }

        const { error } = await supabase
          .from('employees')
          .insert([insertData]);

        if (error) throw error;
        alert('Employee added successfully!');
      }

      // Reset form state and refresh data without full reload
      setEditingEmployee(null);
      setShowEditForm(false);
      setShowCreateForm(false);
      await fetchEmployeesData();
      
    } catch (error) {
      console.error('Error saving employee:', error);
      alert('Error saving employee: ' + error.message);
    }
  };

  // Handle edit employee
  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setShowEditForm(true);
  };

  // Handle delete employee
  const handleDeleteEmployee = async (employee) => {
    if (!confirm(`Are you sure you want to delete ${employee.name}?`)) {
      return;
    }

    try {
      // Check if we're in development mode
      const isDevelopmentMode = 
        !import.meta.env.VITE_SUPABASE_URL || 
        import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co' ||
        import.meta.env.VITE_DEV_MODE === 'true';

      if (isDevelopmentMode) {
        console.log('Delete employee (Demo mode):', employee);
        alert('Employee deleted successfully! (Demo mode)');
        return;
      }

      // Delete employee from Supabase
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employee.id);

      if (error) throw error;

      alert('Employee deleted successfully!');
      // Refresh data without full reload
      await fetchEmployeesData();
      
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('Error deleting employee: ' + error.message);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPaymentStatusColor = (status) => {
    const colors = {
      paid: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      overdue: 'bg-red-100 text-red-800',
      inactive: 'bg-gray-100 text-gray-800'
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

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || employee.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalEmployees = employees.filter(e => e.status === 'active').length;
  const totalCollected = employees.reduce((sum, e) => sum + e.total_paid, 0);
  const paidThisMonth = employees.filter(e => e.current_month_status === 'paid').length;
  const overdueCount = employees.filter(e => e.current_month_status === 'overdue').length;

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
            <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage employee information and contribution tracking
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-indigo-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Employees</p>
                <p className="text-2xl font-bold text-gray-900">{totalEmployees}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Collected</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatVND(totalCollected)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-bold">✓</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Paid This Month</p>
                <p className="text-2xl font-bold text-gray-900">{paidThisMonth}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 font-bold">!</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow space-y-4 sm:space-y-0 sm:flex sm:items-center sm:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="block pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Employees Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
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
                    Join Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Leave Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
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
                        {employee.department}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatVND(employee.monthly_contribution_amount)}
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
                         employee.current_month_status === 'overdue' ? 'Quá hạn' : 'Không hoạt động'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(employee.status)}`}>
                        {employee.status === 'active' ? 'Hoạt động' : 'Không hoạt động'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleEditEmployee(employee)}
                          className="text-indigo-600 hover:text-indigo-900 p-1 rounded transition-colors"
                          title="Edit Employee"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteEmployee(employee)}
                          className="text-red-600 hover:text-red-900 p-1 rounded transition-colors"
                          title="Delete Employee"
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
      </div>
    </Layout>
  );
};

export default EmployeesPage;
