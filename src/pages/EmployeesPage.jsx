import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, PiggyBank, Plus, Receipt, Search, Settings2, UserMinus, Users } from 'lucide-react';
import Layout from '../components/Layout';
import PageTransition from '../components/PageTransition';
import EmployeeModal from '../components/EmployeeModal';
import EmployeeMembershipModal from '../components/EmployeeMembershipModal';
import { ErrorState, PageSkeleton } from '../components/PageState';
import { useFeedback } from '../contexts/feedback';
import { supabase } from '../supabase';
import { isDevelopmentMode } from '../utils/env';
import {
  EMPLOYEE_MEMBERSHIP,
  getEmployeeMembershipMode,
  getMembershipUpdate,
} from '../utils/employeeMembership';

const MODE_LABELS = {
  [EMPLOYEE_MEMBERSHIP.FUND]: 'Đang tham gia Quỹ',
  [EMPLOYEE_MEMBERSHIP.DIRECT]: 'Thu trực tiếp từng khoản',
  [EMPLOYEE_MEMBERSHIP.INACTIVE]: 'Đã ngừng tham gia',
};

const MODE_STYLES = {
  [EMPLOYEE_MEMBERSHIP.FUND]: 'bg-emerald-100 text-emerald-800',
  [EMPLOYEE_MEMBERSHIP.DIRECT]: 'bg-blue-100 text-blue-800',
  [EMPLOYEE_MEMBERSHIP.INACTIVE]: 'bg-slate-100 text-slate-700',
};

const EmployeesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast, confirmAction } = useFeedback();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [membershipEmployee, setMembershipEmployee] = useState(null);
  const [savingMembership, setSavingMembership] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const fetchEmployeesData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (isDevelopmentMode()) {
        setEmployees([
          { id: 1, name: 'Nguyễn Văn A', status: 'active', leave_date: null, participates_in_fund: true, current_month_status: 'paid' },
          { id: 2, name: 'Trần Thị B', status: 'active', leave_date: null, participates_in_fund: false, current_month_status: 'direct' },
          { id: 3, name: 'Lê Văn C', status: 'inactive', leave_date: '2024-05-01', participates_in_fund: false, current_month_status: 'inactive' },
        ]);
        setLoading(false);
        return;
      }

      const [employeesResponse, paymentsResponse, reconciliationsResponse] = await Promise.all([
        supabase.from('employees').select('*').order('name', { ascending: true }),
        supabase.from('fund_payments').select('employee_id, payment_date, months_covered'),
        supabase.from('fund_payment_reconciliations').select('employee_id, month_key'),
      ]);

      if (employeesResponse.error) throw employeesResponse.error;
      if (paymentsResponse.error) throw paymentsResponse.error;

      const payments = paymentsResponse.data || [];
      const reconciliations = reconciliationsResponse.error ? [] : reconciliationsResponse.data || [];
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      setEmployees((employeesResponse.data || []).map((employee) => {
        const coveredMonths = new Set(
          payments
            .filter((payment) => String(payment.employee_id) === String(employee.id))
            .flatMap((payment) => (
              Array.isArray(payment.months_covered) && payment.months_covered.length > 0
                ? payment.months_covered
                : [String(payment.payment_date || '').slice(0, 7)]
            ))
        );
        reconciliations
          .filter((item) => String(item.employee_id) === String(employee.id))
          .forEach((item) => coveredMonths.add(item.month_key));

        const mode = getEmployeeMembershipMode(employee);
        const currentMonthStatus = mode === EMPLOYEE_MEMBERSHIP.FUND
          ? coveredMonths.has(currentMonthKey) ? 'paid' : 'pending'
          : mode;
        return { ...employee, current_month_status: currentMonthStatus };
      }));
    } catch (error) {
      console.error('Không thể tải danh sách nhân viên:', error);
      setLoadError(error.message || 'Đã xảy ra lỗi không xác định.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployeesData();
  }, [fetchEmployeesData]);

  useEffect(() => {
    if (isDevelopmentMode()) return undefined;
    const channel = supabase
      .channel('employees-page-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, fetchEmployeesData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_payments' }, fetchEmployeesData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchEmployeesData]);

  const handleEmployeeSubmit = async (employeeData) => {
    const isInactive = employeeData.status === 'inactive' || Boolean(employeeData.leave_date);
    const normalizedData = {
      name: employeeData.name.trim(),
      email: employeeData.email.trim(),
      phone: employeeData.phone.trim(),
      department: employeeData.department,
      monthly_contribution_amount: Number(employeeData.monthly_contribution_amount),
      join_date: employeeData.join_date,
      leave_date: employeeData.leave_date || null,
      status: isInactive ? 'inactive' : 'active',
      participates_in_fund: isInactive ? false : employeeData.participates_in_fund !== false,
    };

    try {
      if (isDevelopmentMode()) {
        setEmployees((current) => [{ id: `demo-${Date.now()}`, ...normalizedData, current_month_status: normalizedData.participates_in_fund ? 'pending' : 'direct' }, ...current]);
      } else {
        const { error } = await supabase.from('employees').insert([normalizedData]);
        if (error) throw error;
        await fetchEmployeesData();
      }
      setShowCreateForm(false);
      showToast('Đã thêm nhân viên mới.');
    } catch (error) {
      showToast(`Không thể thêm nhân viên: ${error.message}`, 'error');
      throw error;
    }
  };

  const applyMembershipMode = async (employeeIds, mode) => {
    const updateData = getMembershipUpdate(mode);
    if (isDevelopmentMode()) {
      setEmployees((current) => current.map((employee) => (
        employeeIds.includes(employee.id) ? { ...employee, ...updateData, current_month_status: mode } : employee
      )));
      return;
    }
    const { error } = await supabase.from('employees').update(updateData).in('id', employeeIds);
    if (error) throw error;
    await fetchEmployeesData();
  };

  const handleMembershipChange = async (mode) => {
    if (!membershipEmployee) return;
    setSavingMembership(true);
    try {
      await applyMembershipMode([membershipEmployee.id], mode);
      showToast(`Đã chuyển ${membershipEmployee.name} sang “${MODE_LABELS[mode]}”.`);
      setMembershipEmployee(null);
    } catch (error) {
      showToast(`Không thể cập nhật: ${error.message}`, 'error');
    } finally {
      setSavingMembership(false);
    }
  };

  const handleBulkChange = async (mode) => {
    if (selectedIds.size === 0) return;
    const accepted = await confirmAction({
      title: 'Cập nhật nhiều nhân viên',
      message: `Chuyển ${selectedIds.size} nhân viên sang “${MODE_LABELS[mode]}”? Lịch sử cũ vẫn được giữ nguyên.`,
      confirmLabel: 'Cập nhật',
      tone: mode === EMPLOYEE_MEMBERSHIP.INACTIVE ? 'danger' : 'primary',
    });
    if (!accepted) return;

    setSavingMembership(true);
    try {
      await applyMembershipMode([...selectedIds], mode);
      showToast(`Đã cập nhật ${selectedIds.size} nhân viên.`);
      setSelectedIds(new Set());
    } catch (error) {
      showToast(`Không thể cập nhật hàng loạt: ${error.message}`, 'error');
    } finally {
      setSavingMembership(false);
    }
  };

  const filteredEmployees = useMemo(() => employees.filter((employee) => {
    const matchesSearch = String(employee.name || '').toLocaleLowerCase('vi-VN')
      .includes(searchTerm.trim().toLocaleLowerCase('vi-VN'));
    const matchesStatus = filterStatus === 'all' || getEmployeeMembershipMode(employee) === filterStatus;
    return matchesSearch && matchesStatus;
  }), [employees, filterStatus, searchTerm]);

  const counts = useMemo(() => ({
    all: employees.length,
    fund: employees.filter((employee) => getEmployeeMembershipMode(employee) === EMPLOYEE_MEMBERSHIP.FUND).length,
    direct: employees.filter((employee) => getEmployeeMembershipMode(employee) === EMPLOYEE_MEMBERSHIP.DIRECT).length,
    inactive: employees.filter((employee) => getEmployeeMembershipMode(employee) === EMPLOYEE_MEMBERSHIP.INACTIVE).length,
  }), [employees]);

  const setFilter = (value) => {
    setFilterStatus(value);
    setSearchParams(value === 'all' ? {} : { status: value });
    setSelectedIds(new Set());
  };

  const toggleSelection = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const renderStatus = (employee) => {
    const mode = getEmployeeMembershipMode(employee);
    return (
      <div>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${MODE_STYLES[mode]}`}>{MODE_LABELS[mode]}</span>
        {mode === EMPLOYEE_MEMBERSHIP.FUND && (
          <p className={`mt-1.5 text-xs ${employee.current_month_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
            {employee.current_month_status === 'paid' ? 'Đã nộp tháng này' : 'Chờ nộp tháng này'}
          </p>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <PageTransition className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nhân Viên</h1>
            <p className="mt-1 text-sm text-gray-500">Theo dõi hình thức tham gia quỹ, không hiển thị thông tin cá nhân.</p>
          </div>
          <button onClick={() => setShowCreateForm(true)} className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
            <Plus className="mr-2 h-4 w-4" /> Thêm nhân viên
          </button>
        </div>

        {loading ? <PageSkeleton rows={7} /> : loadError ? (
          <ErrorState message={loadError} onRetry={fetchEmployeesData} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { mode: 'all', label: 'Tất cả', count: counts.all, Icon: Users },
                { mode: 'fund', label: 'Đóng quỹ', count: counts.fund, Icon: PiggyBank },
                { mode: 'direct', label: 'Thu trực tiếp', count: counts.direct, Icon: Receipt },
                { mode: 'inactive', label: 'Đã nghỉ', count: counts.inactive, Icon: UserMinus },
              ].map(({ mode, label, count, Icon }) => (
                <button key={mode} type="button" onClick={() => setFilter(mode)} className={`rounded-xl border p-4 text-left transition ${filterStatus === mode ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-500/10' : 'border-gray-100 bg-white hover:border-indigo-200 dark:border-gray-700 dark:bg-gray-800'}`}>
                  {createElement(Icon, { className: 'h-5 w-5 text-indigo-600' })}
                  <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm theo tên nhân viên..." className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm" />
                </div>
                {selectedIds.size > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">Đã chọn {selectedIds.size}</span>
                    <button disabled={savingMembership} onClick={() => handleBulkChange(EMPLOYEE_MEMBERSHIP.FUND)} className="rounded-lg bg-emerald-100 px-3 py-2 text-xs font-medium text-emerald-800">Đóng quỹ</button>
                    <button disabled={savingMembership} onClick={() => handleBulkChange(EMPLOYEE_MEMBERSHIP.DIRECT)} className="rounded-lg bg-blue-100 px-3 py-2 text-xs font-medium text-blue-800">Thu trực tiếp</button>
                    <button disabled={savingMembership} onClick={() => handleBulkChange(EMPLOYEE_MEMBERSHIP.INACTIVE)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700">Ngừng tham gia</button>
                  </div>
                )}
              </div>
            </div>

            <div className="hidden overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 md:block">
              <table className="w-full">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-700/40">
                  <tr>
                    <th className="w-14 px-2 py-1"><label className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg hover:bg-gray-100"><input type="checkbox" className="h-5 w-5 rounded border-gray-300 text-indigo-600" aria-label="Chọn tất cả" checked={filteredEmployees.length > 0 && filteredEmployees.every((employee) => selectedIds.has(employee.id))} onChange={(event) => setSelectedIds(event.target.checked ? new Set(filteredEmployees.map((employee) => employee.id)) : new Set())} /></label></th>
                    <th className="px-4 py-3">Tên nhân viên</th>
                    <th className="px-4 py-3">Tình trạng</th>
                    <th className="w-36 px-4 py-3 text-right">Điều chỉnh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-2 py-2"><label className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg hover:bg-gray-100"><input type="checkbox" className="h-5 w-5 rounded border-gray-300 text-indigo-600" aria-label={`Chọn ${employee.name}`} checked={selectedIds.has(employee.id)} onChange={() => toggleSelection(employee.id)} /></label></td>
                      <td className="px-4 py-4 font-medium text-gray-900 dark:text-white">{employee.name}</td>
                      <td className="px-4 py-4">{renderStatus(employee)}</td>
                      <td className="px-4 py-4 text-right">
                        <button type="button" onClick={() => setMembershipEmployee(employee)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200">
                          <Settings2 className="h-4 w-4" /> Điều chỉnh
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {filteredEmployees.map((employee) => (
                <div key={employee.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-start gap-3">
                    <label className="-ml-2 -mt-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg active:bg-gray-100"><input type="checkbox" className="h-5 w-5 rounded border-gray-300 text-indigo-600" aria-label={`Chọn ${employee.name}`} checked={selectedIds.has(employee.id)} onChange={() => toggleSelection(employee.id)} /></label>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900 dark:text-white">{employee.name}</p>
                      <div className="mt-2">{renderStatus(employee)}</div>
                    </div>
                    <button type="button" onClick={() => setMembershipEmployee(employee)} className="rounded-lg border border-gray-300 p-2 text-gray-600" aria-label={`Điều chỉnh ${employee.name}`}><Settings2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>

            {filteredEmployees.length === 0 && <p className="py-10 text-center text-sm text-gray-500">Không tìm thấy nhân viên phù hợp.</p>}
          </>
        )}

        <EmployeeModal isOpen={showCreateForm} onClose={() => setShowCreateForm(false)} onSubmit={handleEmployeeSubmit} />
        <EmployeeMembershipModal employee={membershipEmployee} isOpen={Boolean(membershipEmployee)} isSaving={savingMembership} onClose={() => { if (!savingMembership) setMembershipEmployee(null); }} onSave={handleMembershipChange} />
      </PageTransition>
    </Layout>
  );
};

export default EmployeesPage;
