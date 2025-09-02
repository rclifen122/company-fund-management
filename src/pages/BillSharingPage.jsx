import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../supabase';
import { Users, DollarSign, Cake, Check, X } from 'lucide-react';

const BillSharingPage = () => {
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedExpenses, setSelectedExpenses] = useState(new Set());
  const [selectedEmployees, setSelectedEmployees] = useState(new Set());
  const [birthdayPeople, setBirthdayPeople] = useState(new Set());
  const [participantFilter, setParticipantFilter] = useState('active'); // all | fund | direct | active

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // 1. Fetch Expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });

      if (expensesError) {
        console.error('Error fetching expenses:', expensesError);
      } else {
        setExpenses(expensesData);
      }

      // 2. Fetch Employees and merge with fund participation data
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .order('name', { ascending: true });

      if (employeesError) {
        console.error('Error fetching employees:', employeesError);
      } else {
        const fundParticipationList = {
          'MASUDA TAKEHIKO': true,
          'NGUYỄN TRUNG HIẾU': true,
          'IMAMACHI': true,
          'VI TRẦN PHƯƠЯ LINH': true,
          'NGUYỄN HOÀNG YẾN NHI': true,
          'TRẦN ĐÌNH LĨNH': true,
          'NGUYỄN VĂN CHUYỀN': true,
          'TRẦN QUỐC LỘC': true,
          'TRẦN THỊ HUYỀN': true,
          'LÊ VĂN LỘC': true,
          'NGUYỄN THÀNH NGUYÊN': true,
          'TRẦN THANH KIM': true,
          'TRẦN BẢO': true,
          'DƯƠЯ ANH THƯ': true,
          'MẠC TUẤN ANH': true,
          'ĐẶNG THỊ LAN': true,
          'HOSHIYAMA': false,
          'LÊ THẾ NGÂN': false,
          'VĂN HOÀNG THỜI': false,
          'TRƯƠЯ NHỈ KHANG': false,
          'NGUYỄN THỊ CẨM LAN': false,
          'NGUYỄN THỊ KIM NGỌC': false,
          'NGUYỄN THỊ HỒNGHUỆ': false,
          'LÊ THÀNH TIẾN': false,
          'NGUYỄN  THÙY DUNG': false,
          'PHẠM HỮU HẢI': false,
          'NGUYỄN THỊ TUYẾT LINH': false,
          'NGUYỄN THỊ THANH THẢO': false,
          'BÙI THỊ MỸ HOA': false,
          'TRỊNH LÊ MỸ DUYÊN': false,
          'QUỲNH NHƯ': false,
          'LÊ THÁI': false,
        };

        const mergedEmployees = employeesData.map(emp => ({
          ...emp,
          participates_in_fund: fundParticipationList[emp.name.toUpperCase()] || false,
        }));
        setEmployees(mergedEmployees);
        // Override mapping: rely on DB participates_in_fund
        const normalizedEmployees = (employeesData || []).map(emp => ({
          ...emp,
          participates_in_fund: typeof emp.participates_in_fund === 'boolean' ? emp.participates_in_fund : true,
        }));
        setEmployees(normalizedEmployees);
        // Default select all active employees (exclude leavers/inactive)
        const defaultSelected = normalizedEmployees
          .filter(e => e.status === 'active' && !e.leave_date)
          .map(e => e.id);
        setSelectedEmployees(new Set(defaultSelected));
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  // --- Real-time Calculation State ---
  const [totalAmount, setTotalAmount] = useState(0);
  const [amountPerPerson, setAmountPerPerson] = useState(0);
  const [fundPayment, setFundPayment] = useState(0);
  const [directPayment, setDirectPayment] = useState(0);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [sharingHistory, setSharingHistory] = useState([]);

  // --- UI State ---
  const [loading, setLoading] = useState(false);

  // --- Event Handlers ---
  const handleExpenseToggle = (expenseId) => {
    const newSelection = new Set(selectedExpenses);
    if (newSelection.has(expenseId)) {
      newSelection.delete(expenseId);
    } else {
      newSelection.add(expenseId);
    }
    setSelectedExpenses(newSelection);
  };

  const handleEmployeeToggle = (employeeId) => {
    const newSelection = new Set(selectedEmployees);
    if (newSelection.has(employeeId)) {
      newSelection.delete(employeeId);
      // Also remove from birthday list if deselected
      const newBirthdaySelection = new Set(birthdayPeople);
      newBirthdaySelection.delete(employeeId);
      setBirthdayPeople(newBirthdaySelection);
    } else {
      newSelection.add(employeeId);
    }
    setSelectedEmployees(newSelection);
  };

  const handleBirthdayToggle = (employeeId) => {
    // Can only select birthday person if they are a participant
    if (!selectedEmployees.has(employeeId)) return;

    const newSelection = new Set(birthdayPeople);
    if (newSelection.has(employeeId)) {
      newSelection.delete(employeeId);
    } else {
      newSelection.add(employeeId);
    }
    setBirthdayPeople(newSelection);
  };

  const handleCreateSharing = async () => {
    setLoading(true);

    try {
      // 1. Create main sharing record
      const { data: sharingRecord, error: sharingError } = await supabase
        .from('bill_sharing')
        .insert({ total_amount: totalAmount, sharing_date: new Date().toISOString().split('T')[0] })
        .select()
        .single();

      if (sharingError) throw sharingError;

      const sharingId = sharingRecord.id;

      // 2. Link expenses
      const expensesToLink = Array.from(selectedExpenses).map(expenseId => ({
        bill_sharing_id: sharingId,
        expense_id: expenseId,
        amount: expenses.find(e => e.id === expenseId).amount,
      }));
      const { error: expensesLinkError } = await supabase
        .from('bill_sharing_expenses')
        .insert(expensesToLink);

      if (expensesLinkError) throw expensesLinkError;

      // 3. Create participant records
      const participantsToCreate = paymentBreakdown.map(p => ({
        bill_sharing_id: sharingId,
        employee_id: p.id,
        amount_owed: p.amountOwed,
        is_birthday_person: birthdayPeople.has(p.id),
        payment_method: p.paymentMethod,
        payment_status: p.amountOwed === 0 ? 'paid' : 'pending',
      }));
      const { error: participantsError } = await supabase
        .from('bill_sharing_participants')
        .insert(participantsToCreate);

      if (participantsError) throw participantsError;

      alert('Bill sharing record created successfully!');
      // Reset state
      setSelectedExpenses(new Set());
      setSelectedEmployees(new Set());
      setBirthdayPeople(new Set());

    } catch (error) {
      console.error('Error creating sharing record:', error);
      alert('Error creating sharing record: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentStatusToggle = async (participantId, currentStatus) => {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';

    // Optimistically update UI
    const updatedHistory = sharingHistory.map(sharing => ({
      ...sharing,
      bill_sharing_participants: sharing.bill_sharing_participants.map(p => 
        p.id === participantId ? { ...p, payment_status: newStatus } : p
      ),
    }));
    setSharingHistory(updatedHistory);

    // Update database
    const { error } = await supabase
      .from('bill_sharing_participants')
      .update({ payment_status: newStatus, payment_date: newStatus === 'paid' ? new Date().toISOString() : null })
      .eq('id', participantId);

    if (error) {
      console.error('Error updating payment status:', error);
      // Revert UI on error
      setSharingHistory(sharingHistory);
      alert('Failed to update payment status.');
    }
  };

  // Phase 3: Core Calculation Logic
  useEffect(() => {
    // Calculate total amount from selected expenses
    const total = Array.from(selectedExpenses).reduce((sum, expenseId) => {
      const expense = expenses.find(e => e.id === expenseId);
      return sum + (expense ? expense.amount : 0);
    }, 0);
    setTotalAmount(total);

    const participants = new Set(selectedEmployees);
    const birthdayBoys = new Set(birthdayPeople);
    const payers = new Set([...participants].filter(p => !birthdayBoys.has(p)));

    if (total === 0 || participants.size === 0) {
      setAmountPerPerson(0);
      setFundPayment(0);
      setDirectPayment(0);
      setPaymentBreakdown([]);
      return;
    }

    let breakdown = [];
    let fundTotal = 0;
    let directTotal = 0;

    // Multiple birthday logic
    if (birthdayBoys.size > 1) {
      const costPerBirthdayPerson = total / birthdayBoys.size;
      employees.forEach(emp => {
        if (participants.has(emp.id)) {
          let amountOwed = 0;
          if (birthdayBoys.has(emp.id)) {
            amountOwed = costPerBirthdayPerson;
          }

          const paymentMethod = emp.participates_in_fund ? 'fund' : 'direct';
          if (paymentMethod === 'fund') {
            fundTotal += amountOwed;
          } else {
            directTotal += amountOwed;
          }

          breakdown.push({ ...emp, amountOwed, paymentMethod });
        }
      });
    } else { // Single or no birthday logic
      const individualShare = payers.size > 0 ? total / payers.size : 0;
      setAmountPerPerson(individualShare);

      employees.forEach(emp => {
        if (participants.has(emp.id)) {
          const isPayer = payers.has(emp.id);
          const amountOwed = isPayer ? individualShare : 0;
          const paymentMethod = emp.participates_in_fund ? 'fund' : 'direct';

          if (isPayer) {
            if (paymentMethod === 'fund') {
              fundTotal += amountOwed;
            } else {
              directTotal += amountOwed;
            }
          }

          breakdown.push({ ...emp, amountOwed, paymentMethod });
        }
      });
    }

    setFundPayment(fundTotal);
    setDirectPayment(directTotal);
    setPaymentBreakdown(breakdown);

  }, [selectedExpenses, selectedEmployees, birthdayPeople, expenses, employees]);

  useEffect(() => {
    const fetchSharingHistory = async () => {
      const { data, error } = await supabase
        .from('bill_sharing')
        .select(`
          *,
          bill_sharing_participants (*, employees (name, department))
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sharing history:', error);
      } else {
        setSharingHistory(data);
      }
    };

    fetchSharingHistory();
  }, []);

  // Realtime refresh employees/expenses for live list updates
  useEffect(() => {
    const isDevelopmentMode =
      !import.meta.env.VITE_SUPABASE_URL ||
      import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co' ||
      import.meta.env.VITE_DEV_MODE === 'true';

    if (isDevelopmentMode) return;

    const empChannel = supabase
      .channel('bill-sharing-employees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => {
        // Reuse initial fetch for consistency
        (async () => {
          try { await (async () => { setLoading(true); const { data, error } = await supabase.from('employees').select('*').order('name', { ascending: true }); if (!error) { const normalized = (data || []).map(emp => ({ ...emp, participates_in_fund: typeof emp.participates_in_fund === 'boolean' ? emp.participates_in_fund : true })); setEmployees(normalized); } setLoading(false); })(); } catch {}
        })();
      })
      .subscribe();

    const expChannel = supabase
      .channel('bill-sharing-expenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        (async () => {
          try { const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false }); if (!error) setExpenses(data || []); } catch {}
        })();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(empChannel);
      supabase.removeChannel(expChannel);
    };
  }, []);
  
  const formatVND = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bill Sharing Calculator</h1>
          <p className="mt-1 text-sm text-gray-500">
            Calculate and track shared expenses for events like birthday parties.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row lg:space-x-8">
          {/* Left Side: Selections */}
          <div className="flex-1 space-y-8">
            {/* 1. Select Expenses */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">1. Select Expenses to Share</h2>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {expenses.map(expense => (
                  <div key={expense.id} className={`flex items-center justify-between p-3 rounded-md border ${selectedExpenses.has(expense.id) ? 'bg-indigo-50 border-indigo-300' : 'bg-gray-50'}`}>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`expense-${expense.id}`}
                        checked={selectedExpenses.has(expense.id)}
                        onChange={() => handleExpenseToggle(expense.id)}
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor={`expense-${expense.id}`} className="ml-3">
                        <p className="font-medium text-gray-800">{expense.description}</p>
                        <p className="text-sm text-gray-500">{new Date(expense.expense_date).toLocaleDateString('vi-VN')}</p>
                      </label>
                    </div>
                    <p className="font-semibold text-indigo-600">{formatVND(expense.amount)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Select Employees */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">2. Select Participants</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                <button type="button" onClick={() => setParticipantFilter('all')} className={`px-3 py-1 rounded-full text-sm border ${participantFilter === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'} hover:border-indigo-500`}>All</button>
                <button type="button" onClick={() => setParticipantFilter('fund')} className={`px-3 py-1 rounded-full text-sm border ${participantFilter === 'fund' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'} hover:border-indigo-500`}>Fund</button>
                <button type="button" onClick={() => setParticipantFilter('direct')} className={`px-3 py-1 rounded-full text-sm border ${participantFilter === 'direct' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'} hover:border-indigo-500`}>Direct</button>
                <button type="button" onClick={() => setParticipantFilter('active')} className={`px-3 py-1 rounded-full text-sm border ${participantFilter === 'active' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'} hover:border-indigo-500`}>Active</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                {employees
                  .filter(emp => {
                    if (participantFilter === 'fund') return !!emp.participates_in_fund;
                    if (participantFilter === 'direct') return emp.participates_in_fund === false;
                    if (participantFilter === 'active') return (emp.status === 'active') && !emp.leave_date;
                    return true;
                  })
                  .map(emp => (
                  <div key={emp.id} className={`flex items-center p-3 rounded-md border ${selectedEmployees.has(emp.id) ? 'bg-green-50 border-green-300' : 'bg-gray-50'}`}>
                    <input
                      type="checkbox"
                      id={`emp-${emp.id}`}
                      checked={selectedEmployees.has(emp.id)}
                      onChange={() => handleEmployeeToggle(emp.id)}
                      className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <label htmlFor={`emp-${emp.id}`} className="ml-3 flex-1">
                      <p className="font-medium text-gray-800">{emp.name}</p>
                      <p className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block ${emp.participates_in_fund ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-800'}`}>
                        {emp.participates_in_fund ? 'Quỹ' : 'Riêng'}
                      </p>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Select Birthday People */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">3. Select Birthday People (will not pay)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                {employees.filter(e => selectedEmployees.has(e.id)).map(emp => (
                  <div key={emp.id} className={`flex items-center p-3 rounded-md border ${birthdayPeople.has(emp.id) ? 'bg-pink-50 border-pink-300' : 'bg-gray-50'}`}>
                    <input
                      type="checkbox"
                      id={`bday-${emp.id}`}
                      checked={birthdayPeople.has(emp.id)}
                      onChange={() => handleBirthdayToggle(emp.id)}
                      className="h-5 w-5 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    />
                    <label htmlFor={`bday-${emp.id}`} className="ml-3">
                      <p className="font-medium text-gray-800">{emp.name}</p>
                    </label>
                  </div>
                ))}
                 {selectedEmployees.size === 0 && <p className="text-gray-500 text-sm">Please select participants first.</p>}
              </div>
            </div>
          </div>

          {/* Right Side: Calculations & Actions */}
          <div className="w-full lg:w-96 mt-8 lg:mt-0">
            <div className="sticky top-6 space-y-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Real-time Calculation</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-gray-600">Total Selected Amount:</p>
                    <p className="font-bold text-xl text-indigo-600">{formatVND(totalAmount)}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-gray-600">Amount Per Person:</p>
                    <p className="font-bold text-xl text-indigo-600">{formatVND(amountPerPerson)}</p>
                  </div>
                  <hr/>
                  <div className="flex justify-between items-center">
                    <p className="text-blue-600 font-semibold">To Be Paid by Fund:</p>
                    <p className="font-bold text-blue-600">{formatVND(fundPayment)}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-green-600 font-semibold">To Be Paid Directly:</p>
                    <p className="font-bold text-green-600">{formatVND(directPayment)}</p>
                  </div>
                </div>
                <button
                  onClick={handleCreateSharing}
                  className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400"
                  disabled={loading || selectedExpenses.size === 0 || selectedEmployees.size === 0}
                >
                  {loading ? 'Creating...' : 'Create Sharing Record'}
                </button>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                 <h3 className="text-lg font-semibold text-gray-800 mb-4">Payment Breakdown</h3>
                 <div className="space-y-3 max-h-48 overflow-y-auto">
                    {paymentBreakdown.length > 0 ? (
                      paymentBreakdown.map(p => (
                        <div key={p.id} className="flex justify-between items-center text-sm">
                          <div>
                            <p className="font-medium text-gray-800">{p.name}</p>
                            <p className={`text-xs font-semibold ${p.paymentMethod === 'fund' ? 'text-blue-600' : 'text-green-600'}`}>
                              {p.paymentMethod === 'fund' ? 'Pay from Fund' : 'Pay Directly'}
                            </p>
                          </div>
                          <p className="font-bold text-gray-900">{formatVND(p.amountOwed)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">Select expenses and participants to see the breakdown.</p>
                    )}
                 </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mt-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Sharing History</h2>
          <div className="space-y-4">
            {sharingHistory.length > 0 ? (
              sharingHistory.map(sharing => (
                <div key={sharing.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-lg">{formatVND(sharing.total_amount)}</p>
                      <p className="text-sm text-gray-500">{new Date(sharing.sharing_date).toLocaleDateString('vi-VN')}</p>
                    </div>
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${sharing.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                      {sharing.status}
                    </span>
                  </div>
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Participants</h4>
                    <div className="space-y-2">
                      {sharing.bill_sharing_participants.map(p => (
                        <div key={p.id} className="flex justify-between items-center">
                          <div>
                            <p>{p.employees.name}</p>
                            <p className="text-sm text-gray-600">Owed: {formatVND(p.amount_owed)}</p>
                          </div>
                          <button 
                            onClick={() => handlePaymentStatusToggle(p.id, p.payment_status)}
                            className={`px-3 py-1 text-sm rounded-full ${p.payment_status === 'paid' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                            {p.payment_status === 'paid' ? 'Paid' : 'Mark as Paid'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">
                No past sharing records found.
              </p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default BillSharingPage;
