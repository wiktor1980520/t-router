import { type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import Dashboard from './pages/Dashboard';
import ApiKeys from './pages/Keys';
import Billing from './pages/Billing';
import Team from './pages/Team';
import Settings from './pages/Settings';
import Playground from './pages/Playground';
import LandingPage from './pages/Landing';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/Users';
import AdminUserDetail from './pages/admin/UserDetail';
import AdminModels from './pages/admin/Models';
import AdminTransactions from './pages/admin/Transactions';
import AdminSystemConfig from './pages/admin/SystemConfig';
import AdminInvitationCodes from './pages/admin/InvitationCodes';
import AdminAnalytics from './pages/admin/Analytics';
import AdminSubscriptionPlans from './pages/admin/SubscriptionPlans';
import Layout from './components/Layout';

const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  const { t } = useTranslation();
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-gray-950 text-white">{t('common.loading')}</div>;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const PublicRoute = ({ children }: { children: ReactElement }) => {
  const { token } = useAuth();

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          
          <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="keys" element={<ApiKeys />} />
            <Route path="playground" element={<Playground />} />
            <Route path="billing" element={<Billing />} />
            <Route path="team" element={<Team />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserDetail />} />
            <Route path="models" element={<AdminModels />} />
            <Route path="transactions" element={<AdminTransactions />} />
            <Route path="invitation-codes" element={<AdminInvitationCodes />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="subscriptions" element={<AdminSubscriptionPlans />} />
            <Route path="config" element={<AdminSystemConfig />} />
          </Route>

          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
