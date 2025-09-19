import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { supabase } from '../supabase';
import { Users, DollarSign, Cake, Check, X, BadgeCheck, Eye, Clipboard } from 'lucide-react';

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
  const [expandedSharings, setExpandedSharings] = useState(new Set());
  const [detailsSharing, setDetailsSharing] = useState(null);
  const [copyingId, setCopyingId] = useState(null);
  const [toast, setToast] = useState({ show: false, text: '', type: 'success' });
  const [participantTypeFilter, setParticipantTypeFilter] = useState('all'); // all | fund | direct
  const [birthdayTypeFilter, setBirthdayTypeFilter] = useState('all'); // all | fund | direct
  const showToast = (text, type = 'success', duration = 2000) => {
    setToast({ show: true, text, type });
    setTimeout(() => setToast({ show: false, text: '', type }), duration);
  };

  const fetchSharingHistory = async () => {
    const { data, error } = await supabase
      .from('bill_sharing')
      .select(`*,
        bill_sharing_participants (*, employees (name, department)),
        bill_sharing_expenses (*, expenses (id, description, category, expense_date, amount))
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

  const bulkSelectParticipants = (action) => {
    const filtered = employees.filter(emp =>
      participantTypeFilter === 'all' ? true : participantTypeFilter === 'fund' ? emp.participates_in_fund : !emp.participates_in_fund
    );
    const next = new Set(selectedEmployees);
    if (action === 'select') filtered.forEach(emp => next.add(emp.id));
    if (action === 'clear') filtered.forEach(emp => next.delete(emp.id));
    setSelectedEmployees(next);
  };

  const bulkMarkBirthday = (action) => {
    const filtered = employees.filter(emp =>
      selectedEmployees.has(emp.id) && (birthdayTypeFilter === 'all' ? true : birthdayTypeFilter === 'fund' ? emp.participates_in_fund : !emp.participates_in_fund)
    );
    const next = new Set(birthdayPeople);
    if (action === 'mark') filtered.forEach(emp => next.add(emp.id));
    if (action === 'unmark') filtered.forEach(emp => next.delete(emp.id));
    setBirthdayPeople(next);
  };

  const handleCreateSharing = async () => {
    setLoading(true);
    try {
      // Generate IDs for tables that don't have default UUIDs
      const genId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`);
      const sharingId = genId();

      // Insert main sharing record (explicit id)
      const { error: sharingError } = await supabase
        .from('bill_sharing')
        .insert({ 
          id: sharingId,
          total_amount: Number(totalAmount || 0), 
          sharing_date: new Date().toISOString().split('T')[0], 
          status: 'pending' 
        });
      if (sharingError) throw sharingError;

      // Link selected expenses
      const expensesToLink = Array.from(selectedExpenses).map(expenseId => ({
        bill_sharing_id: sharingId,
        expense_id: expenseId,
        amount: Number(expenses.find(e => e.id === expenseId)?.amount || 0),
      }));
      if (expensesToLink.length > 0) {
        const { error: linkErr } = await supabase.from('bill_sharing_expenses').insert(expensesToLink);
        if (linkErr) throw linkErr;
      }

      // Create participant rows for DIRECT payers only (fund payers are auto-paid and not tracked here)
      const participantsToCreate = paymentBreakdown
        .filter(p => p.paymentMethod === 'direct' && Number(p.amountOwed || 0) > 0)
        .map(p => ({
          id: genId(),
          bill_sharing_id: sharingId,
          employee_id: p.id,
          amount_owed: Number(p.amountOwed || 0),
          is_birthday_person: birthdayPeople.has(p.id),
          payment_method: 'direct',
          payment_status: 'pending',
        }));
      if (participantsToCreate.length > 0) {
        const { error: partErr } = await supabase.from('bill_sharing_participants').insert(participantsToCreate);
        if (partErr) throw partErr;
      }

      showToast('Sharing created successfully', 'success');
      setSelectedExpenses(new Set());
      fetchSharingHistory();

    } catch (error) {
      console.error('Error creating sharing record:', error);
      showToast('Failed to create sharing: ' + error.message, 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  // Auto-finalize a sharing when all direct participants are paid
  const finalizeIfAllDirectPaid = async (sharingId) => {
    try {
      const { data: participants, error } = await supabase
        .from('bill_sharing_participants')
        .select('id, payment_status, payment_method')
        .eq('bill_sharing_id', sharingId);
      if (error) throw error;

      const directs = (participants || []).filter(p => p.payment_method === 'direct');
      const allPaid = directs.length === 0 || directs.every(p => p.payment_status === 'paid');
      if (!allPaid) return;

      const { error: rpcError } = await supabase.rpc('finalize_bill_sharing', { sharing_id_input: sharingId });
      if (rpcError) throw rpcError;
      await fetchSharingHistory();
    } catch (e) {
      console.error('Auto finalize failed:', e);
    }
  };

  const handlePaymentStatusToggle = async (participantId, currentStatus, sharingId) => {
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
      showToast('Failed to update payment status', 'error', 2500);
    } else if (sharingId) {
      showToast(newStatus === 'paid' ? 'Marked as Paid' : 'Marked as Pending', 'success');
      await finalizeIfAllDirectPaid(sharingId);
    }
  };

  const handleDeleteSharing = async (sharingId, status) => {
    const msg = status === 'finalized'
      ? 'This will rollback reimbursements applied by this sharing and delete it. Continue?'
      : 'Delete this sharing record? This will remove its participants and links.';
    if (!confirm(msg)) return;
    setLoading(true);
    try {
      if (status === 'finalized') {
        const { error: rpcErr } = await supabase.rpc('delete_bill_sharing', { sharing_id_input: sharingId });
        if (rpcErr) throw rpcErr;
      } else {
        const { error: pErr } = await supabase
          .from('bill_sharing_participants')
          .delete()
          .eq('bill_sharing_id', sharingId);
        if (pErr) throw pErr;
        const { error: eErr } = await supabase
          .from('bill_sharing_expenses')
          .delete()
          .eq('bill_sharing_id', sharingId);
        if (eErr) throw eErr;
        const { error: sErr } = await supabase
          .from('bill_sharing')
          .delete()
          .eq('id', sharingId);
        if (sErr) throw sErr;
      }
      await fetchSharingHistory();
      showToast('Sharing deleted successfully', 'success');
    } catch (err) {
      console.error('Error deleting sharing record:', err);
      showToast('Failed to delete sharing: ' + err.message, 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  const toggleSharingExpand = (sharingId) => {
    setExpandedSharings(prev => {
      const next = new Set(prev);
      if (next.has(sharingId)) next.delete(sharingId);
      else next.add(sharingId);
      return next;
    });
  };

  const copySharingExpenses = async (sharing) => {
    try {
      setCopyingId(sharing.id);
      const items = (sharing.bill_sharing_expenses || [])
        .map(e => {
          const ex = e?.expenses;
          if (!ex) return null;
          const dateStr = ex?.expense_date ? new Date(ex.expense_date).toLocaleDateString('vi-VN') : '';
          const parts = [ex.description || ''];
          if (ex?.category) parts.push(ex.category);
          if (dateStr) parts.push(dateStr);
          const left = parts.filter(Boolean).join(' — ');
          const right = typeof ex.amount === 'number' ? formatVND(Number(ex.amount)) : formatVND(0);
          return `- ${left}: ${right}`;
        })
        .filter(Boolean);

      const header = `Bill Sharing on ${new Date(sharing.sharing_date).toLocaleDateString('vi-VN')} | Total: ${formatVND(Number(sharing.total_amount || 0))}`;
      const text = [header, ...items].join('\n');

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setToast({ show: true, text: 'Copied expenses to clipboard', type: 'success' });
        setTimeout(() => setToast({ show: false, text: '', type: 'success' }), 2000);
      } else {
        // Fallback: open a prompt for manual copy
        window.prompt('Copy the text below:', text);
      }
    } catch (err) {
      console.error('Copy failed:', err);
      setToast({ show: true, text: 'Copy failed. Please try again.', type: 'error' });
      setTimeout(() => setToast({ show: false, text: '', type: 'error' }), 2500);
    } finally {
      setCopyingId(null);
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
      showToast('Sharing finalized and expenses updated', 'success');
      fetchSharingHistory();
    } catch (error) {
      console.error('Error finalizing sharing event:', error);
      showToast('Failed to finalize: ' + error.message, 'error', 3000);
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
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Show:</span>
                  <select
                    value={participantTypeFilter}
                    onChange={(e) => setParticipantTypeFilter(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="all">All</option>
                    <option value="fund">Fund</option>
                    <option value="direct">Direct</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => bulkSelectParticipants('select')}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                    title="Select all shown"
                  >
                    Select shown
                  </button>
                  <button
                    onClick={() => bulkSelectParticipants('clear')}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                    title="Clear all shown"
                  >
                    Clear shown
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                {employees
                  .filter(emp => participantTypeFilter === 'all' ? true : participantTypeFilter === 'fund' ? emp.participates_in_fund : !emp.participates_in_fund)
                  .map(emp => (
                  <div key={emp.id} className={`flex items-center p-3 rounded-md border ${selectedEmployees.has(emp.id) ? 'bg-green-50 border-green-300' : 'bg-gray-50'}`}>
                    <input type="checkbox" id={`emp-${emp.id}`} checked={selectedEmployees.has(emp.id)} onChange={() => handleEmployeeToggle(emp.id)} className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                    <label htmlFor={`emp-${emp.id}`} className="ml-3 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800">{emp.name}</p>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${emp.participates_in_fund ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                          {emp.participates_in_fund ? 'Fund' : 'Direct'}
                        </span>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">3. Select Birthday People</h2>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Show:</span>
                  <select
                    value={birthdayTypeFilter}
                    onChange={(e) => setBirthdayTypeFilter(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="all">All</option>
                    <option value="fund">Fund</option>
                    <option value="direct">Direct</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => bulkMarkBirthday('mark')}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                    title="Mark all shown as birthday"
                  >
                    Mark shown
                  </button>
                  <button
                    onClick={() => bulkMarkBirthday('unmark')}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                    title="Unmark all shown"
                  >
                    Unmark shown
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                {employees
                  .filter(e => selectedEmployees.has(e.id))
                  .filter(emp => birthdayTypeFilter === 'all' ? true : birthdayTypeFilter === 'fund' ? emp.participates_in_fund : !emp.participates_in_fund)
                  .map(emp => (
                  <div key={emp.id} className={`flex items-center p-3 rounded-md border ${birthdayPeople.has(emp.id) ? 'bg-pink-50 border-pink-300' : 'bg-gray-50'}`}>
                    <input type="checkbox" id={`bday-${emp.id}`} checked={birthdayPeople.has(emp.id)} onChange={() => handleBirthdayToggle(emp.id)} className="h-5 w-5 rounded border-gray-300 text-pink-600 focus:ring-pink-500" />
                    <label htmlFor={`bday-${emp.id}`} className="ml-3">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800">{emp.name}</p>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${emp.participates_in_fund ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                          {emp.participates_in_fund ? 'Fund' : 'Direct'}
                        </span>
                      </div>
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
            {sharingHistory.map(sharing => {
              const participants = sharing.bill_sharing_participants || [];
              const totalAmount = Number(sharing?.total_amount || 0);
              const directTotalOwed = participants.reduce((sum, p) => sum + Number(p?.amount_owed || 0), 0);
              const directCollected = participants
                .filter(p => p?.payment_status === 'paid')
                .reduce((sum, p) => sum + Number(p?.amount_owed || 0), 0);
              const fundCovered = Math.max(0, totalAmount - directTotalOwed);
              const directOutstanding = Math.max(0, directTotalOwed - directCollected);
              const directProgress = directTotalOwed > 0 ? (directCollected / directTotalOwed) * 100 : 100;

              return (
                <div key={sharing.id} className="border rounded-lg p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      {/* Linked expense names */}
                      <div className="text-sm text-gray-800 font-medium">
                        {(() => {
                          const items = (sharing.bill_sharing_expenses || [])
                            .map(e => {
                              const ex = e?.expenses;
                              if (!ex?.description) return null;
                              const dateStr = ex?.expense_date ? new Date(ex.expense_date).toLocaleDateString('vi-VN') : '';
                              const parts = [ex.description];
                              if (ex?.category) parts.push(ex.category);
                              if (dateStr) parts.push(dateStr);
                              return parts.join(' — ');
                            })
                            .filter(Boolean);
                          if (items.length === 0) return 'Shared Expenses';
                          const isExpanded = expandedSharings.has(sharing.id);
                          if (isExpanded) {
                            return (
                              <div>
                                <ul className="list-disc list-inside space-y-0.5 text-gray-800">
                                  {items.map((text, idx) => (
                                    <li key={idx}>{text}</li>
                                  ))}
                                </ul>
                                <button
                                  className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 underline"
                                  onClick={() => toggleSharingExpand(sharing.id)}
                                >
                                  Hide
                                </button>
                              </div>
                            );
                          }
                          const maxShow = 3;
                          const shownItems = items.slice(0, maxShow);
                          const moreCount = items.length - shownItems.length;
                          return (
                            <span>
                              {shownItems.join(' • ')}
                              {moreCount > 0 && (
                                <button
                                  className="ml-2 text-xs text-indigo-600 hover:text-indigo-800 underline"
                                  onClick={() => toggleSharingExpand(sharing.id)}
                                >
                                  Show all (+{moreCount})
                                </button>
                              )}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="font-bold text-lg">{formatVND(totalAmount)}</p>
                      <p className="text-sm text-gray-500">{new Date(sharing.sharing_date).toLocaleDateString('vi-VN')}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          Fund Paid: {formatVND(fundCovered)}
                        </span>
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Direct Collected: {formatVND(directCollected)}
                        </span>
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                          Direct Outstanding: {formatVND(directOutstanding)}
                        </span>
                      </div>
                      {directTotalOwed > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>Direct Collection</span>
                            <span>{Math.round(Math.min(100, Math.max(0, directProgress)))}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, directProgress))}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                      <button
                        onClick={() => setDetailsSharing(sharing)}
                        className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View details
                      </button>
                      <button
                        onClick={() => copySharingExpenses(sharing)}
                        className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                        disabled={copyingId === sharing.id}
                        title="Copy expenses to clipboard"
                      >
                        <Clipboard className="h-4 w-4 mr-2" />
                        {copyingId === sharing.id ? 'Copying…' : 'Copy expenses'}
                      </button>
                      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${sharing.status === 'finalized' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{sharing.status || 'pending'}</span>
                      <button onClick={() => handleFinalizeSharing(sharing.id)} disabled={sharing.status === 'finalized' || loading} className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                        <BadgeCheck className="h-4 w-4 mr-2" />
                        {sharing.status === 'finalized' ? 'Finalized' : 'Finalize & Update'}
                      </button>
                      <button onClick={() => handleDeleteSharing(sharing.id, sharing.status)} disabled={loading} className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Participants</h4>
                    <div className="space-y-2">
                    {sharing.bill_sharing_participants.map(p => (
                      <div key={p.id} className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <p>{p.employees.name}</p>
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${p.payment_method === 'fund' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                              {p.payment_method === 'fund' ? 'Fund' : 'Direct'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">Owed: {formatVND(p.amount_owed)}</p>
                        </div>
                        <button onClick={() => handlePaymentStatusToggle(p.id, p.payment_status, sharing.id)} className={`px-3 py-1 text-sm rounded-full ${p.payment_status === 'paid' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>{p.payment_status === 'paid' ? 'Paid' : 'Mark as Paid'}</button>
                      </div>
                    ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {detailsSharing && (() => {
        const participants = detailsSharing.bill_sharing_participants || [];
        const totalAmount = Number(detailsSharing?.total_amount || 0);
        const directTotalOwed = participants.reduce((sum, p) => sum + Number(p?.amount_owed || 0), 0);
        const directCollected = participants.filter(p => p?.payment_status === 'paid').reduce((sum, p) => sum + Number(p?.amount_owed || 0), 0);
        const fundCovered = Math.max(0, totalAmount - directTotalOwed);
        const directOutstanding = Math.max(0, directTotalOwed - directCollected);

        const expenseRows = (detailsSharing.bill_sharing_expenses || []).map((e, idx) => {
          const ex = e?.expenses || {};
          const dateStr = ex?.expense_date ? new Date(ex.expense_date).toLocaleDateString('vi-VN') : '';
          return (
            <tr key={idx} className="border-b last:border-0">
              <td className="px-4 py-2 text-sm text-gray-800">{ex.description || '-'}</td>
              <td className="px-4 py-2 text-sm text-gray-600">{ex.category || '-'}</td>
              <td className="px-4 py-2 text-sm text-gray-600">{dateStr || '-'}</td>
              <td className="px-4 py-2 text-sm font-medium text-gray-900">{formatVND(Number(ex.amount || 0))}</td>
            </tr>
          );
        });

        return (
          <div className="fixed inset-0 z-50">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setDetailsSharing(null)} />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Sharing Details</h3>
                    <p className="text-sm text-gray-600">Date: {new Date(detailsSharing.sharing_date).toLocaleDateString('vi-VN')} • Total: {formatVND(totalAmount)}</p>
                  </div>
                  <button onClick={() => setDetailsSharing(null)} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">Linked Expenses</h4>
                    <div className="overflow-x-auto border rounded">
                      <table className="min-w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Category</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expenseRows}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded p-4">
                      <p className="text-sm text-gray-600">Fund Paid</p>
                      <p className="text-lg font-bold text-gray-900">{formatVND(fundCovered)}</p>
                    </div>
                    <div className="bg-gray-50 rounded p-4">
                      <p className="text-sm text-gray-600">Direct Owed</p>
                      <p className="text-lg font-bold text-gray-900">{formatVND(directTotalOwed)}</p>
                    </div>
                    <div className="bg-gray-50 rounded p-4">
                      <p className="text-sm text-gray-600">Direct Collected</p>
                      <p className="text-lg font-bold text-green-700">{formatVND(directCollected)}</p>
                    </div>
                    <div className="bg-gray-50 rounded p-4">
                      <p className="text-sm text-gray-600">Direct Outstanding</p>
                      <p className="text-lg font-bold text-orange-700">{formatVND(directOutstanding)}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">Participants</h4>
                    <div className="space-y-2">
                      {participants.map(p => (
                        <div key={p.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-800">{p.employees?.name || 'Unknown'}</span>
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${p.payment_method === 'fund' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                              {p.payment_method === 'fund' ? 'Fund' : 'Direct'}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium mr-3">{formatVND(Number(p.amount_owed || 0))}</span>
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${p.payment_status === 'paid' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                              {p.payment_status === 'paid' ? 'Paid' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
                  <button onClick={() => setDetailsSharing(null)} className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Close</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {toast.show && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded shadow text-sm ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.text}
        </div>
      )}
    </Layout>
  );
};

export default BillSharingPage;
