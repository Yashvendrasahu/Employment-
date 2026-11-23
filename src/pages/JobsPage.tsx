import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  MapPin,
  Bookmark,
  BookmarkCheck,
  Building2,
  Calendar,
  Users,
  SlidersHorizontal,
} from 'lucide-react';
import { Navbar } from '../components/layout/Navbar.tsx';
import { Footer } from '../components/layout/Footer.tsx';
import { JobApplyModal } from '../components/jobs/JobApplyModal.tsx';
import { apiRequest } from '../services/api.ts';
import { Job } from '../types/database.ts';
import { useAuth } from '../context/AuthContext.tsx';

const CATEGORIES = [
  'All',
  'CNC & Precision Machining',
  'Electrical & Maintenance',
  'Welding & Fabrication',
  'Logistics & Warehouse',
  'Construction & Civil',
  'Assembly & Quality Control',
];

const EMPLOYMENT_TYPES = [
  'All',
  'Full-Time',
  'Contract',
  'Shift-Based',
  'Daily Wage',
  'Apprenticeship',
];

export function JobsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, showToast } = useAuth();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [applyModalJob, setApplyModalJob] = useState<Job | null>(null);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<string[]>([]);

  // Filter states initialized from URL query params
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'All');
  const [employmentType, setEmploymentType] = useState(
    searchParams.get('employment_type') || 'All'
  );
  const [minSalary, setMinSalary] = useState(searchParams.get('min_salary') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 8,
    totalPages: 1,
  });

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (location.trim()) params.set('location', location.trim());
      if (category && category !== 'All') params.set('category', category);
      if (employmentType && employmentType !== 'All')
        params.set('employment_type', employmentType);
      if (minSalary) params.set('min_salary', minSalary);
      params.set('sort', sort);
      params.set('page', String(page));
      params.set('limit', '8');

      const res = await apiRequest<{
        jobs: Job[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      }>(`/api/jobs?${params.toString()}`);

      setJobs(res.jobs || []);
      setPagination(res.pagination);

      const preselectedId = searchParams.get('selected');
      if (preselectedId) {
        const match = (res.jobs || []).find((j) => j.id === preselectedId);
        if (match) {
          setSelectedJob(match);
        }
      } else if (res.jobs?.length > 0 && !selectedJob) {
        setSelectedJob(res.jobs[0]);
      }
    } catch (err: any) {
      showToast('error', 'Failed to load jobs', err.message);
    } finally {
      setLoading(false);
    }
  }, [q, location, category, employmentType, minSalary, sort, page, searchParams, showToast]);

  const fetchWorkerSavedAndApplied = useCallback(async () => {
    if (user?.role !== 'worker') return;
    try {
      const res = await apiRequest<{
        applications: any[];
        savedJobs: any[];
      }>('/api/worker/dashboard');
      setSavedJobIds((res.savedJobs || []).map((s) => s.job_id));
      setAppliedJobIds((res.applications || []).map((a) => a.job_id));
    } catch {
      // Ignore if unauthenticated
    }
  }, [user]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    fetchWorkerSavedAndApplied();
  }, [fetchWorkerSavedAndApplied]);

  const handleToggleSave = async (jobId: string) => {
    if (!user) {
      showToast('info', 'Sign in required', 'Please sign in as a worker to save jobs.');
      navigate('/login');
      return;
    }
    if (user.role !== 'worker') {
      showToast('info', 'Worker feature only', 'Only worker accounts can bookmark jobs.');
      return;
    }
    try {
      const res = await apiRequest<{ saved: boolean; message: string }>(
        '/api/worker/saved-jobs',
        {
          method: 'POST',
          body: JSON.stringify({ job_id: jobId }),
        }
      );
      if (res.saved) {
        setSavedJobIds((prev) => [...prev, jobId]);
      } else {
        setSavedJobIds((prev) => prev.filter((id) => id !== jobId));
      }
      showToast('success', res.message);
    } catch (err: any) {
      showToast('error', 'Failed to update saved job', err.message);
    }
  };

  const handleApplyClick = (job: Job) => {
    if (!user) {
      showToast('info', 'Sign in to Apply', 'Please sign in with your worker account to apply.');
      navigate('/login');
      return;
    }
    if (user.role !== 'worker') {
      showToast(
        'info',
        'Worker Account Required',
        'Switch to a worker account to submit job applications.'
      );
      return;
    }
    setApplyModalJob(job);
  };

  const resetFilters = () => {
    setQ('');
    setLocation('');
    setCategory('All');
    setEmploymentType('All');
    setMinSalary('');
    setSort('newest');
    setPage(1);
    setSearchParams({});
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      {/* Search & Filter Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">
                Verified Industrial & Trade Job Openings
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Showing <span className="font-mono tabular-nums font-semibold">{pagination.total}</span>{' '}
                published positions from verified companies and contractors.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-slate-600 whitespace-nowrap">
                Sort by:
              </label>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                <option value="newest">Newest Published</option>
                <option value="salary_high">Highest Monthly Pay</option>
                <option value="deadline">Closing Soon</option>
                {user?.role === 'worker' && (
                  <option value="match">Best Skill & Location Match</option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-4 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search title, skill (e.g. CNC, MIG Welding, PLC)..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="lg:col-span-2 relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setPage(1);
                }}
                placeholder="City or State..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="lg:col-span-2">
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:border-slate-900 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c === 'All' ? 'All Categories' : c}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <select
                value={employmentType}
                onChange={(e) => {
                  setEmploymentType(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:border-slate-900 focus:outline-none"
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === 'All' ? 'All Shift/Work Types' : t}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2 flex items-center gap-2">
              <input
                type="number"
                value={minSalary}
                onChange={(e) => {
                  setMinSalary(e.target.value);
                  setPage(1);
                }}
                placeholder="Min Pay (₹)"
                className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Job Feed & Detail Panel */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-36 bg-white rounded-xl border border-slate-200 animate-pulse p-5"
                />
              ))}
            </div>
            <div className="lg:col-span-7 h-96 bg-white rounded-xl border border-slate-200 animate-pulse p-6" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <SlidersHorizontal className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              No Matching Published Jobs Found
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
              Try clearing your location, minimum salary, or category filters to see all available
              vacancies.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Job List + Pagination */}
            <div className="lg:col-span-5 space-y-3">
              {jobs.map((job) => {
                const isSelected = selectedJob?.id === job.id;
                const isSaved = savedJobIds.includes(job.id);
                const isApplied = appliedJobIds.includes(job.id);

                return (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className={`p-5 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-white border-slate-900 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span className="font-medium text-slate-700 truncate">
                            {job.company_name}
                          </span>
                          {job.company_verified === 'verified' && (
                            <>
                              <span>·</span>
                              <span className="text-emerald-700 font-medium">Verified</span>
                            </>
                          )}
                        </div>
                        <h3 className="font-display text-base font-bold text-slate-900 mt-1">
                          {job.title}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSave(job.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-900 shrink-0 cursor-pointer"
                        title={isSaved ? 'Remove from saved jobs' : 'Save job'}
                      >
                        {isSaved ? (
                          <BookmarkCheck className="w-4 h-4 text-amber-600" />
                        ) : (
                          <Bookmark className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Clean Unboxed Metadata */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-2">
                      <span>
                        {job.city}, {job.state}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{job.employment_type}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {job.experience_required}+ yrs exp
                      </span>
                      {job.match_score !== undefined && job.match_score > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums font-semibold text-amber-700">
                            {job.match_score}% Match
                          </span>
                        </>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="font-mono tabular-nums font-bold text-slate-900">
                        ₹{job.salary_min.toLocaleString('en-IN')} – ₹
                        {job.salary_max.toLocaleString('en-IN')}{' '}
                        <span className="font-normal text-slate-500">/ {job.salary_type}</span>
                      </span>
                      <span className="font-mono tabular-nums text-slate-500">
                        {isApplied ? (
                          <span className="text-emerald-700 font-semibold">Applied ✓</span>
                        ) : (
                          `${job.vacancies} vacancies`
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="pt-3 flex items-center justify-between text-xs text-slate-600">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3.5 py-2 font-medium bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="font-mono tabular-nums">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    className="px-3.5 py-2 font-medium bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: Job Detail View */}
            <div className="lg:col-span-7">
              {selectedJob ? (
                <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 sticky top-20">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200">
                    <div className="flex items-start gap-4">
                      {selectedJob.company_logo ? (
                        <img
                          src={selectedJob.company_logo}
                          alt={selectedJob.company_name || 'Company logo'}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                          <Building2 className="w-6 h-6 text-slate-500" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <span className="font-semibold text-slate-900">
                            {selectedJob.company_name}
                          </span>
                          {selectedJob.company_verified === 'verified' && (
                            <>
                              <span>·</span>
                              <span className="text-emerald-700 font-medium">
                                Verified Employer
                              </span>
                            </>
                          )}
                        </div>
                        <h2 className="font-display text-xl font-bold text-slate-900 mt-1">
                          {selectedJob.title}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5">
                          <span>
                            {selectedJob.city}, {selectedJob.state}
                          </span>
                          <span>·</span>
                          <span>{selectedJob.category}</span>
                          <span>·</span>
                          <span>{selectedJob.employment_type}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleSave(selectedJob.id)}
                        className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {savedJobIds.includes(selectedJob.id) ? 'Saved ✓' : 'Save Job'}
                      </button>

                      {appliedJobIds.includes(selectedJob.id) ? (
                        <span className="px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg whitespace-nowrap">
                          Already Applied ✓
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApplyClick(selectedJob)}
                          className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Apply Now
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-slate-200 text-xs">
                    <div>
                      <p className="text-slate-500">Salary Range</p>
                      <p className="font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                        ₹{selectedJob.salary_min.toLocaleString('en-IN')} – ₹
                        {selectedJob.salary_max.toLocaleString('en-IN')}
                      </p>
                      <p className="text-[11px] text-slate-400">per {selectedJob.salary_type}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Required Experience</p>
                      <p className="font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                        {selectedJob.experience_required} Years Min
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Open Vacancies</p>
                      <p className="font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                        {selectedJob.vacancies} Positions
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Apply Before</p>
                      <p className="font-mono tabular-nums font-bold text-slate-900 mt-0.5">
                        {selectedJob.application_deadline}
                      </p>
                    </div>
                  </div>

                  {/* Required Skills */}
                  <div className="py-5 border-b border-slate-200">
                    <h3 className="text-xs font-semibold text-slate-900 mb-2">
                      Required Trade Skills & Equipment
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                      {selectedJob.skills_required.map((skill, idx) => (
                        <React.Fragment key={skill}>
                          <span
                            className={
                              selectedJob.matched_skills?.includes(skill)
                                ? 'font-semibold text-emerald-700'
                                : 'text-slate-700'
                            }
                          >
                            {skill}
                            {selectedJob.matched_skills?.includes(skill) ? ' (Matched)' : ''}
                          </span>
                          {idx < selectedJob.skills_required.length - 1 && (
                            <span className="text-slate-300" aria-hidden="true">
                              ·
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Description, Responsibilities, Requirements */}
                  <div className="space-y-5 pt-5 text-sm text-slate-700 leading-relaxed">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-900 mb-1.5">
                        Role Overview
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 whitespace-pre-line">
                        {selectedJob.description}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold text-slate-900 mb-1.5">
                        Shop-Floor / Site Responsibilities
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 whitespace-pre-line">
                        {selectedJob.responsibilities}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold text-slate-900 mb-1.5">
                        Candidate Requirements & Trade Qualifications
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 whitespace-pre-line">
                        {selectedJob.requirements}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {applyModalJob && (
        <JobApplyModal
          job={applyModalJob}
          onClose={() => setApplyModalJob(null)}
          onSuccess={() => {
            setAppliedJobIds((prev) => [...prev, applyModalJob.id]);
            setApplyModalJob(null);
          }}
        />
      )}

      <Footer />
    </div>
  );
}
