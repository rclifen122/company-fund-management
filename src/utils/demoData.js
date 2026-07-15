export const DEMO_EMPLOYEES = [
  { id: 'demo-employee-1', name: 'Nguyễn Thị Nguyệt Quỳnh', department: 'General', status: 'active', leave_date: null, participates_in_fund: false },
  { id: 'demo-employee-2', name: 'Lê Thái', department: 'General', status: 'active', leave_date: null, participates_in_fund: false },
  { id: 'demo-employee-3', name: 'Nguyễn Thị Thanh Thảo', department: 'General', status: 'active', leave_date: null, participates_in_fund: false },
  { id: 'demo-employee-4', name: 'Bùi Thị Mỹ Hoa', department: 'General', status: 'active', leave_date: null, participates_in_fund: false },
  { id: 'demo-employee-5', name: 'Dương Anh Thư', department: 'General', status: 'active', leave_date: null, participates_in_fund: true },
  { id: 'demo-employee-6', name: 'Trương Nhĩ Khang', department: 'General', status: 'active', leave_date: null, participates_in_fund: true },
];

export const DEMO_EXPENSES = [
  { id: 'demo-expense-1', description: 'Quà sinh nhật tháng 7', category: 'Quà tặng', expense_date: '2026-07-06', amount: 650000, amount_reimbursed: 0, net_amount: 650000, sharing_status: 'not_shared', notes: '' },
  { id: 'demo-expense-2', description: 'Bánh kem sinh nhật', category: 'Sự kiện', expense_date: '2026-07-06', amount: 450000, amount_reimbursed: 0, net_amount: 450000, sharing_status: 'not_shared', notes: '' },
  { id: 'demo-expense-3', description: 'Văn phòng phẩm', category: 'Văn phòng phẩm', expense_date: '2026-06-28', amount: 300000, amount_reimbursed: 200000, net_amount: 100000, sharing_status: 'partially_reimbursed', notes: '' },
];

const demoParticipants = DEMO_EMPLOYEES.map((employee, index) => ({
  id: `demo-participant-${index + 1}`,
  employee_id: employee.id,
  amount_owed: index < 4 ? 44643 : 0,
  payment_method: index < 4 ? 'direct' : 'fund',
  payment_status: index === 0 ? 'pending' : 'paid',
  employees: { name: employee.name, department: employee.department },
}));

export const DEMO_BILL_SHARINGS = [{
  id: 'demo-sharing-1',
  total_amount: 1250000,
  sharing_date: '2026-07-06',
  created_at: '2026-07-06T08:00:00Z',
  status: 'pending',
  bill_sharing_expenses: [
    { id: 'demo-link-1', expenses: { ...DEMO_EXPENSES[0], amount: 650000 } },
    { id: 'demo-link-2', expenses: { ...DEMO_EXPENSES[1], amount: 450000 } },
    { id: 'demo-link-3', expenses: { id: 'demo-expense-4', description: 'Quà sinh nhật bổ sung', category: 'Quà tặng', expense_date: '2026-07-06', amount: 150000 } },
  ],
  bill_sharing_participants: demoParticipants,
}];
