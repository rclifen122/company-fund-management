import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../supabase';
import { Users, DollarSign, Cake, Check, X, BadgeCheck } from 'lucide-react';

const BillSharingPage = () => {
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedExpenses, setSelectedExpenses] = useState(new Set());
  const [selectedEmployees, setSelectedEmployees] = useState(new Set());
  const [birthdayPeople, setBirthdayPeople] = useState(new Set());
  const [participantFilter, setParticipantFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [sharingHistory, setSharingHistory] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [amountPerPerson, setAmountPerPerson] = useState(0);
  const [fundPayment, setFundPayment] = useState(0);
  const [directPayment, setDirectPayment] = useState(0);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);

  const fetchSharingHistory = async () => {
    const { data, error } = await supabase
      .from('bill_sharing')
      .select(`*,
        bill_sharing_participants (*, employees (name, department)),
        bill_sharing_expenses (*)
      `)
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching sharing history:', error);
    else setSharingHistory(data || []);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false });

      if (expensesError) console.error('Error fetching expenses:', expensesError);
      else setExpenses(expensesData || []);

      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .order('name', { ascending: true });

      if (employeesError) {
        console.error('Error fetching employees:', employeesError);
      } else {
        const normalizedEmployees = (employeesData || []).map(emp => ({
          ...emp,
          participates_in_fund: emp.participates_in_fund === true
        }));
        setEmployees(normalizedEmployees);
        const defaultSelected = normalizedEmployees
          .filter(e => e.status === 'active' && !e.leave_date)
          .map(e => e.id);
        setSelectedEmployees(new Set(defaultSelected));
      }
      fetchSharingHistory();
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleExpenseToggle = (expenseId) => {
    const newSelection = new Set(selectedExpenses);
    if (newSelection.has(expenseId)) newSelection.delete(expenseId);
    else newSelection.add(expenseId);
    setSelectedExpenses(newSelection);
  };

  const handleEmployeeToggle = (employeeId) => {
    const newSelection = new Set(selectedEmployees);
    if (newSelection.has(employeeId)) {
      newSelection.delete(employeeId);
      const newBirthdaySelection = new Set(birthdayPeople);
      newBirthdaySelection.delete(employeeId);
      setBirthdayPeople(newBirthdaySelection);
    } else {
      newSelection.add(employeeId);
    }
    setSelectedEmployees(newSelection);
  };

  const handleBirthdayToggle = (employeeId) => {
    if (!selectedEmployees.has(employeeId)) return;
    const newSelection = new Set(birthdayPeople);
    if (newSelection.has(employeeId)) newSelection.delete(employeeId);
    else newSelection.add(employeeId);
    setBirthdayPeople(newSelection);
  };

  const handleCreateSharing = async () => { /* ... implementation needed ... */ };

  const handlePaymentStatusToggle = async (participantId, currentStatus) => {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    const updatedHistory = sharingHistory.map(sharing => ({
      ...sharing,
      bill_sharing_participants: sharing.bill_sharing_participants.map(p => 
        p.id === participantId ? { ...p, payment_status: newStatus } : p
      ),
    }));
    setSharingHistory(updatedHistory);
    const { error } = await supabase
      .from('bill_sharing_participants')
      .update({ payment_status: newStatus, payment_date: newStatus === 'paid' ? new Date().toISOString() : null })
      .eq('id', participantId);
    if (error) {
      console.error('Error updating payment status:', error);
      setSharingHistory(sharingHistory);
      alert('Failed to update payment status.');
    }
  };

  const handleFinalizeSharing = async (sharingId) => {
    if (!confirm('Are you sure you want to finalize this sharing event? This will update the original expenses and cannot be undone.')) {
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.rpc('finalize_bill_sharing', {
        sharing_id_input: sharingId
      });
      if (error) throw error;
      alert('Successfully finalized sharing and updated expenses!');
      fetchSharingHistory();
    } catch (error) {
      console.error('Error finalizing sharing event:', error);
      alert(`Failed to finalize: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const total = Array.from(selectedExpenses).reduce((sum, expenseId) => {
      const expense = expenses.find(e => e.id === expenseId);
      return sum + (expense ? Number(expense.amount) : 0);
    }, 0);
    setTotalAmount(total);
    const participants = new Set(selectedEmployees);
    const birthdayBoys = new Set(birthdayPeople);
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
    const T = total;
    const N = participants.size;
    const B = birthdayBoys.size;
    const amountOwedPerPerson = {};
    if (N === 1) {
      const singleParticipantId = participants.values().next().value;
      const isBirthday = birthdayBoys.has(singleParticipantId);
      const owed = isBirthday ? 0 : T;
      amountOwedPerPerson[singleParticipantId] = owed;
      setAmountPerPerson(owed);
    } else {
      if (B === 0) {
        const share = T / N;
        participants.forEach(id => (amountOwedPerPerson[id] = share));
        setAmountPerPerson(share);
      } else {
        const shareForNonBirthdayPerson = T / (N - 1);
        const shareForBirthdayPerson = (shareForNonBirthdayPerson * (B - 1)) / B;
        participants.forEach(id => {
          if (birthdayBoys.has(id)) {
            amountOwedPerPerson[id] = shareForBirthdayPerson;
          } else {
            amountOwedPerPerson[id] = shareForNonBirthdayPerson;
          }
        });
        setAmountPerPerson(T / N);
      }
    }
    employees.forEach(emp => {
      if (participants.has(emp.id)) {
        const amountOwed = amountOwedPerPerson[emp.id] || 0;
        const paymentMethod = emp.participates_in_fund ? 'fund' : 'direct';
        if (paymentMethod === 'fund') fundTotal += amountOwed;
        else directTotal += amountOwed;
        breakdown.push({ ...emp, amountOwed, paymentMethod });
      }
    });
    setFundPayment(fundTotal);
    setDirectPayment(directTotal);
    setPaymentBreakdown(breakdown.sort((a, b) => a.name.localeCompare(b.name)));
  }, [selectedExpenses, selectedEmployees, birthdayPeople, expenses, employees]);

  const formatVND = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bill Sharing Calculator</h1>
          <p className="mt-1 text-sm text-gray-500">Calculate and track shared expenses for events like birthday parties.</p>
        </div>
        <div className="flex flex-col lg:flex-row lg:space-x-8">
          <div className="flex-1 space-y-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">1. Select Expenses to Share</h2>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {expenses.map(expense => (
                  <div key={expense.id} className={`flex items-center justify-between p-3 rounded-md border ${selectedExpenses.has(expense.id) ? 'bg-indigo-50 border-indigo-300' : 'bg-gray-50'}`}>
                    <div className="flex items-center">
                      <input type="checkbox" id={`expense-${expense.id}`} checked={selectedExpenses.has(expense.id)} onChange={() => handleExpenseToggle(expense.id)} className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
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
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">2. Select Participants</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                {employees.map(emp => (
                  <div key={emp.id} className={`flex items-center p-3 rounded-md border ${selectedEmployees.has(emp.id) ? 'bg-green-50 border-green-300' : 'bg-gray-50'}`}>
                    <input type="checkbox" id={`emp-${emp.id}`} checked={selectedEmployees.has(emp.id)} onChange={() => handleEmployeeToggle(emp.id)} className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                    <label htmlFor={`emp-${emp.id}`} className="ml-3 flex-1">
                      <p className="font-medium text-gray-800">{emp.name}</p>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">3. Select Birthday People</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                {employees.filter(e => selectedEmployees.has(e.id)).map(emp => (
                  <div key={emp.id} className={`flex items-center p-3 rounded-md border ${birthdayPeople.has(emp.id) ? 'bg-pink-50 border-pink-300' : 'bg-gray-50'}`}>
                    <input type="checkbox" id={`bday-${emp.id}`} checked={birthdayPeople.has(emp.id)} onChange={() => handleBirthdayToggle(emp.id)} className="h-5 w-5 rounded border-gray-300 text-pink-600 focus:ring-pink-500" />
                    <label htmlFor={`bday-${emp.id}`} className="ml-3">
                      <p className="font-medium text-gray-800">{emp.name}</p>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="w-full lg:w-96 mt-8 lg:mt-0">
            <div className="sticky top-6 space-y-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Real-time Calculation</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center"><p>Total Selected Amount:</p><p className="font-bold text-xl text-indigo-600">{formatVND(totalAmount)}</p></div>
                  <div className="flex justify-between items-center"><p>Amount Per Person:</p><p className="font-bold text-xl text-indigo-600">{formatVND(amountPerPerson)}</p></div>
                  <hr/>
                  <div className="flex justify-between items-center"><p className="text-blue-600 font-semibold">To Be Paid by Fund:</p><p className="font-bold text-blue-600">{formatVND(fundPayment)}</p></div>
                  <div className="flex justify-between items-center"><p className="text-green-600 font-semibold">To Be Paid Directly:</p><p className="font-bold text-green-600">{formatVND(directPayment)}</p></div>
                </div>
                <button onClick={handleCreateSharing} className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400" disabled={loading || selectedExpenses.size === 0 || selectedEmployees.size === 0}>{loading ? 'Creating...' : 'Create Sharing Record'}</button>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                 <h3 className="text-lg font-semibold text-gray-800 mb-4">Payment Breakdown</h3>
                 <div className="space-y-3 max-h-48 overflow-y-auto">
                    {paymentBreakdown.map(p => (
                      <div key={p.id} className="flex justify-between items-center text-sm">
                        <div>
                          <p className="font-medium text-gray-800">{p.name}</p>
                          <p className={`text-xs font-semibold ${p.paymentMethod === 'fund' ? 'text-blue-600' : 'text-green-600'}`}>{p.paymentMethod === 'fund' ? 'Pay from Fund' : 'Pay Directly'}</p>
                        </div>
                        <p className="font-bold text-gray-900">{formatVND(p.amountOwed)}</p>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow mt-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Sharing History</h2>
          <div className="space-y-4">
            {sharingHistory.map(sharing => (
              <div key={sharing.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-lg">{formatVND(sharing.total_amount)}</p>
                    <p className="text-sm text-gray-500">{new Date(sharing.sharing_date).toLocaleDateString('vi-VN')}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${sharing.status === 'finalized' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{sharing.status || 'pending'}</span>
                    <button onClick={() => handleFinalizeSharing(sharing.id)} disabled={sharing.status === 'finalized' || loading} className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                      <BadgeCheck className="h-4 w-4 mr-2" />
                      {sharing.status === 'finalized' ? 'Finalized' : 'Finalize & Update'}
                    </button>
                  </div>
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
                        <button onClick={() => handlePaymentStatusToggle(p.id, p.payment_status)} className={`px-3 py-1 text-sm rounded-full ${p.payment_status === 'paid' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>{p.payment_status === 'paid' ? 'Paid' : 'Mark as Paid'}</button>
                      </div>
                    ))}
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

export default BillSharingPage;