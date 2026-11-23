import React from 'react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-slate-800">
          <div className="md:col-span-1 space-y-3">
            <Link
              to="/"
              className="font-display text-xl font-bold tracking-tight text-white block"
            >
              Memployment
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed">
              Find Work. Hire Faster. Build Better Opportunities. The centralized industrial,
              manufacturing, construction, and skilled-trade employment marketplace.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white tracking-wide">For Skilled Workers</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/jobs" className="hover:text-white transition-colors">
                  Browse Published Jobs
                </Link>
              </li>
              <li>
                <Link to="/signup?role=worker" className="hover:text-white transition-colors">
                  Create Worker Profile
                </Link>
              </li>
              <li>
                <Link to="/worker" className="hover:text-white transition-colors">
                  Track Job Applications
                </Link>
              </li>
              <li>
                <Link to="/worker" className="hover:text-white transition-colors">
                  Upload Trade Resume
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white tracking-wide">
              For Companies & Contractors
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/signup?role=company" className="hover:text-white transition-colors">
                  Register Employer Account
                </Link>
              </li>
              <li>
                <Link to="/company" className="hover:text-white transition-colors">
                  Post Industrial & Factory Jobs
                </Link>
              </li>
              <li>
                <Link to="/company" className="hover:text-white transition-colors">
                  Shortlist Verified Technicians
                </Link>
              </li>
              <li>
                <Link to="/company" className="hover:text-white transition-colors">
                  Employer Verification
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-white tracking-wide">
              Platform Trust & Security
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every employer registration and trade license undergoes administrative verification.
              Direct company payroll with statutory ESIC/PF transparency and zero middleman fees.
            </p>
            <div className="pt-1 text-xs text-slate-400">
              <Link to="/login" className="text-amber-400 hover:underline">
                Account Sign In →
              </Link>
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} Memployment Platform. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/jobs" className="hover:text-white transition-colors">
              Verified Jobs
            </Link>
            <span>·</span>
            <Link to="/login" className="hover:text-white transition-colors">
              Worker Portal
            </Link>
            <span>·</span>
            <Link to="/login" className="hover:text-white transition-colors">
              Employer Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
