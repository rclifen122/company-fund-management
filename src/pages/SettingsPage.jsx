import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building, LockKeyhole, Mail, Phone, Save, Shield, User } from 'lucide-react';
import Layout from '../components/Layout';
import PageTransition from '../components/PageTransition';
import { ErrorState, PageSkeleton } from '../components/PageState';
import { useFeedback } from '../contexts/feedback';
import { supabase } from '../supabase';
import { isDevelopmentMode } from '../utils/env';

const EMPTY_PROFILE = {
  fullName: '',
  email: '',
  phone: '',
  department: '',
  role: '',
};

const SettingsPage = () => {
  const navigate = useNavigate();
  const { showToast } = useFeedback();
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [originalEmail, setOriginalEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isDevelopmentMode()) {
        setProfile({ ...EMPTY_PROFILE, fullName: 'Quản trị viên', email: 'admin@company.local', role: 'Quản trị viên' });
        setOriginalEmail('admin@company.local');
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) throw userError || new Error('Không tìm thấy tài khoản đăng nhập.');
      const user = userData.user;

      const [profileResponse, employeeResponse] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        user.email
          ? supabase.from('employees').select('name, email, phone, department').ilike('email', user.email).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      const serverProfile = profileResponse.error ? null : profileResponse.data;
      const employee = employeeResponse.error ? null : employeeResponse.data;
      const email = user.email || serverProfile?.email || employee?.email || '';
      setOriginalEmail(email);
      setProfile({
        fullName: user.user_metadata?.full_name || user.user_metadata?.name || serverProfile?.full_name || serverProfile?.name || employee?.name || '',
        email,
        phone: employee?.phone || serverProfile?.phone || '',
        department: employee?.department || serverProfile?.department || '',
        role: serverProfile?.role === 'admin' ? 'Quản trị viên' : serverProfile?.role || '',
      });
    } catch (fetchError) {
      setError(fetchError.message || 'Không thể tải hồ sơ.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (!profile.fullName.trim()) throw new Error('Vui lòng nhập họ và tên.');
      if (!profile.email.trim()) throw new Error('Vui lòng nhập email.');

      if (!isDevelopmentMode()) {
        const updatePayload = { data: { full_name: profile.fullName.trim() } };
        if (profile.email.trim() !== originalEmail) updatePayload.email = profile.email.trim();
        const { error: updateError } = await supabase.auth.updateUser(updatePayload);
        if (updateError) throw updateError;
      }

      setOriginalEmail(profile.email.trim());
      showToast(profile.email.trim() !== originalEmail
        ? 'Đã lưu hồ sơ. Hãy kiểm tra email để xác nhận địa chỉ đăng nhập mới.'
        : 'Đã lưu hồ sơ.');
    } catch (saveError) {
      showToast(`Không thể lưu hồ sơ: ${saveError.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <PageTransition className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hồ Sơ Tài Khoản</h1>
          <p className="mt-1 text-sm text-gray-500">Thông tin được lấy trực tiếp từ tài khoản đăng nhập và hồ sơ nhân viên trên máy chủ.</p>
        </div>

        {loading ? <PageSkeleton rows={4} /> : error ? <ErrorState message={error} onRetry={fetchProfile} /> : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-5 dark:border-gray-700">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-700"><User className="h-6 w-6" /></div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">Thông tin đăng nhập</h2>
                  <p className="text-sm text-gray-500">Tên hiển thị và email có thể chỉnh sửa.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  <span className="flex items-center gap-2"><User className="h-4 w-4" /> Họ và tên</span>
                  <input value={profile.fullName} onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700" />
                </label>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  <span className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email đăng nhập</span>
                  <input type="email" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700" />
                </label>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  <span className="flex items-center gap-2"><Phone className="h-4 w-4" /> Số điện thoại</span>
                  <input value={profile.phone} readOnly placeholder="Chưa có thông tin" className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-700" />
                </label>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  <span className="flex items-center gap-2"><Building className="h-4 w-4" /> Phòng ban</span>
                  <input value={profile.department} readOnly placeholder="Chưa có thông tin" className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-700" />
                </label>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200 sm:col-span-2">
                  <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> Quyền hệ thống</span>
                  <input value={profile.role} readOnly placeholder="Chưa được gán quyền" className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-700" />
                </label>
              </div>

              <div className="mt-6 flex justify-end">
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                  <Save className="h-4 w-4" /> {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
                </button>
              </div>
            </form>

            <aside className="h-fit rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <LockKeyhole className="h-6 w-6 text-indigo-600" />
              <h2 className="mt-3 font-semibold text-gray-900 dark:text-white">Bảo mật tài khoản</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">Đổi mật khẩu nếu bạn nghi ngờ tài khoản đã bị truy cập trái phép.</p>
              <button type="button" onClick={() => navigate('/update-password')} className="mt-5 w-full rounded-lg border border-indigo-200 px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
                Đổi mật khẩu
              </button>
            </aside>
          </div>
        )}
      </PageTransition>
    </Layout>
  );
};

export default SettingsPage;
