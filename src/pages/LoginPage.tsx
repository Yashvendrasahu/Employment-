import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, KeyRound } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar.tsx';
import { Footer } from '../components/layout/Footer.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../services/api.ts';
import { validateEmail, validatePassword } from '../lib/validations/index.ts';

export function LoginPage() {
  const navigate = useNavigate();
  const { setSessionData, showToast } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password state
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetPhone, setResetPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      setError(emailCheck.error || 'Invalid email');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest<{
        token: string;
        user: any;
        workerProfile: any;
        company: any;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      setSessionData(data);
      showToast('success', `Welcome back, ${data.user.full_name}`);

      if (data.user.role === 'admin') {
        navigate('/admin');
      } else if (data.user.role === 'company') {
        navigate('/company');
      } else {
        navigate('/worker');
      }
    } catch (err: any) {
      setError(err.message || 'Sign in failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetMessage(null);

    const emailCheck = validateEmail(resetEmail);
    if (!emailCheck.valid) {
      setError(emailCheck.error || 'Invalid email');
      return;
    }
    const passCheck = validatePassword(newPassword);
    if (!passCheck.valid) {
      setError(passCheck.error || 'Weak password');
      return;
    }

    setResetLoading(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: resetEmail.trim(),
          phone: resetPhone.trim(),
          new_password: newPassword,
        }),
      });
      setResetMessage(res.message);
      setEmail(resetEmail.trim());
      setPassword('');
      setTimeout(() => {
        setResetMode(false);
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Password reset failed.');
    } finally {
      setResetLoading(false);
    }
  };

  const fillQuickAccount = (roleType: 'worker' | 'company' | 'admin') => {
    setError(null);
    if (roleType === 'worker') {
      setEmail('rajesh.kumar@memployment.in');
      setPassword('Worker@1234');
    } else if (roleType === 'company') {
      setEmail('hr@apexmanufacturing.in');
      setPassword('Company@1234');
    } else {
      setEmail('admin@memployment.in');
      setPassword('Admin@1234');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          {!resetMode ? (
            <>
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900">
                  Sign in to Memployment
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Access your worker profile, company recruitment hub, or admin console.
                </p>
              </div>

              {/* Quick Demo Role Switcher for Testing Seeded Database Accounts */}
              <div className="mt-5 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-[11px] font-semibold text-slate-600 mb-2">
                  Quick Fill Seeded Database Accounts (For Testing Workflows):
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => fillQuickAccount('worker')}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                  >
                    Worker Demo
                  </button>
                  <button
                    type="button"
                    onClick={() => fillQuickAccount('company')}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                  >
                    Company Demo
                  </button>
                  <button
                    type="button"
                    onClick={() => fillQuickAccount('admin')}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                  >
                    Admin Demo
                  </button>
                </div>
              </div>

              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-800">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setResetMode(true);
                        setError(null);
                        setResetEmail(email);
                      }}
                      className="text-xs font-medium text-amber-700 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-10 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-slate-600">
                Don’t have an account yet?{' '}
                <Link to="/signup" className="font-semibold text-slate-900 hover:underline">
                  Create Worker or Company Account
                </Link>
              </p>
            </>
          ) : (
            <>
              <div>
                <h1 className="font-display text-xl font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-600" />
                  <span>Reset Your Password</span>
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  Enter your registered email and phone number to set a new password.
                </p>
              </div>

              <form onSubmit={handlePasswordReset} className="mt-5 space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {error}
                  </div>
                )}
                {resetMessage && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                    {resetMessage}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Registered Email Address
                  </label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Registered Phone Number (for verification)
                  </label>
                  <input
                    type="text"
                    value={resetPhone}
                    onChange={(e) => setResetPhone(e.target.value)}
                    placeholder="+91 98901 23456"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    New Password (min 8 chars, letters + numbers)
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New strong password"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                    required
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResetMode(false);
                      setError(null);
                    }}
                    className="flex-1 py-2.5 px-4 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg cursor-pointer"
                  >
                    {resetLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
