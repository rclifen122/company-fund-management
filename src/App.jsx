import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { PageSkeleton } from './components/PageState';
import { FeedbackProvider } from './contexts/FeedbackContext';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const UpdatePasswordPage = lazy(() => import('./pages/UpdatePasswordPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const FundCollectionPage = lazy(() => import('./pages/FundCollectionPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const BillSharingPage = lazy(() => import('./pages/BillSharingPage'));

const ProtectedPage = ({ children }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

function App() {
  return (
    <FeedbackProvider>
      <Router>
        <Suspense fallback={<div className="min-h-screen bg-gray-50 p-8"><PageSkeleton /></div>}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/update-password" element={<UpdatePasswordPage />} />
            <Route path="/" element={<ProtectedPage><HomePage /></ProtectedPage>} />
            <Route path="/employees" element={<ProtectedPage><EmployeesPage /></ProtectedPage>} />
            <Route path="/fund-collection" element={<ProtectedPage><FundCollectionPage /></ProtectedPage>} />
            <Route path="/expenses" element={<ProtectedPage><ExpensesPage /></ProtectedPage>} />
            <Route path="/settings" element={<ProtectedPage><SettingsPage /></ProtectedPage>} />
            <Route path="/bill-sharing" element={<ProtectedPage><BillSharingPage /></ProtectedPage>} />
          </Routes>
        </Suspense>
      </Router>
    </FeedbackProvider>
  );
}

export default App;
