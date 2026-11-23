import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, HardHat, Building2 } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar.tsx';
import { Footer } from '../components/layout/Footer.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../services/api.ts';
import { validateWorkerSignup, validateCompanySignup } from '../lib/validations/index.ts';

const INDUSTRIES = [
  'Manufacturing & Precision Engineering',
  'Logistics, Warehousing & Supply Chain',
  'Construction & Infrastructure',
  'Automotive & OEM Components',
  'Electrical & Power Systems',
  'Textiles, Packaging & Processing',
];

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') === 'company' ? 'company' : 'worker';

  const { setSessionData, showToast } = useAuth();
  const [role, setRole] = useState<'worker' | 'company'>(initialRole);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (role === 'worker') {
      const check = validateWorkerSignup({
        full_name: fullName,
        email,
        phone,
        password,
        city,
        state,
      });
      if (!check.valid) {
        setError(check.error || 'Please check the form fields.');
        return;
      }
    } else {
      const check = validateCompanySignup({
        full_name: fullName,
        company_name: companyName,
        email,
        phone,
        password,
        industry,
        city,
        state,
      });
      if (!check.valid) {
        setError(check.error || 'Please check the form fields.');
        return;
      }
    }

    setLoading(true);
    try {
      const data = await apiRequest<{
        token: string;
        user: any;
        workerProfile: any;
        company: any;
      }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          role,
          full_name: fullName.trim(),
          company_name: role === 'company' ? companyName.trim() : undefined,
          email: email.trim(),
          phone: phone.trim(),
          password,
          industry: role === 'company' ? industry : undefined,
          city: city.trim(),
          state: state.trim(),
        }),
      });

      setSessionData(data);
      showToast(
        'success',
        'Account Created Successfully',
        role === 'worker'
          ? 'Welcome to Memployment! Complete your trade profile to start applying.'
          : 'Welcome to Memployment! Your company dashboard is ready.'
      );
      navigate(role === 'company' ? '/company' : '/worker');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-xl w-full bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Create Your Memployment Account
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Select your role below to register as a Skilled Worker or an Employer / Contractor.
            </p>
          </div>

          {/* Interactive Role Selector Tabs */}
          <div className="mt-6 grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setRole('worker');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                role === 'worker'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HardHat className="w-4 h-4" />
              <span>Register as Worker</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('company');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                role === 'company'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Register as Company</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={role === 'worker' ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  {role === 'worker' ? 'Full Name' : 'Owner / Hiring Manager Name'}
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={role === 'worker' ? 'e.g. Rajesh Kumar Verma' : 'e.g. Meera Deshpande'}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                  required
                />
              </div>

              {role === 'company' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Company / Factory / Contractor Name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Apex Heavy Manufacturing Pvt. Ltd."
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                    required
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.in"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98901 23456"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                  required
                />
              </div>
            </div>

            {role === 'company' && (
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Primary Industry Sector
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:border-slate-900 focus:outline-none"
                >
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Pune, Gurugram, Ahmedabad"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Maharashtra, Haryana, Gujarat"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Password (min 8 characters, include letters & numbers)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a secure password"
                  className="w-full px-3.5 pr-10 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              {loading
                ? 'Creating Account...'
                : role === 'worker'
                ? 'Create Worker Account'
                : 'Create Employer Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-600">
            Already have a Memployment account?{' '}
            <Link to="/login" className="font-semibold text-slate-900 hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
