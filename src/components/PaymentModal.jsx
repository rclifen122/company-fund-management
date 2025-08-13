import { useState, useEffect } from 'react';
import { X, User, DollarSign, Calendar, CreditCard, FileText } from 'lucide-react';

const PaymentModal = ({ isOpen, onClose, onSubmit, employees = [] }) => {
  const [formData, setFormData] = useState({
    employee_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    months_covered: [],
    payment_method: 'cash',
    notes: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        employee_id: '',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        months_covered: [],
        payment_method: 'cash',
        notes: ''
      });
      setErrors({});
    }
  }, [isOpen]);

  const formatVND = (value) => {
    // Remove non-digits and format as VND
    const number = value.replace(/[^\d]/g, '');
    return new Intl.NumberFormat('vi-VN').format(number);
  };

  const handleAmountChange = (e) => {
    const value = e.target.value.replace(/[^\d]/g, '');
    setFormData(prev => ({ ...prev, amount: value }));
  };

  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    
    // Generate previous 3 months and next 3 months
    for (let i = -3; i <= 3; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    
    return options;
  };

  const monthOptions = generateMonthOptions();

  const handleMonthToggle = (monthValue) => {
    setFormData(prev => ({
      ...prev,
      months_covered: prev.months_covered.includes(monthValue)
        ? prev.months_covered.filter(m => m !== monthValue)
        : [...prev.months_covered, monthValue].sort()
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.employee_id) {
      newErrors.employee_id = 'Vui lòng chọn nhân viên';
    }

    if (!formData.amount || parseInt(formData.amount) <= 0) {
      newErrors.amount = 'Vui lòng nhập số tiền hợp lệ';
    }

    if (!formData.payment_date) {
      newErrors.payment_date = 'Vui lòng chọn ngày thanh toán';
    }

    if (formData.months_covered.length === 0) {
      newErrors.months_covered = 'Vui lòng chọn ít nhất một tháng';
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
      const submitData = {
        ...formData,
        amount: parseInt(formData.amount)
      };
      
      await onSubmit(submitData);
      onClose();
    } catch (error) {
      console.error('Error submitting payment:', error);
      setErrors({ submit: 'Có lỗi xảy ra khi lưu thông tin thanh toán' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedEmployee = employees.find(emp => emp.id === formData.employee_id);
  const calculatedAmount = formData.months_covered.length * (selectedEmployee?.monthly_contribution_amount || 100000);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Nhập Quỹ - Record Payment
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isSubmitting}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Employee Selection */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <User className="h-4 w-4 mr-2" />
                Nhân viên (Employee)
              </label>
              <select
                value={formData.employee_id}
                onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isSubmitting}
              >
                <option value="">Chọn nhân viên...</option>
                {employees.map(employee => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} - {employee.department}
                  </option>
                ))}
              </select>
              {errors.employee_id && (
                <p className="mt-1 text-sm text-red-600">{errors.employee_id}</p>
              )}
            </div>

            {/* Amount Input */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="h-4 w-4 mr-2" />
                Số tiền (Amount)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.amount ? formatVND(formData.amount) : ''}
                  onChange={handleAmountChange}
                  placeholder="100,000"
                  className="block w-full px-3 py-2 pr-12 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={isSubmitting}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 text-sm">VND</span>
                </div>
              </div>
              {selectedEmployee && formData.months_covered.length > 0 && (
                <p className="mt-1 text-sm text-green-600">
                  Tự động tính: {formatVND(calculatedAmount.toString())} VND 
                  ({formData.months_covered.length} tháng × {formatVND(selectedEmployee.monthly_contribution_amount.toString())} VND)
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, amount: calculatedAmount.toString() }))}
                    className="ml-2 text-indigo-600 hover:text-indigo-800 text-xs underline"
                  >
                    Sử dụng
                  </button>
                </p>
              )}
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
              )}
            </div>

            {/* Payment Date */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 mr-2" />
                Ngày thanh toán (Payment Date)
              </label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isSubmitting}
              />
              {errors.payment_date && (
                <p className="mt-1 text-sm text-red-600">{errors.payment_date}</p>
              )}
            </div>

            {/* Months Covered */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 mr-2" />
                Tháng đóng (Months Covered)
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {monthOptions.map(month => (
                  <label key={month.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.months_covered.includes(month.value)}
                      onChange={() => handleMonthToggle(month.value)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      disabled={isSubmitting}
                    />
                    <span className="ml-2 text-sm text-gray-700">{month.label}</span>
                  </label>
                ))}
              </div>
              {errors.months_covered && (
                <p className="mt-1 text-sm text-red-600">{errors.months_covered}</p>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <CreditCard className="h-4 w-4 mr-2" />
                Phương thức thanh toán (Payment Method)
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isSubmitting}
              >
                <option value="cash">Tiền mặt (Cash)</option>
                <option value="bank_transfer">Chuyển khoản (Bank Transfer)</option>
                <option value="other">Khác (Other)</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <FileText className="h-4 w-4 mr-2" />
                Ghi chú (Notes)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="Ghi chú thêm..."
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isSubmitting}
              />
            </div>

            {/* Error Message */}
            {errors.submit && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={isSubmitting}
              >
                Hủy (Cancel)
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Đang lưu...' : 'Lưu (Save)'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
