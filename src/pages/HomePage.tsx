import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  MapPin,
  Briefcase,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Star,
} from 'lucide-react';
import { Navbar } from '../components/layout/Navbar.tsx';
import { Footer } from '../components/layout/Footer.tsx';
import { apiRequest } from '../services/api.ts';
import { Job, PlatformStats, Review } from '../types/database.ts';
import { useAuth } from '../context/AuthContext.tsx';

const HERO_IMAGE = '/src/assets/images/hero_industrial_workforce_1794992915059.jpg';
const SPOTLIGHT_IMAGE = '/src/assets/images/worker_spotlight_facility_1794992916357.jpg';

const DEFAULT_CATEGORIES = [
  'CNC & Precision Machining',
  'Electrical & Maintenance',
  'Welding & Fabrication',
  'Logistics & Warehouse',
  'Construction & Civil',
  'Assembly & Quality Control',
];

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [searchCategory, setSearchCategory] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest<{
      stats: PlatformStats;
      featuredJobs: Job[];
      reviews: Review[];
    }>('/api/public/landing')
      .then((res) => {
        if (!active) return;
        setStats(res.stats);
        setFeaturedJobs(res.featuredJobs || []);
        setReviews(res.reviews || []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (searchLocation.trim()) params.set('location', searchLocation.trim());
    if (searchCategory) params.set('category', searchCategory);
    navigate(`/jobs?${params.toString()}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      {/* Hero Section */}
      <section className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
              <p className="text-xs font-semibold tracking-wider text-amber-400">
                Memployment · Industrial & Skilled Trade Marketplace
              </p>
              <h1
                className="font-display font-bold tracking-tight text-white leading-[1.12]"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
              >
                Find the Right Work. Build Your Future.
              </h1>
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
                Connecting skilled workers with companies, factories, and contractors through one
                trusted employment platform.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/jobs')}
                  className="px-6 py-3 text-sm font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Find Jobs
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      user?.role === 'company' ? '/company' : '/signup?role=company'
                    )
                  }
                  className="px-6 py-3 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Hire Workers
                </button>
              </div>

              {/* Search Jobs Bar */}
              <form
                onSubmit={handleSearchSubmit}
                className="mt-6 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-12 gap-2"
              >
                <div className="sm:col-span-5 flex items-center gap-2.5 px-3 py-2 border-b sm:border-b-0 sm:border-r border-slate-200">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Trade skill, CNC, Welder, Electrician..."
                    className="w-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-4 flex items-center gap-2.5 px-3 py-2 border-b sm:border-b-0 sm:border-r border-slate-200">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                    placeholder="City or state (e.g. Pune)"
                    className="w-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-3 flex items-center">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Search Jobs
                  </button>
                </div>
              </form>
            </div>

            <div className="lg:col-span-5 flex">
              <div className="relative w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-800 min-h-[280px]">
                <img
                  src={HERO_IMAGE}
                  alt="Skilled industrial technicians and engineers reviewing plant blueprints"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent flex items-end p-6">
                  <div>
                    <p className="text-xs font-medium text-amber-400">
                      Direct Factory & Contractor Payroll
                    </p>
                    <p className="text-sm font-semibold text-white mt-0.5">
                      Verified shift timings, transparent monthly salary brackets, and zero middleman commissions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Full-width 4-Column Real Database Metrics Row below Hero Split */}
          <div className="mt-14 pt-10 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-white">
                {loading ? '—' : stats?.published_jobs ?? 0}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Active Published Job Openings
              </p>
            </div>
            <div>
              <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-white">
                {loading ? '—' : stats?.verified_companies ?? 0}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Admin-Verified Employers & Plants
              </p>
            </div>
            <div>
              <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-white">
                {loading ? '—' : stats?.total_workers ?? 0}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Registered Skilled Trade Workers
              </p>
            </div>
            <div>
              <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-amber-400">
                {loading ? '—' : stats?.accepted_placements ?? 0}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Shortlisted & Accepted Placements
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Job Categories */}
      <section id="categories" className="max-w-7xl mx-auto px-6 py-16 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Popular Industrial & Trade Categories
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Filter verified openings by specialized shop-floor, site, or logistics discipline.
            </p>
          </div>
          <Link
            to="/jobs"
            className="text-xs font-semibold text-slate-900 hover:underline whitespace-nowrap"
          >
            Browse all categories →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DEFAULT_CATEGORIES.map((cat) => {
            const dbCount =
              stats?.categories.find((c) => c.category === cat)?.count ?? 0;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => navigate(`/jobs?category=${encodeURIComponent(cat)}`)}
                className="text-left p-5 bg-white rounded-xl border border-slate-200 hover:border-slate-900 transition-colors flex items-center justify-between gap-4 cursor-pointer"
              >
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900">{cat}</h3>
                  <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                    {dbCount} published {dbCount === 1 ? 'opening' : 'openings'}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            );
          })}
        </div>
      </section>

      {/* Featured Jobs Loaded from Database */}
      <section className="bg-white border-y border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">
                Featured Published Jobs
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Direct vacancies from verified manufacturing plants, warehouses, and contractors.
              </p>
            </div>
            <Link
              to="/jobs"
              className="text-xs font-semibold text-slate-900 hover:underline whitespace-nowrap"
            >
              View all {stats?.published_jobs ?? featuredJobs.length} published jobs →
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-52 rounded-xl border border-slate-200 bg-slate-100 animate-pulse p-6"
                />
              ))}
            </div>
          ) : featuredJobs.length === 0 ? (
            <div className="p-10 text-center bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-sm text-slate-600">No published jobs available right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {featuredJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-col justify-between p-6 rounded-xl border border-slate-200 bg-white hover:border-slate-400 transition-colors"
                >
                  <div>
                    {/* Clean unboxed metadata kicker */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{job.company_name}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {job.city}, {job.state}
                      </span>
                    </div>

                    <h3 className="font-display text-base font-bold text-slate-900 mt-2">
                      {job.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-2">
                      <span>{job.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{job.employment_type}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {job.experience_required}+ yrs exp
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                      {job.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono tabular-nums text-sm font-bold text-slate-900">
                        ₹{job.salary_min.toLocaleString('en-IN')} – ₹
                        {job.salary_max.toLocaleString('en-IN')}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        per {job.salary_type} · {job.vacancies} vacancies
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/jobs?selected=${job.id}`)}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      View & Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How It Works Section (Clean Human Editorial Numbering) */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-16 w-full">
        <div className="max-w-2xl mb-10">
          <h2 className="font-display text-2xl font-bold text-slate-900">
            How Memployment Works
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            A transparent, end-to-end hiring pipeline built for trade workers and industrial employers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white rounded-xl border border-slate-200">
            <h3 className="font-display text-base font-bold text-slate-900">
              01. Verified Trade Profiles & Employer Onboarding
            </h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Workers register their ITI/trade skills, experience years, and upload their resume.
              Companies submit factory or contractor registration documents for admin verification.
            </p>
          </div>
          <div className="p-6 bg-white rounded-xl border border-slate-200">
            <h3 className="font-display text-base font-bold text-slate-900">
              02. Skill-Matched Discovery & Direct Application
            </h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Workers filter openings by trade, city, shift type, and monthly pay. Our rule-based
              matching engine highlights roles that match the worker’s verified skills and location.
            </p>
          </div>
          <div className="p-6 bg-white rounded-xl border border-slate-200">
            <h3 className="font-display text-base font-bold text-slate-900">
              03. Real-Time Shortlisting & Status Tracking
            </h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Hiring managers review applicant profiles, download resumes securely, and move
              candidates from Pending to Reviewing, Shortlisted, and Accepted with instant alerts.
            </p>
          </div>
        </div>
      </section>

      {/* Worker Benefits & Company Hiring Benefits */}
      <section id="employers" className="bg-white border-y border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-5 flex">
              <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src={SPOTLIGHT_IMAGE}
                  alt="Skilled CNC machinist and electrical technician in a modern factory"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold text-amber-700">For Skilled Workers</p>
                  <h3 className="font-display text-lg font-bold text-slate-900 mt-1">
                    Genuine Factory & Site Jobs Without Middlemen
                  </h3>
                  <ul className="mt-4 space-y-2.5 text-xs text-slate-700 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>100% free registration and direct applications to verified companies.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Upfront monthly/daily salary disclosure and overtime terms.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Live status tracking from application submission to acceptance.</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => navigate('/signup?role=worker')}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Register as Worker
                  </button>
                </div>
              </div>

              <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    For Companies, Factories & Contractors
                  </p>
                  <h3 className="font-display text-lg font-bold text-slate-900 mt-1">
                    Recruit Trade-Tested Technicians Faster
                  </h3>
                  <ul className="mt-4 space-y-2.5 text-xs text-slate-700 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Publish multi-vacancy shift, full-time, or contract requirements.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Access verified worker skills, ITI credentials, and private resumes.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Shortlist, accept, or reject applicants with automated worker alerts.</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => navigate('/signup?role=company')}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors cursor-pointer"
                  >
                    Register as Employer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Genuine Database-Backed Reviews / Testimonials */}
      {reviews.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-16 w-full">
          <div className="max-w-2xl mb-8">
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Verified Placement Feedback
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Real reviews submitted by workers and employers after completed placements on Memployment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="p-6 bg-white rounded-xl border border-slate-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-1 text-amber-500 mb-3">
                    {Array.from({ length: rev.rating }).map((_, idx) => (
                      <Star key={idx} className="w-4 h-4 fill-amber-500 text-amber-500" />
                    ))}
                    <span className="ml-2 font-mono tabular-nums text-xs text-slate-600">
                      {rev.rating}.0 / 5.0
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">“{rev.review_text}”</p>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div>
                    <span className="font-semibold text-slate-900">{rev.reviewer_name}</span>
                    <span> · </span>
                    <span className="capitalize">{rev.reviewer_role}</span>
                    {rev.reviewer_city && <span> ({rev.reviewer_city})</span>}
                  </div>
                  <span className="text-slate-600 font-medium">
                    Placement: {rev.job_title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
