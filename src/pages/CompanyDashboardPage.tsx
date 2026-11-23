import React, { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard,
  Building2,
  PlusCircle,
  Briefcase,
  Users,
  UserCheck,
  Bell,
  Settings,
  Upload,
  FileText,
  ExternalLink,
  Edit3,
  Trash2,
} from 'lucide-react';
import { DashboardShell, SidebarNavItem } from '../components/layout/DashboardShell.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  apiRequest,
  uploadFileToStorage,
  getAuthorizedFileUrl,
} from '../services/api.ts';
import {
  Application,
  ApplicationStatus,
  Company,
  Job,
  Profile,
  VerificationRequest,
} from '../types/database.ts';

const JOB_CATEGORIES = [
  'CNC & Precision Machining',
  'Electrical & Maintenance',
  'Welding & Fabrication',
  'Logistics & Warehouse',
  'Construction & Civil',
  'Assembly & Quality Control',
];

export function CompanyDashboardPage() {
  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    refreshSession,
    showToast,
  } = useAuth();

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [stats, setStats] = useState({
    total_jobs: 0,
    active_jobs: 0,
    pending_jobs: 0,
    total_applicants: 0,
    shortlisted_candidates: 0,
    accepted_candidates: 0,
  });

  // Selected candidate modal for detailed inspection
  const [selectedApplicant, setSelectedApplicant] = useState<Application | null>(null);

  // Company profile form state
  const [ownerName, setOwnerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  // Job creation / editing form state
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobCategory, setJobCategory] = useState(JOB_CATEGORIES[0]);
  const [jobType, setJobType] = useState('Full-Time');
  const [jobExp, setJobExp] = useState(2);
  const [jobSalaryMin, setJobSalaryMin] = useState(25000);
  const [jobSalaryMax, setJobSalaryMax] = useState(38000);
  const [jobSalaryType, setJobSalaryType] = useState('monthly');
  const [jobVacancies, setJobVacancies] = useState(5);
  const [jobSkills, setJobSkills] = useState('');
  const [jobCity, setJobCity] = useState('');
  const [jobState, setJobState] = useState('');
  const [jobDeadline, setJobDeadline] = useState('2027-04-30');
  const [jobDescription, setJobDescription] = useState('');
  const [jobResponsibilities, setJobResponsibilities] = useState('');
  const [jobRequirements, setJobRequirements] = useState('');
  const [jobStatus, setJobStatus] = useState<'published' | 'draft'>('published');
  const [submittingJob, setSubmittingJob] = useState(false);

  // Verification upload
  const [verType, setVerType] = useState<'company_registration' | 'factory_license'>(
    'company_registration'
  );
  const [verDocUrl, setVerDocUrl] = useState('');
  const [verNotes, setVerNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{
        profile: Profile;
        company: Company;
        stats: typeof stats;
        jobs: Job[];
        applicants: Application[];
        verifications: VerificationRequest[];
      }>('/api/company/dashboard');

      setProfile(data.profile);
      setCompany(data.company);
      setStats(data.stats);
      setJobs(data.jobs || []);
      setApplicants(data.applicants || []);
      setVerifications(data.verifications || []);

      if (data.profile) {
        setOwnerName(data.profile.full_name || '');
      }
      if (data.company) {
        setCompanyName(data.company.company_name || '');
        setLogoUrl(data.company.logo_url || null);
        setIndustry(data.company.industry || '');
        setDescription(data.company.description || '');
        setWebsite(data.company.website || '');
        setEmail(data.company.email || '');
        setPhone(data.company.phone || '');
        setCity(data.company.city || '');
        setState(data.company.state || '');
        if (!jobCity) setJobCity(data.company.city || '');
        if (!jobState) setJobState(data.company.state || '');
      }
    } catch (err: any) {
      showToast('error', 'Failed to load company dashboard', err.message);
    } finally {
      setLoading(false);
    }
  }, [showToast, jobCity, jobState]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleSaveCompanyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCompany(true);
    try {
      await apiRequest('/api/company/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: ownerName,
          company_name: companyName,
          logo_url: logoUrl,
          industry,
          description,
          website,
          email,
          phone,
          city,
          state,
        }),
      });
      await refreshSession();
      await loadDashboard();
      showToast('success', 'Company profile saved');
    } catch (err: any) {
      showToast('error', 'Update failed', err.message);
    } finally {
      setSavingCompany(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFileToStorage('company-logos', file);
      setLogoUrl(res.url);
      showToast('success', 'Company logo uploaded');
    } catch (err: any) {
      showToast('error', 'Logo upload failed', err.message);
    } finally {
      setUploading(false);
    }
  };

  const resetJobForm = () => {
    setEditingJobId(null);
    setJobTitle('');
    setJobCategory(JOB_CATEGORIES[0]);
    setJobType('Full-Time');
    setJobExp(2);
    setJobSalaryMin(25000);
    setJobSalaryMax(38000);
    setJobSalaryType('monthly');
    setJobVacancies(5);
    setJobSkills('');
    setJobCity(company?.city || '');
    setJobState(company?.state || '');
    setJobDeadline('2027-04-30');
    setJobDescription('');
    setJobResponsibilities('');
    setJobRequirements('');
    setJobStatus('published');
  };

  const startEditJob = (job: Job) => {
    setEditingJobId(job.id);
    setJobTitle(job.title);
    setJobCategory(job.category);
    setJobType(job.employment_type);
    setJobExp(job.experience_required);
    setJobSalaryMin(job.salary_min);
    setJobSalaryMax(job.salary_max);
    setJobSalaryType(job.salary_type);
    setJobVacancies(job.vacancies);
    setJobSkills((job.skills_required || []).join(', '));
    setJobCity(job.city);
    setJobState(job.state);
    setJobDeadline(job.application_deadline);
    setJobDescription(job.description);
    setJobResponsibilities(job.responsibilities);
    setJobRequirements(job.requirements);
    setJobStatus(job.status === 'draft' ? 'draft' : 'published');
    setActiveTab('post-job');
  };

  const handleJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingJob(true);
    try {
      const skillsArray = jobSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        title: jobTitle,
        category: jobCategory,
        employment_type: jobType,
        experience_required: Number(jobExp),
        salary_min: Number(jobSalaryMin),
        salary_max: Number(jobSalaryMax),
        salary_type: jobSalaryType,
        vacancies: Number(jobVacancies),
        skills_required: skillsArray,
        city: jobCity,
        state: jobState,
        application_deadline: jobDeadline,
        description: jobDescription,
        responsibilities: jobResponsibilities,
        requirements: jobRequirements,
        status: jobStatus,
      };

      if (editingJobId) {
        await apiRequest(`/api/company/jobs/${editingJobId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('success', 'Job posting updated');
      } else {
        await apiRequest('/api/company/jobs', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('success', 'New job posting published');
      }

      resetJobForm();
      await loadDashboard();
      setActiveTab('manage-jobs');
    } catch (err: any) {
      showToast('error', 'Failed to save job posting', err.message);
    } finally {
      setSubmittingJob(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await apiRequest(`/api/company/jobs/${jobId}`, { method: 'DELETE' });
      showToast('info', 'Job posting deleted');
      await loadDashboard();
    } catch (err: any) {
      showToast('error', 'Delete failed', err.message);
    }
  };

  const handleUpdateApplicationStatus = async (
    applicationId: string,
    nextStatus: ApplicationStatus
  ) => {
    try {
      await apiRequest(`/api/company/applications/${applicationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      showToast('success', `Candidate moved to ${nextStatus}`);
      await loadDashboard();
      if (selectedApplicant && selectedApplicant.id === applicationId) {
        setSelectedApplicant({ ...selectedApplicant, status: nextStatus });
      }
    } catch (err: any) {
      showToast('error', 'Status update failed', err.message);
    }
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verDocUrl) {
      showToast('error', 'Upload required', 'Please upload your company registration document.');
      return;
    }
    try {
      await apiRequest('/api/verifications', {
        method: 'POST',
        body: JSON.stringify({
          document_url: verDocUrl,
          verification_type: verType,
          notes: verNotes,
        }),
      });
      setVerDocUrl('');
      setVerNotes('');
      await loadDashboard();
      showToast('success', 'Company verification request sent to Admin');
    } catch (err: any) {
      showToast('error', 'Verification request failed', err.message);
    }
  };

  const shortlistedList = applicants.filter(
    (a) => a.status === 'shortlisted' || a.status === 'accepted'
  );

  const navItems: SidebarNavItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'profile', label: 'Company Profile', icon: Building2 },
    { id: 'post-job', label: editingJobId ? 'Edit Job' : 'Post a Job', icon: PlusCircle },
    { id: 'manage-jobs', label: 'Manage Jobs', icon: Briefcase, count: jobs.length },
    { id: 'applicants', label: 'Applicants', icon: Users, count: applicants.length },
    {
      id: 'shortlisted',
      label: 'Shortlisted Candidates',
      icon: UserCheck,
      count: shortlistedList.length,
    },
    { id: 'notifications', label: 'Notifications', icon: Bell, count: unreadCount },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <DashboardShell
      roleLabel="Employer Portal"
      activeTab={activeTab}
      onSelectTab={(id) => {
        if (id === 'post-job' && activeTab !== 'post-job') {
          resetJobForm();
        }
        setActiveTab(id);
      }}
      navItems={navItems}
      primaryAction={{
        label: '+ Post a Job',
        onClick: () => {
          resetJobForm();
          setActiveTab('post-job');
        },
      }}
    >
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-24 bg-white rounded-xl border border-slate-200 animate-pulse"
              />
            ))}
          </div>
          <div className="h-72 bg-white rounded-xl border border-slate-200 animate-pulse" />
        </div>
      ) : (
        <>
          {/* 1. OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {company?.logo_url ? (
                    <img
                      src={company.logo_url}
                      alt={company.company_name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-lg object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-slate-900 text-white flex items-center justify-center font-display text-lg font-bold">
                      {company?.company_name?.charAt(0) || 'C'}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{company?.industry}</span>
                      <span>·</span>
                      <span>
                        {company?.city}, {company?.state}
                      </span>
                      <span>·</span>
                      <span
                        className={`font-semibold capitalize ${
                          company?.verification_status === 'verified'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {company?.verification_status} Employer
                      </span>
                    </div>
                    <h1 className="font-display text-xl font-bold text-slate-900 mt-1">
                      {company?.company_name}
                    </h1>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    Edit Company Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetJobForm();
                      setActiveTab('post-job');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    Post New Job
                  </button>
                </div>
              </div>

              {/* Real Database Recruitment Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Total Jobs Posted</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
                    {stats.total_jobs}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Active Published Jobs</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-emerald-600 mt-1">
                    {stats.active_jobs}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Total Applicants</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
                    {stats.total_applicants}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Shortlisted Candidates</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-amber-600 mt-1">
                    {stats.shortlisted_candidates}
                  </p>
                </div>
              </div>

              {/* Recent Applications Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Recent Candidate Applications
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('applicants')}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
                  >
                    Manage all applicants →
                  </button>
                </div>

                {applicants.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No applications received yet. Post a job to start receiving worker applications.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50">
                          <th className="py-3 px-6">Candidate</th>
                          <th className="py-3 px-4">Applied Position</th>
                          <th className="py-3 px-4">Experience & Skills</th>
                          <th className="py-3 px-4">Resume</th>
                          <th className="py-3 px-6 text-right">Update Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {applicants.slice(0, 6).map((app) => (
                          <tr key={app.id} className="hover:bg-slate-50">
                            <td className="py-3.5 px-6">
                              <button
                                type="button"
                                onClick={() => setSelectedApplicant(app)}
                                className="font-semibold text-slate-900 hover:underline text-left cursor-pointer"
                              >
                                {app.worker_name}
                              </button>
                              <p className="text-slate-500">
                                {app.worker_city}, {app.worker_state} · {app.worker_phone}
                              </p>
                            </td>
                            <td className="py-3.5 px-4 font-medium text-slate-800">
                              {app.job_title}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              <span className="font-mono tabular-nums font-semibold">
                                {app.worker_experience_years || 0} yrs
                              </span>{' '}
                              · {(app.worker_skills || []).slice(0, 3).join(', ')}
                            </td>
                            <td className="py-3.5 px-4">
                              {app.resume_url ? (
                                <a
                                  href={getAuthorizedFileUrl(app.resume_url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-amber-700 font-medium hover:underline"
                                >
                                  View PDF ↗
                                </a>
                              ) : (
                                <span className="text-slate-400">None</span>
                              )}
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              <select
                                value={app.status}
                                onChange={(e) =>
                                  handleUpdateApplicationStatus(
                                    app.id,
                                    e.target.value as ApplicationStatus
                                  )
                                }
                                className="px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white capitalize cursor-pointer"
                              >
                                <option value="pending">Pending</option>
                                <option value="reviewing">Reviewing</option>
                                <option value="shortlisted">Shortlisted</option>
                                <option value="accepted">Accepted</option>
                                <option value="rejected">Rejected</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. COMPANY PROFILE & VERIFICATION TAB */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Company / Contractor Profile
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Public company details displayed on your published job listings.
                </p>

                <form onSubmit={handleSaveCompanyProfile} className="mt-6 space-y-4">
                  <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={companyName}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-slate-900 text-white flex items-center justify-center font-display text-xl font-bold">
                        {companyName.charAt(0) || 'C'}
                      </div>
                    )}
                    <div>
                      <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploading ? 'Uploading...' : 'Upload Company Logo'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/svg+xml"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Stored in company-logos bucket (max 5MB).
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Company / Factory Name
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Account Representative Name
                      </label>
                      <input
                        type="text"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Industry Sector
                      </label>
                      <input
                        type="text"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Website URL
                      </label>
                      <input
                        type="text"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://yourcompany.in"
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Contact Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        Contact Phone
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Company & Facility Description
                    </label>
                    <textarea
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={savingCompany}
                      className="px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                    >
                      {savingCompany ? 'Saving...' : 'Save Company Profile'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Company Verification Panel */}
              <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-6 space-y-4 h-fit">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Employer Verification
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Current Status:{' '}
                    <span className="font-semibold capitalize text-slate-900">
                      {company?.verification_status}
                    </span>
                  </p>
                </div>

                <form onSubmit={handleSubmitVerification} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Verification Document Type
                    </label>
                    <select
                      value={verType}
                      onChange={(e) => setVerType(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="company_registration">
                        GSTIN / Certificate of Incorporation
                      </option>
                      <option value="factory_license">
                        Factory Act License / Labour Contractor License
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Upload Document (PDF/JPG/PNG)
                    </label>
                    <input
                      type="file"
                      accept=".pdf,image/jpeg,image/png"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const res = await uploadFileToStorage('verification-documents', file);
                          setVerDocUrl(res.url);
                          showToast('success', 'Verification file uploaded');
                        } catch (err: any) {
                          showToast('error', 'Upload failed', err.message);
                        }
                      }}
                      className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Registration Number / Notes
                    </label>
                    <input
                      type="text"
                      value={verNotes}
                      onChange={(e) => setVerNotes(e.target.value)}
                      placeholder="e.g. GSTIN 27AABCA1234F1Z5"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!verDocUrl}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg cursor-pointer"
                  >
                    Submit for Admin Approval
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 3. POST / EDIT A JOB TAB */}
          {activeTab === 'post-job' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 max-w-4xl">
              <div className="pb-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    {editingJobId ? 'Edit Job Posting' : 'Post a New Industrial / Trade Job'}
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Provide accurate shift, skill, and salary details to attract qualified workers.
                  </p>
                </div>
                {editingJobId && (
                  <button
                    type="button"
                    onClick={resetJobForm}
                    className="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer"
                  >
                    Switch to New Job
                  </button>
                )}
              </div>

              <form onSubmit={handleJobSubmit} className="mt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Job Title
                    </label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Senior CNC Turning & VMC Operator"
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Trade Category
                    </label>
                    <select
                      value={jobCategory}
                      onChange={(e) => setJobCategory(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                    >
                      {JOB_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Employment Type
                    </label>
                    <select
                      value={jobType}
                      onChange={(e) => setJobType(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="Full-Time">Full-Time</option>
                      <option value="Contract">Contract</option>
                      <option value="Shift-Based">Shift-Based</option>
                      <option value="Daily Wage">Daily Wage</option>
                      <option value="Apprenticeship">Apprenticeship</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Min Experience (Yrs)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={jobExp}
                      onChange={(e) => setJobExp(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Open Vacancies
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={jobVacancies}
                      onChange={(e) => setJobVacancies(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-300"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Application Deadline
                    </label>
                    <input
                      type="date"
                      value={jobDeadline}
                      onChange={(e) => setJobDeadline(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-300"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Minimum Salary (₹)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={jobSalaryMin}
                      onChange={(e) => setJobSalaryMin(Number(e.target.value))}
                      className="w-full px-3.5 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-300"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Maximum Salary (₹)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={jobSalaryMax}
                      onChange={(e) => setJobSalaryMax(Number(e.target.value))}
                      className="w-full px-3.5 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-300"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Pay Frequency
                    </label>
                    <select
                      value={jobSalaryType}
                      onChange={(e) => setJobSalaryType(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="daily">Daily</option>
                      <option value="hourly">Hourly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Job City
                    </label>
                    <input
                      type="text"
                      value={jobCity}
                      onChange={(e) => setJobCity(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Job State
                    </label>
                    <input
                      type="text"
                      value={jobState}
                      onChange={(e) => setJobState(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Listing Visibility
                    </label>
                    <select
                      value={jobStatus}
                      onChange={(e) => setJobStatus(e.target.value as any)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="published">Publish Immediately</option>
                      <option value="draft">Save as Draft</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Required Trade Skills (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={jobSkills}
                    onChange={(e) => setJobSkills(e.target.value)}
                    placeholder="e.g. CNC Machining, Fanuc Controls, Blueprint Reading, Micrometer Inspection"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Role Description & Benefits (PF/ESIC, Canteen, Transport, Overtime)
                  </label>
                  <textarea
                    rows={3}
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Describe the plant/site location, shift timings, and benefits offered..."
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Key Shop-Floor / Site Responsibilities
                  </label>
                  <textarea
                    rows={3}
                    value={jobResponsibilities}
                    onChange={(e) => setJobResponsibilities(e.target.value)}
                    placeholder="• Operate machines safely&#10;• Inspect dimensions..."
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Candidate Requirements & Certifications
                  </label>
                  <textarea
                    rows={3}
                    value={jobRequirements}
                    onChange={(e) => setJobRequirements(e.target.value)}
                    placeholder="• ITI Diploma or relevant trade experience..."
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300"
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('manage-jobs')}
                    className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingJob}
                    className="px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    {submittingJob
                      ? 'Saving...'
                      : editingJobId
                      ? 'Update Job Posting'
                      : 'Publish Job Posting'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 4. MANAGE JOBS TAB */}
          {activeTab === 'manage-jobs' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Manage Company Job Postings ({jobs.length})
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Edit job details, close filled positions, or delete outdated postings.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetJobForm();
                    setActiveTab('post-job');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer"
                >
                  + Post New Job
                </button>
              </div>

              {jobs.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500">
                  No jobs posted yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50">
                        <th className="py-3 px-6">Title & Category</th>
                        <th className="py-3 px-4">Location & Type</th>
                        <th className="py-3 px-4">Salary Range</th>
                        <th className="py-3 px-4">Applicants</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {jobs.map((job) => (
                        <tr key={job.id} className="hover:bg-slate-50">
                          <td className="py-4 px-6">
                            <p className="font-semibold text-slate-900">{job.title}</p>
                            <p className="text-slate-500">
                              {job.category} · {job.vacancies} vacancies
                            </p>
                          </td>
                          <td className="py-4 px-4 text-slate-600">
                            {job.city}, {job.state} · {job.employment_type}
                          </td>
                          <td className="py-4 px-4 font-mono tabular-nums text-slate-900">
                            ₹{job.salary_min.toLocaleString('en-IN')} – ₹
                            {job.salary_max.toLocaleString('en-IN')}
                          </td>
                          <td className="py-4 px-4 font-mono tabular-nums font-bold text-slate-900">
                            {job.applications_count ?? 0}
                          </td>
                          <td className="py-4 px-4 capitalize font-semibold">
                            <span
                              className={
                                job.status === 'published'
                                  ? 'text-emerald-700'
                                  : job.status === 'closed'
                                  ? 'text-slate-500'
                                  : 'text-amber-700'
                              }
                            >
                              {job.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => startEditJob(job)}
                                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteJob(job.id)}
                                className="px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 5. APPLICANTS TAB & 6. SHORTLISTED CANDIDATES TAB */}
          {(activeTab === 'applicants' || activeTab === 'shortlisted') && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {activeTab === 'shortlisted'
                    ? `Shortlisted & Accepted Candidates (${shortlistedList.length})`
                    : `All Job Applicants (${applicants.length})`}
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Click any worker’s name to inspect their full trade profile, skills, education,
                  and authorized resume PDF.
                </p>
              </div>

              {(activeTab === 'shortlisted' ? shortlistedList : applicants).length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500">
                  No candidates in this view yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50">
                        <th className="py-3 px-6">Worker Name & Contact</th>
                        <th className="py-3 px-4">Job Applied For</th>
                        <th className="py-3 px-4">Skills & Experience</th>
                        <th className="py-3 px-4">Resume PDF</th>
                        <th className="py-3 px-6 text-right">Recruitment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {(activeTab === 'shortlisted' ? shortlistedList : applicants).map((app) => (
                        <tr key={app.id} className="hover:bg-slate-50">
                          <td className="py-4 px-6">
                            <button
                              type="button"
                              onClick={() => setSelectedApplicant(app)}
                              className="font-semibold text-slate-900 hover:underline text-left cursor-pointer"
                            >
                              {app.worker_name}
                              {app.worker_verified ? ' (Verified)' : ''}
                            </button>
                            <p className="text-slate-500">
                              {app.worker_phone} · {app.worker_email}
                            </p>
                          </td>
                          <td className="py-4 px-4">
                            <p className="font-medium text-slate-900">{app.job_title}</p>
                            <p className="text-slate-500">
                              Applied {new Date(app.applied_at).toLocaleDateString('en-IN')}
                            </p>
                          </td>
                          <td className="py-4 px-4 text-slate-600 max-w-xs">
                            <p className="font-mono tabular-nums font-semibold text-slate-800">
                              {app.worker_experience_years || 0} yrs exp · {app.worker_education || 'Trade Worker'}
                            </p>
                            <p className="truncate text-slate-500">
                              {(app.worker_skills || []).join(' · ')}
                            </p>
                          </td>
                          <td className="py-4 px-4">
                            {app.resume_url ? (
                              <a
                                href={getAuthorizedFileUrl(app.resume_url)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-amber-700 hover:underline"
                              >
                                <span>Download Resume</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-slate-400">No file</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedApplicant(app)}
                                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 cursor-pointer"
                              >
                                Inspect
                              </button>
                              <select
                                value={app.status}
                                onChange={(e) =>
                                  handleUpdateApplicationStatus(
                                    app.id,
                                    e.target.value as ApplicationStatus
                                  )
                                }
                                className="px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white capitalize cursor-pointer"
                              >
                                <option value="pending">Pending</option>
                                <option value="reviewing">Reviewing</option>
                                <option value="shortlisted">Shortlisted</option>
                                <option value="accepted">Accepted</option>
                                <option value="rejected">Rejected</option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 7. NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Recruitment & Platform Notifications ({unreadCount} Unread)
                </h2>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllNotificationsRead()}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Mark All Read
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-500">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-5 flex items-start justify-between gap-4 ${
                        n.is_read ? 'bg-white' : 'bg-amber-50/40'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                        <p className="text-xs text-slate-600 mt-1">{n.message}</p>
                        <p className="text-[11px] font-mono tabular-nums text-slate-400 mt-1.5">
                          {new Date(n.created_at).toLocaleString('en-IN')}
                        </p>
                      </div>
                      {!n.is_read && (
                        <button
                          type="button"
                          onClick={() => markNotificationRead(n.id)}
                          className="px-3 py-1 text-xs font-medium text-amber-800 bg-amber-100 rounded-md cursor-pointer"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 8. SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-xl space-y-4">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Employer Account Settings
              </h2>
              <div className="text-xs text-slate-600 space-y-2">
                <p>
                  <span className="font-semibold text-slate-900">Company Name:</span>{' '}
                  {company?.company_name}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Verification Status:</span>{' '}
                  <span className="capitalize">{company?.verification_status}</span>
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Account Email:</span>{' '}
                  {profile?.email}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Candidate Inspection Modal */}
      {selectedApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-xl w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <p className="text-xs font-medium text-amber-700">
                  Applicant for {selectedApplicant.job_title}
                </p>
                <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                  {selectedApplicant.worker_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedApplicant.worker_headline || 'Skilled Trade Applicant'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedApplicant(null)}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Close ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <p className="text-slate-500">Phone</p>
                <p className="font-mono tabular-nums font-semibold text-slate-900">
                  {selectedApplicant.worker_phone}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Email</p>
                <p className="font-semibold text-slate-900">{selectedApplicant.worker_email}</p>
              </div>
              <div>
                <p className="text-slate-500">Location</p>
                <p className="font-semibold text-slate-900">
                  {selectedApplicant.worker_city}, {selectedApplicant.worker_state}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Experience & Education</p>
                <p className="font-semibold text-slate-900">
                  {selectedApplicant.worker_experience_years || 0} yrs ·{' '}
                  {selectedApplicant.worker_education || 'Trade Certified'}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-800 mb-1">Verified Trade Skills</p>
              <p className="text-xs text-slate-600">
                {(selectedApplicant.worker_skills || []).join(' · ') || 'None listed'}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-800 mb-1">Candidate Cover Note</p>
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                {selectedApplicant.cover_letter || 'No cover note attached.'}
              </p>
            </div>

            {selectedApplicant.resume_url && (
              <div>
                <a
                  href={getAuthorizedFileUrl(selectedApplicant.resume_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-lg"
                >
                  <FileText className="w-4 h-4" />
                  <span>Open / Download Worker Resume PDF</span>
                </a>
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Move Candidate Status:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {(['reviewing', 'shortlisted', 'accepted', 'rejected'] as ApplicationStatus[]).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleUpdateApplicationStatus(selectedApplicant.id, st)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize cursor-pointer ${
                        selectedApplicant.status === st
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
