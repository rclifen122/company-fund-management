import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import { isDevelopmentMode } from '../utils/env';

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [accessCheckError, setAccessCheckError] = useState(null);

  useEffect(() => {
    let mounted = true;
    let accessCheckSequence = 0;
    const pendingTimers = new Set();
    
    // In demo/dev mode, bypass auth enforcement
    if (isDevelopmentMode()) {
      setHasSession(true);
      setIsAdmin(true);
      setReady(true);
      return;
    }

    const checkAccess = async (user) => {
      const checkId = ++accessCheckSequence;
      setReady(false);

      if (!user) {
        if (!mounted || checkId !== accessCheckSequence) return;
        setHasSession(false);
        setIsAdmin(false);
        setUserEmail('');
        setAccessCheckError(null);
        setReady(true);
        return;
      }

      const { data: adminAllowed, error } = await supabase.rpc('is_app_admin');
      if (!mounted || checkId !== accessCheckSequence) return;

      setHasSession(true);
      setIsAdmin(!error && adminAllowed === true);
      setUserEmail(user.email || '');
      setAccessCheckError(error?.message || null);
      setReady(true);
    };

    const init = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;
      await checkAccess(error ? null : data?.user);
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      // Defer database access until the auth callback has returned.
      const timer = setTimeout(() => {
        pendingTimers.delete(timer);
        void checkAccess(session?.user || null);
      }, 0);
      pendingTimers.add(timer);
    });
    return () => {
      mounted = false;
      pendingTimers.forEach(timer => clearTimeout(timer));
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (!ready) return null;
  if (!hasSession) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Không có quyền truy cập</h1>
          <p className="mt-3 text-gray-600">
            {accessCheckError
              ? 'Không thể xác minh quyền quản trị. Vui lòng thử đăng nhập lại.'
              : `Tài khoản ${userEmail || 'hiện tại'} chưa được cấp quyền admin.`}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Dữ liệu tài chính được bảo vệ và sẽ không hiển thị dưới dạng 0đ cho tài khoản không có quyền.
          </p>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              setHasSession(false);
              setIsAdmin(false);
            }}
            className="mt-6 rounded-xl bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }
  return <div>{children}</div>;
};

export default ProtectedRoute;
