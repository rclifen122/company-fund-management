export const getPaymentStatusColor = (status) => {
  const colors = {
    paid: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    overdue: 'bg-red-100 text-red-800',
    inactive: 'bg-gray-100 text-gray-800',
    completed: 'bg-blue-100 text-blue-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export const getStatusColor = (status) => {
  const colors = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export const getDepartmentColor = (department) => {
  const colors = {
    'IT': 'bg-blue-100 text-blue-800',
    'HR': 'bg-purple-100 text-purple-800',
    'Finance': 'bg-green-100 text-green-800',
    'Marketing': 'bg-pink-100 text-pink-800',
    'Sales': 'bg-orange-100 text-orange-800'
  };
  return colors[department] || 'bg-gray-100 text-gray-800';
};
