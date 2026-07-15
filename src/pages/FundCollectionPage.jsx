import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle, Clock, History, PiggyBank, Plus, TrendingUp, Users } from 'lucide-react';
import Layout from '../components/Layout';
import PaymentModal from '../components/PaymentModal';
import EmployeePaymentMatrix from '../components/EmployeePaymentMatrix';
import FundReconciliationModal from '../components/FundReconciliationModal';
import { ErrorState, PageSkeleton } from '../components/PageState';
import PageTransition from '../components/PageTransition';
import { useFeedback } from '../contexts/feedback';
import { supabase } from '../supabase';
import { isDevelopmentMode } from '../utils/env';
import { formatVND } from '../utils/format';
import {
  EMPLOYEE_MEMBERSHIP,
  getEmployeeMembershipMode,
  isActiveFundMember,
} from '../utils/employeeMembership';

const getCoveredMonthKeys = (payment) => (
  Array.isArray(payment.months_covered) && payment.months_covered.length > 0
    ? payment.months_covered
    : [String(payment.payment_date || '').slice(0, 7)].filter(Boolean)
);

const FundCollectionPage = () => {
  const { showToast } = useFeedback();
  const [employees, setEmployees] = useState([]);
  const [payments, setPayments] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [savingReconciliation, setSavingReconciliation] = useState(false);
  const [statusYear, setStatusYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');

  const fetchFundCollectionData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (isDevelopmentMode()) {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        setEmployees([
          { id: 1, name: 'Nguyễn Văn A', department: 'IT', status: 'active', leave_date: null, participates_in_fund: true, monthly_contribution_amount: 100000, join_date: `${year}-01-01` },
          { id: 2, name: 'Trần Thị B', department: 'Nhân sự', status: 'active', leave_date: null, participates_in_fund: true, monthly_contribution_amount: 100000, join_date: `${year}-01-01` },
          { id: 3, name: 'Lê Văn C', department: 'Tài chính', status: 'active', leave_date: null, participates_in_fund: false, monthly_contribution_amount: 100000, join_date: `${year}-01-01` },
          { id: 4, name: 'Phạm Thị D', department: 'Tiếp thị', status: 'inactive', leave_date: `${year}-05-01`, participates_in_fund: false, monthly_contribution_amount: 100000, join_date: `${year}-01-01` },
        ]);
        setPayments([
          { id: 1, employee_id: 1, amount: 100000, payment_date: `${year}-${month}-05`, months_covered: [`${year}-${month}`], payment_method: 'cash' },
        ]);
        setReconciliations([
          { id: 1, employee_id: 2, month_key: `${year}-01` },
          { id: 2, employee_id: 2, month_key: `${year}-02` },
        ]);
        return;
      }

      const [employeesResponse, paymentsResponse, reconciliationsResponse] = await Promise.all([
        supabase.from('employees').select('*').order('name', { ascending: true }),
        supabase.from('fund_payments').select('*').order('created_at', { ascending: false }),
        supabase.from('fund_payment_reconciliations').select('*').order('month_key', { ascending: true }),
      ]);

      if (employeesResponse.error) throw employeesResponse.error;
      if (paymentsResponse.error) throw paymentsResponse.error;

      setEmployees(employeesResponse.data || []);
      setPayments((paymentsResponse.data || []).map((payment) => ({
        ...payment,
        amount: Number(payment.amount || 0),
      })));
      // Dữ liệu đã đối soát vẫn được đọc như một tháng đã nộp, nhưng không còn
      // thao tác hay nhãn đối soát trên giao diện.
      setReconciliations(reconciliationsResponse.error ? [] : reconciliationsResponse.data || []);
    } catch (error) {
      console.error('Không thể tải dữ liệu thu quỹ:', error);
      setLoadError(error.message || 'Đã xảy ra lỗi không xác định.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFundCollectionData();
  }, [fetchFundCollectionData]);

  useEffect(() => {
    if (isDevelopmentMode()) return undefined;
    const channel = supabase
      .channel('fund-collection-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, fetchFundCollectionData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_payments' }, fetchFundCollectionData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchFundCollectionData]);

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const coveredCurrentMonth = useMemo(() => {
    const covered = new Set();
    payments.forEach((payment) => {
      if (getCoveredMonthKeys(payment).includes(currentMonthKey)) covered.add(String(payment.employee_id));
    });
    reconciliations.forEach((item) => {
      if (item.month_key === currentMonthKey) covered.add(String(item.employee_id));
    });
    return covered;
  }, [currentMonthKey, payments, reconciliations]);

  const activeFundEmployees = employees.filter(isActiveFundMember);
  const paidEmployees = activeFundEmployees.filter((employee) => coveredCurrentMonth.has(String(employee.id))).length;
  const pendingEmployees = activeFundEmployees.length - paidEmployees;
  const inactiveEmployees = employees.filter((employee) => getEmployeeMembershipMode(employee) === EMPLOYEE_MEMBERSHIP.INACTIVE).length;
  const totalCollected = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const currentMonthCollected = payments
    .filter((payment) => String(payment.payment_date || '').slice(0, 7) === currentMonthKey)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const expectedMonthlyTotal = activeFundEmployees.reduce(
    (sum, employee) => sum + Number(employee.monthly_contribution_amount || 0),
    0
  );
  const totalOutstanding = activeFundEmployees
    .filter((employee) => !coveredCurrentMonth.has(String(employee.id)))
    .reduce((sum, employee) => sum + Number(employee.monthly_contribution_amount || 0), 0);
  const collectionRate = activeFundEmployees.length > 0 ? (paidEmployees / activeFundEmployees.length) * 100 : 0;

  const statusYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = new Set([currentYear]);
    payments.forEach((payment) => {
      getCoveredMonthKeys(payment).forEach((monthKey) => years.add(Number(String(monthKey).slice(0, 4))));
      if (payment.payment_date) years.add(new Date(payment.payment_date).getFullYear());
    });
    reconciliations.forEach((item) => years.add(Number(String(item.month_key).slice(0, 4))));
    employees.forEach((employee) => {
      [employee.join_date, employee.leave_date].filter(Boolean).forEach((date) => years.add(new Date(date).getFullYear()));
    });
    return [...years].filter(Number.isInteger).sort((a, b) => b - a);
  }, [employees, payments, reconciliations]);

  const handlePaymentSubmit = async (paymentData) => {
    try {
      if (isDevelopmentMode()) {
        setPayments((current) => [{ id: `demo-${Date.now()}`, ...paymentData, amount: Number(paymentData.amount || 0) }, ...current]);
      } else {
        const { error } = await supabase.from('fund_payments').insert([{
          employee_id: paymentData.employee_id,
          amount: paymentData.amount,
          payment_date: paymentData.payment_date,
          months_covered: paymentData.months_covered,
          payment_method: paymentData.payment_method || 'cash',
          notes: paymentData.notes,
        }]);
        if (error) throw error;
        await fetchFundCollectionData();
      }
      setShowPaymentModal(false);
      showToast('Đã ghi nhận khoản thu.');
    } catch (error) {
      showToast(`Không thể ghi nhận khoản thu: ${error.message}`, 'error');
    }
  };

  const handleReconciliationSave = async ({ employeeId, year, monthKeys }) => {
    setSavingReconciliation(true);
    try {
      const existingMonths = new Set(reconciliations
        .filter((item) => String(item.employee_id) === String(employeeId) && String(item.month_key).startsWith(`${year}-`))
        .map((item) => item.month_key));
      const desiredMonths = new Set(monthKeys);
      const additions = monthKeys.filter((monthKey) => !existingMonths.has(monthKey));
      const removals = [...existingMonths].filter((monthKey) => !desiredMonths.has(monthKey));

      if (isDevelopmentMode()) {
        setReconciliations((current) => [
          ...current.filter((item) => !(String(item.employee_id) === String(employeeId) && removals.includes(item.month_key))),
          ...additions.map((monthKey) => ({ id: `demo-${employeeId}-${monthKey}`, employee_id: employeeId, month_key: monthKey })),
        ]);
      } else {
        if (additions.length > 0) {
          const { error: insertError } = await supabase
            .from('fund_payment_reconciliations')
            .upsert(additions.map((monthKey) => ({
              employee_id: employeeId,
              month_key: monthKey,
              notes: 'Đối soát dữ liệu lịch sử',
            })), { onConflict: 'employee_id,month_key' });
          if (insertError) throw insertError;
        }

        if (removals.length > 0) {
          const { error: deleteError } = await supabase
            .from('fund_payment_reconciliations')
            .delete()
            .eq('employee_id', employeeId)
            .in('month_key', removals);
          if (deleteError) throw deleteError;
        }
        await fetchFundCollectionData();
      }

      showToast(`Đã lưu đối soát năm ${year}.`);
      return true;
    } catch (error) {
      showToast(`Không thể lưu đối soát: ${error.message}`, 'error');
      return false;
    } finally {
      setSavingReconciliation(false);
    }
  };

  if (loading) return <Layout><PageSkeleton rows={7} /></Layout>;
  if (loadError) return <Layout><ErrorState title="Không thể tải dữ liệu thu quỹ" message={loadError} onRetry={fetchFundCollectionData} /></Layout>;

  return (
    <Layout>
      <PageTransition className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Thu Quỹ</h1>
            <p className="mt-1 text-sm text-gray-500">Theo dõi đóng góp và tình trạng thu quỹ của nhân viên.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={() => setShowReconciliationModal(true)} className="inline-flex items-center justify-center rounded-md border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-800 shadow-sm hover:bg-teal-100">
              <History className="mr-2 h-4 w-4" /> Đối soát lịch sử
            </button>
            <button onClick={() => setShowPaymentModal(true)} className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">
              <Plus className="mr-2 h-4 w-4" /> Nhập Quỹ
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg bg-white p-5 shadow"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Tổng Thu Được</p><p className="text-2xl font-bold text-gray-900">{formatVND(totalCollected)}</p><p className="mt-1 text-xs text-green-600">+{formatVND(currentMonthCollected)} tháng này</p></div><PiggyBank className="h-8 w-8 text-green-600" /></div></div>
          <div className="rounded-lg bg-white p-5 shadow"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Tháng Hiện Tại</p><p className="text-2xl font-bold text-gray-900">{formatVND(currentMonthCollected)}</p><p className="mt-1 text-xs text-gray-500">/ {formatVND(expectedMonthlyTotal)} dự kiến</p></div><Calendar className="h-8 w-8 text-blue-600" /></div></div>
          <div className="rounded-lg bg-white p-5 shadow"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Tỷ Lệ Thu</p><p className="text-2xl font-bold text-gray-900">{Math.round(collectionRate)}%</p><p className="mt-1 text-xs text-gray-500">{paidEmployees}/{activeFundEmployees.length} người tham gia quỹ</p></div><TrendingUp className="h-8 w-8 text-indigo-600" /></div></div>
          <div className="rounded-lg bg-white p-5 shadow"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Chưa Thu</p><p className="text-2xl font-bold text-gray-900">{formatVND(totalOutstanding)}</p><p className="mt-1 text-xs text-red-600">{pendingEmployees} người chờ nộp</p></div><Users className="h-8 w-8 text-red-600" /></div></div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between"><h2 className="text-lg font-medium text-gray-900">Tình Trạng Đóng Quỹ</h2><span className="text-sm text-gray-500">Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}</span></div>
          <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-4">
            <div className="text-center"><CheckCircle className="mx-auto h-10 w-10 rounded-full bg-green-100 p-2 text-green-600" /><p className="mt-2 text-2xl font-bold text-green-600">{paidEmployees}</p><p className="text-sm font-medium">Đã Nộp</p></div>
            <div className="text-center"><Clock className="mx-auto h-10 w-10 rounded-full bg-yellow-100 p-2 text-yellow-600" /><p className="mt-2 text-2xl font-bold text-yellow-600">{pendingEmployees}</p><p className="text-sm font-medium">Chờ Nộp</p></div>
            <div className="text-center"><AlertTriangle className="mx-auto h-10 w-10 rounded-full bg-red-100 p-2 text-red-600" /><p className="mt-2 text-2xl font-bold text-red-600">0</p><p className="text-sm font-medium">Quá Hạn</p></div>
            <div className="text-center"><CheckCircle className="mx-auto h-10 w-10 rounded-full bg-blue-100 p-2 text-blue-600" /><p className="mt-2 text-2xl font-bold text-blue-600">{inactiveEmployees}</p><p className="text-sm font-medium">Đã Nghỉ</p></div>
          </div>
          <div className="mt-6"><div className="mb-2 flex justify-between text-sm text-gray-600"><span>Tiến độ thu quỹ tháng này</span><span>{Math.round(collectionRate)}%</span></div><div className="h-2 w-full rounded-full bg-gray-200"><div className="h-2 rounded-full bg-green-600 transition-all" style={{ width: `${collectionRate}%` }} /></div></div>
        </div>

        <EmployeePaymentMatrix
          employees={employees}
          payments={payments}
          reconciliations={reconciliations}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedYear={statusYear}
          onYearChange={setStatusYear}
          availableYears={statusYears}
        />

        <PaymentModal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} employees={activeFundEmployees} onSubmit={handlePaymentSubmit} />
        <FundReconciliationModal
          isOpen={showReconciliationModal}
          employees={employees}
          payments={payments}
          reconciliations={reconciliations}
          initialYear={statusYear}
          availableYears={statusYears}
          isSaving={savingReconciliation}
          onClose={() => { if (!savingReconciliation) setShowReconciliationModal(false); }}
          onSave={handleReconciliationSave}
        />
      </PageTransition>
    </Layout>
  );
};

export default FundCollectionPage;
