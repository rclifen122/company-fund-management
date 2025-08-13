import { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Building, DollarSign, Calendar } from 'lucide-react';

const EmployeeModal = ({ isOpen, onClose, onSubmit, employee, isEditing = false }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    monthly_contribution_amount: 100000,
    join_date: new Date().toISOString().split('T')[0],
    leave_date: '',
    status: 'active'
  });

  // Update form data when employee prop changes (for editing)
  useEffect(() => {
    if (isEditing && employee) {
      setFormData({
        name: employee.name || '',
        email: employee.email || '',
        phone: employee.phone || '',
        department: employee.department || '',
        monthly_contribution_amount: employee.monthly_contribution_amount || 100000,
        join_date: employee.join_date ? employee.join_date.split('T')[0] : new Date().toISOString().split('T')[0],
        leave_date: employee.leave_date ? employee.leave_date.split('T')[0] : '',
        status: employee.status || 'active'
      });
    } else if (!isEditing) {
      // Reset form for new employee
      setFormData({
        name: '',
        email: '',
        phone: '',
        department: '',
        monthly_contribution_amount: 100000,
        join_date: new Date().toISOString().split('T')[0],
        leave_date: '',
        status: 'active'
      });
    }
  }, [isEditing, employee]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const departments = [
    'IT',
    'HR', 
    'Finance',
    'Marketing',
    'Sales',
    'Operations',
    'Other'
  ];

  // Calculate months between two dates (counting day 1 of each month)
  const calculateMonthsBetween = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Set both dates to day 1 for consistent calculation
    start.setDate(1);
    end.setDate(1);
    
    const yearDiff = end.getFullYear() - start.getFullYear();
    const monthDiff = end.getMonth() - start.getMonth();
    
    return yearDiff * 12 + monthDiff + 1; // +1 to include the start month
  };

  // Calculate total contribution based on join and leave dates
  const calculateTotalContribution = () => {
    if (formData.join_date && formData.leave_date && formData.monthly_contribution_amount) {
      const months = calculateMonthsBetween(formData.join_date, formData.leave_date);
      return Math.max(0, months) * formData.monthly_contribution_amount;
    }
    return 0;
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Tên nhân viên là bắt buộc';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email là bắt buộc';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Số điện thoại là bắt buộc';
    }

    if (!formData.department) {
      newErrors.department = 'Phòng ban là bắt buộc';
    }

    if (!formData.monthly_contribution_amount || formData.monthly_contribution_amount <= 0) {
      newErrors.monthly_contribution_amount = 'Số tiền đóng góp phải lớn hơn 0';
    }

    if (!formData.join_date) {
      newErrors.join_date = 'Ngày tham gia là bắt buộc';
    }

    if (formData.leave_date && formData.join_date) {
      const joinDate = new Date(formData.join_date);
      const leaveDate = new Date(formData.leave_date);
      if (leaveDate <= joinDate) {
        newErrors.leave_date = 'Ngày ngưng hoạt động phải sau ngày tham gia';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare form data with calculated total_paid if leave_date is provided
      const submissionData = { ...formData };
      
      // If employee has leave date, calculate total contribution and set status to inactive
      if (formData.leave_date) {
        submissionData.total_paid = calculateTotalContribution();
        submissionData.status = 'inactive';
      }
      
      await onSubmit(submissionData);
      // Reset form only when creating new employee
      if (!isEditing) {
        setFormData({
          name: '',
          email: '',
          phone: '',
          department: '',
          monthly_contribution_amount: 100000,
          join_date: new Date().toISOString().split('T')[0],
          leave_date: '',
          status: 'active'
        });
      }
      setErrors({});
      onClose();
    } catch (error) {
      console.error('Error submitting employee:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* Header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <User className="h-5 w-5 mr-2 text-indigo-600" />
                {isEditing ? 'Chỉnh Sửa Nhân Viên' : 'Thêm Nhân Viên Mới'}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User className="inline h-4 w-4 mr-1" />
                  Họ và Tên *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`block w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Nhập họ và tên nhân viên"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="inline h-4 w-4 mr-1" />
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`block w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="email@company.com"
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone className="inline h-4 w-4 mr-1" />
                  Số Điện Thoại *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`block w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.phone ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0901234567"
                />
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Building className="inline h-4 w-4 mr-1" />
                  Phòng Ban *
                </label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className={`block w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.department ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Chọn phòng ban</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {errors.department && <p className="mt-1 text-xs text-red-600">{errors.department}</p>}
              </div>

              {/* Monthly Contribution */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <DollarSign className="inline h-4 w-4 mr-1" />
                  Số Tiền Đóng Góp Hàng Tháng (VND) *
                </label>
                <input
                  type="number"
                  name="monthly_contribution_amount"
                  value={formData.monthly_contribution_amount}
                  onChange={handleChange}
                  min="0"
                  step="1000"
                  className={`block w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.monthly_contribution_amount ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="100000"
                />
                {errors.monthly_contribution_amount && <p className="mt-1 text-xs text-red-600">{errors.monthly_contribution_amount}</p>}
              </div>

              {/* Join Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Ngày Tham Gia *
                </label>
                <input
                  type="date"
                  name="join_date"
                  value={formData.join_date}
                  onChange={handleChange}
                  className={`block w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.join_date ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.join_date && <p className="mt-1 text-xs text-red-600">{errors.join_date}</p>}
              </div>

              {/* Leave Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Ngày Ngưng Hoạt Động
                </label>
                <input
                  type="date"
                  name="leave_date"
                  value={formData.leave_date}
                  onChange={handleChange}
                  className={`block w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.leave_date ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.leave_date && <p className="mt-1 text-xs text-red-600">{errors.leave_date}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  Để trống nếu nhân viên vẫn đang hoạt động
                </p>
                
                {/* Show calculated contribution when leave date is entered */}
                {formData.leave_date && formData.join_date && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      <strong>Tự động tính toán:</strong>
                    </p>
                    <p className="text-xs text-blue-600">
                      Số tháng tham gia: {calculateMonthsBetween(formData.join_date, formData.leave_date)} tháng
                    </p>
                    <p className="text-xs text-blue-600">
                      Tổng số tiền đóng góp: {new Intl.NumberFormat('vi-VN', {
                        style: 'currency',
                        currency: 'VND',
                        minimumFractionDigits: 0,
                      }).format(calculateTotalContribution())}
                    </p>
                    <p className="text-xs text-blue-600">
                      Trạng thái sẽ được đặt thành: <strong>Không hoạt động</strong>
                    </p>
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trạng Thái
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Không hoạt động</option>
                </select>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Đang lưu...
                </>
              ) : (
                isEditing ? 'Cập Nhật' : 'Thêm Nhân Viên'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Hủy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeModal;
