import { useState, useEffect } from 'react';
import { X, Receipt, DollarSign, Calendar, FileText, Tag, Upload } from 'lucide-react';

const ExpenseModal = ({ isOpen, onClose, onSubmit, expense, isEditing = false, lockAmount = false }) => {
  const [formData, setFormData] = useState({
    amount: '',
    category: 'events',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
    receipt_file: null,
    notes: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    { value: 'events', label: 'Sự kiện (Events)', icon: '🎉' },
    { value: 'gifts', label: 'Quà tặng (Gifts)', icon: '🎁' },
    { value: 'office_supplies', label: 'Văn phòng phẩm (Office Supplies)', icon: '📝' },
    { value: 'other', label: 'Khác (Other)', icon: '📦' }
  ];

  // Reset form when modal opens or populate for editing
  useEffect(() => {
    if (isOpen) {
      if (isEditing && expense) {
        // Populate form with existing expense data
        setFormData({
          amount: expense.amount?.toString() || '',
          category: expense.category || 'events',
          description: expense.description || '',
          expense_date: expense.expense_date ? expense.expense_date.split('T')[0] : new Date().toISOString().split('T')[0],
          receipt_file: null, // Can't pre-populate file input
          notes: expense.notes || ''
        });
      } else {
        // Reset form for new expense
        setFormData({
          amount: '',
          category: 'events',
          description: '',
          expense_date: new Date().toISOString().split('T')[0],
          receipt_file: null,
          notes: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, isEditing, expense]);

  const formatVND = (value) => {
    // Remove non-digits and format as VND
    const number = value.replace(/[^\d]/g, '');
    return new Intl.NumberFormat('vi-VN').format(number);
  };

  const handleAmountChange = (e) => {
    const value = e.target.value.replace(/[^\d]/g, '');
    setFormData(prev => ({ ...prev, amount: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, receipt_file: 'File size must be less than 5MB' }));
        return;
      }
      
      // Check file type (images and PDFs)
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setErrors(prev => ({ ...prev, receipt_file: 'Only images (JPEG, PNG, GIF) and PDF files are allowed' }));
        return;
      }

      setFormData(prev => ({ ...prev, receipt_file: file }));
      setErrors(prev => ({ ...prev, receipt_file: undefined }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.amount || parseInt(formData.amount) <= 0) {
      newErrors.amount = 'Vui lòng nhập số tiền hợp lệ';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Vui lòng nhập mô tả chi phí';
    }

    if (!formData.expense_date) {
      newErrors.expense_date = 'Vui lòng chọn ngày chi phí';
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
      console.error('Error submitting expense:', error);
      setErrors({ submit: 'Có lỗi xảy ra khi lưu thông tin chi phí' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCategory = categories.find(cat => cat.value === formData.category);

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
              {isEditing ? 'Chỉnh Sửa Chi Phí - Edit Expense' : 'Nhập Chi Phí - Record Expense'}
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
            {/* Category Selection */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <Tag className="h-4 w-4 mr-2" />
                Danh mục (Category)
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isSubmitting}
              >
                {categories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.icon} {category.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <FileText className="h-4 w-4 mr-2" />
                Mô tả chi phí (Description) *
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="VD: Tiệc sinh nhật nhân viên tháng 3"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isSubmitting}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>

            {/* Amount Input */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="h-4 w-4 mr-2" />
                Số tiền (Amount) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.amount ? formatVND(formData.amount) : ''}
                  onChange={handleAmountChange}
                  placeholder="100,000"
                  className="block w-full px-3 py-2 pr-12 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={isSubmitting || lockAmount}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-gray-500 text-sm">VND</span>
                </div>
              </div>
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
              )}
              {lockAmount && (
                <p className="mt-1 text-sm text-gray-500">Amount is locked while this expense is linked to bill sharing.</p>
              )}
            </div>

            {/* Expense Date */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 mr-2" />
                Ngày chi phí (Expense Date) *
              </label>
              <input
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData(prev => ({ ...prev, expense_date: e.target.value }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isSubmitting}
              />
              {errors.expense_date && (
                <p className="mt-1 text-sm text-red-600">{errors.expense_date}</p>
              )}
            </div>

            {/* Receipt Upload */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <Receipt className="h-4 w-4 mr-2" />
                Hóa đơn/Biên lai (Receipt)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-md p-4">
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-gray-400" />
                  <div className="mt-2">
                    <label className="cursor-pointer">
                      <span className="text-sm text-indigo-600 hover:text-indigo-500">
                        Chọn file hóa đơn
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf"
                        onChange={handleFileChange}
                        disabled={isSubmitting}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    PNG, JPG, GIF, PDF (tối đa 5MB)
                  </p>
                </div>
                {formData.receipt_file && (
                  <div className="mt-2 text-sm text-green-600">
                    <Receipt className="h-4 w-4 inline mr-1" />
                    {formData.receipt_file.name}
                  </div>
                )}
              </div>
              {errors.receipt_file && (
                <p className="mt-1 text-sm text-red-600">{errors.receipt_file}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <FileText className="h-4 w-4 mr-2" />
                Ghi chú thêm (Additional Notes)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="Thông tin bổ sung về chi phí này..."
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

            {/* Summary */}
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Tóm tắt chi phí:</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Danh mục:</span>
                  <span>{selectedCategory?.icon} {selectedCategory?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span>Số tiền:</span>
                  <span className="font-medium text-red-600">
                    {formData.amount ? `${formatVND(formData.amount)} VND` : '0 VND'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Ngày:</span>
                  <span>{formData.expense_date}</span>
                </div>
              </div>
            </div>

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
                className="flex-1 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Đang lưu...' : (isEditing ? 'Cập Nhật Chi Phí' : 'Lưu Chi Phí')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ExpenseModal;
