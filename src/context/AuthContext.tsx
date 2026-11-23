import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Profile,
  WorkerProfile,
  Company,
  NotificationItem,
} from '../types/database.ts';
import { apiRequest, getAuthToken, setAuthToken } from '../services/api.ts';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface AuthContextValue {
  user: Profile | null;
  workerProfile: WorkerProfile | null;
  company: Company | null;
  loading: boolean;
  notifications: NotificationItem[];
  unreadCount: number;
  toasts: ToastMessage[];
  showToast: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
  dismissToast: (id: string) => void;
  setSessionData: (data: {
    token: string;
    user: Profile;
    workerProfile?: WorkerProfile | null;
    company?: Company | null;
  }) => void;
  refreshSession: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (type: 'success' | 'error' | 'info', title: string, message?: string) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!getAuthToken()) return;
    try {
      const res = await apiRequest<{ notifications: NotificationItem[] }>('/api/notifications');
      setNotifications(res.notifications || []);
    } catch {
      // Ignore silent poll errors
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setWorkerProfile(null);
      setCompany(null);
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<{
        user: Profile;
        workerProfile: WorkerProfile | null;
        company: Company | null;
      }>('/api/auth/me');
      setUser(data.user);
      setWorkerProfile(data.workerProfile);
      setCompany(data.company);
      await refreshNotifications();
    } catch {
      setAuthToken(null);
      setUser(null);
      setWorkerProfile(null);
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [refreshNotifications]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const setSessionData = useCallback(
    (data: {
      token: string;
      user: Profile;
      workerProfile?: WorkerProfile | null;
      company?: Company | null;
    }) => {
      setAuthToken(data.token);
      setUser(data.user);
      setWorkerProfile(data.workerProfile || null);
      setCompany(data.company || null);
      refreshNotifications();
    },
    [refreshNotifications]
  );

  const markNotificationRead = useCallback(async (id: string) => {
    try {
      await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err: any) {
      showToast('error', 'Failed to update notification', err.message);
    }
  }, [showToast]);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      showToast('success', 'All notifications marked as read');
    } catch (err: any) {
      showToast('error', 'Failed to mark notifications read', err.message);
    }
  }, [showToast]);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    setWorkerProfile(null);
    setCompany(null);
    setNotifications([]);
    showToast('info', 'Signed out of Memployment');
  }, [showToast]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <AuthContext.Provider
      value={{
        user,
        workerProfile,
        company,
        loading,
        notifications,
        unreadCount,
        toasts,
        showToast,
        dismissToast,
        setSessionData,
        refreshSession,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        logout,
      }}
    >
      {children}
      {/* Global Toast Container */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start justify-between gap-3 rounded-lg border p-4 shadow-md transition-all ${
                t.type === 'error'
                  ? 'bg-red-950 text-white border-red-800'
                  : t.type === 'success'
                  ? 'bg-slate-900 text-white border-slate-700'
                  : 'bg-slate-900 text-white border-slate-700'
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.message && <p className="text-xs text-slate-300 mt-0.5">{t.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-xs text-slate-400 hover:text-white shrink-0 whitespace-nowrap px-1.5 py-0.5"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
