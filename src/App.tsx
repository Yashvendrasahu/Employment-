import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { SignupPage } from './pages/SignupPage.tsx';
import { JobsPage } from './pages/JobsPage.tsx';
import { WorkerDashboardPage } from './pages/WorkerDashboardPage.tsx';
import { CompanyDashboardPage } from './pages/CompanyDashboardPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { UserRole } from './types/database.ts';

function RoleGuard({
  allowedRole,
  children,
}: {
  allowedRole: UserRole;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-600">Verifying session & role access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== allowedRole) {
    const correctPath =
      user.role === 'admin'
        ? '/admin'
        : user.role === 'company'
        ? '/company'
        : '/worker';

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-6 text-center space-y-4">
          <h1 className="font-display text-lg font-bold text-slate-900">
            Access Restricted ({allowedRole.toUpperCase()} Role Required)
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            You are currently signed in as a <strong className="capitalize">{user.role}</strong> (
            {user.email}). Role-based access control prevents accessing the {allowedRole} portal.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate(correctPath)}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer"
            >
              Go to My Dashboard
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function DashboardRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'company') return <Navigate to="/company" replace />;
  return <Navigate to="/worker" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/dashboard" element={<DashboardRedirect />} />
          <Route
            path="/worker"
            element={
              <RoleGuard allowedRole="worker">
                <WorkerDashboardPage />
              </RoleGuard>
            }
          />
          <Route
            path="/company"
            element={
              <RoleGuard allowedRole="company">
                <CompanyDashboardPage />
              </RoleGuard>
            }
          />
          <Route
            path="/admin"
            element={
              <RoleGuard allowedRole="admin">
                <AdminDashboardPage />
              </RoleGuard>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
