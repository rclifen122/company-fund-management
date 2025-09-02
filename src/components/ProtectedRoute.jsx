import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setHasSession(Boolean(data?.session));
      setReady(true);
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setHasSession(Boolean(session));
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (!ready) return null;
  if (!hasSession) return <Navigate to="/login" replace state={{ from: location }} />;
  return <div>{children}</div>;
};

export default ProtectedRoute;
