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

  const handleCreateSharing = async () => { /* ... existing implementation ... */ };

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

      if (error) {
        throw error;
      }

      alert('Successfully finalized sharing and updated expenses!');
      fetchSharingHistory(); // Refresh the history

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
        {/* Header and other UI sections are here */}
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
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${sharing.status === 'finalized' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {sharing.status || 'pending'}
                    </span>
                    <button
                      onClick={() => handleFinalizeSharing(sharing.id)}
                      disabled={sharing.status === 'finalized' || loading}
                      className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
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
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default BillSharingPage;
