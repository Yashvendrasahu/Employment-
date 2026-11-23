import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.tsx';

/**
 * Enforces the 3-Zone Top Bar Contract:
 * Zone 1: Single text element wordmark (no adjacent badges/subtitles)
 * Zone 2: 4–5 concise single-line text navigation links
 * Zone 3: 1 primary action button
 */
export function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const dashboardRoute =
    user?.role === 'admin'
      ? '/admin'
      : user?.role === 'company'
      ? '/company'
      : user?.role === 'worker'
      ? '/worker'
      : '/login';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-4">
        {/* Zone 1: Single text element wordmark */}
        <Link
          to="/"
          className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Memployment
        </Link>

        {/* Zone 2: 4–5 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <Link
            to="/jobs"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Find Jobs
          </Link>
          <a
            href="/#categories"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Categories
          </a>
          <a
            href="/#how-it-works"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            How It Works
          </a>
          <a
            href="/#employers"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            For Employers
          </a>
          {user ? (
            <Link
              to={dashboardRoute}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              My Workspace
            </Link>
          ) : (
            <Link
              to="/login"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </Link>
          )}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          {user ? (
            <button
              type="button"
              onClick={() => navigate(dashboardRoute)}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {user.role === 'admin'
                ? 'Admin Console'
                : user.role === 'company'
                ? 'Employer Dashboard'
                : 'Worker Dashboard'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Create Account
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
