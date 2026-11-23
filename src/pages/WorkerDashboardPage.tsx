import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UserCheck,
  Search,
  Briefcase,
  Bookmark,
  FileText,
  Bell,
  Settings,
  Upload,
  CheckCircle2,
  ExternalLink,
  Trash2,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { DashboardShell, SidebarNavItem } from '../components/layout/DashboardShell.tsx';
import { JobApplyModal } from '../components/jobs/JobApplyModal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  apiRequest,
  uploadFileToStorage,
  getAuthorizedFileUrl,
} from '../services/api.ts';
import {
  Application,
  Job,
  SavedJob,
  VerificationRequest,
  WorkerProfile,
  Profile,
} from '../types/database.ts';

export function WorkerDashboardPage() {
  const navigate = useNavigate();
  const {
    user,
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
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  const [stats, setStats] = useState({
    profile_completion: 25,
    total_applications: 0,
    pending_applications: 0,
    shortlisted_applications: 0,
    accepted_applications: 0,
    rejected_applications: 0,
    saved_jobs_count: 0,
  });
  const [applications, setApplications] = useState<Application[]>([]);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<Job[]>([]);
  const [applyModalJob, setApplyModalJob] = useState<Job | null>(null);

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [experienceYears, setExperienceYears] = useState(0);
  const [education, setEducation] = useState('');
  const [employmentType, setEmploymentType] = useState('Full-Time');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [preferredLocation, setPreferredLocation] = useState('');
  const [availabilityStatus, setAvailabilityStatus] = useState('available');
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Upload states
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Verification submission state
  const [verType, setVerType] = useState<'worker_identity' | 'trade_certificate'>(
    'trade_certificate'
  );
  const [verDocUrl, setVerDocUrl] = useState('');
  const [verNotes, setVerNotes] = useState('');
  const [submittingVer, setSubmittingVer] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{
        profile: Profile;
        workerProfile: WorkerProfile;
        stats: typeof stats;
        applications: Application[];
        savedJobs: SavedJob[];
        verifications: VerificationRequest[];
        recommendedJobs: Job[];
      }>('/api/worker/dashboard');

      setProfile(data.profile);
      setWorkerProfile(data.workerProfile);
      setStats(data.stats);
      setApplications(data.applications || []);
      setSavedJobs(data.savedJobs || []);
      setVerifications(data.verifications || []);
      setRecommendedJobs(data.recommendedJobs || []);

      // Populate form fields
      if (data.profile) {
        setFullName(data.profile.full_name || '');
        setPhone(data.profile.phone || '');
        setCity(data.profile.city || '');
        setState(data.profile.state || '');
        setPreferredLanguage(data.profile.preferred_language || 'English');
        setAvatarUrl(data.profile.avatar_url || null);
      }
      if (data.workerProfile) {
        setHeadline(data.workerProfile.headline || '');
        setBio(data.workerProfile.bio || '');
        setSkillsText((data.workerProfile.skills || []).join(', '));
        setExperienceYears(data.workerProfile.experience_years || 0);
        setEducation(data.workerProfile.education || '');
        setEmploymentType(data.workerProfile.employment_type || 'Full-Time');
        setExpectedSalary(
          data.workerProfile.expected_salary ? String(data.workerProfile.expected_salary) : ''
        );
        setPreferredLocation(data.workerProfile.preferred_location || '');
        setAvailabilityStatus(data.workerProfile.availability_status || 'available');
        setResumeUrl(data.workerProfile.resume_url || null);
      }
    } catch (err: any) {
      showToast('error', 'Failed to load worker dashboard', err.message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const skillsArray = skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await apiRequest('/api/worker/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: fullName,
          phone,
          city,
          state,
          preferred_language: preferredLanguage,
          avatar_url: avatarUrl,
          headline,
          bio,
          skills: skillsArray,
          experience_years: Number(experienceYears),
          education,
          employment_type: employmentType,
          expected_salary: expectedSalary ? Number(expectedSalary) : null,
          preferred_location: preferredLocation,
          availability_status: availabilityStatus,
          resume_url: resumeUrl,
        }),
      });
      await refreshSession();
      await loadDashboard();
      showToast('success', 'Worker profile saved');
    } catch (err: any) {
      showToast('error', 'Profile update failed', err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    setUploadProgress(0);
    try {
      const res = await uploadFileToStorage('avatars', file, setUploadProgress);
      setAvatarUrl(res.url);
      showToast('success', 'Profile photo uploaded');
    } catch (err: any) {
      showToast('error', 'Photo upload failed', err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    setUploadProgress(0);
    try {
      const res = await uploadFileToStorage('resumes', file, setUploadProgress);
      setResumeUrl(res.url);
      // Persist immediately to profile
      await apiRequest('/api/worker/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: fullName || user?.full_name,
          resume_url: res.url,
        }),
      });
      await loadDashboard();
      showToast('success', 'Resume uploaded and linked to your profile');
    } catch (err: any) {
      showToast('error', 'Resume upload failed', err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleVerificationDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    setUploadProgress(0);
    try {
      const res = await uploadFileToStorage('verification-documents', file, setUploadProgress);
      setVerDocUrl(res.url);
      showToast('success', 'Verification document uploaded');
    } catch (err: any) {
      showToast('error', 'Document upload failed', err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verDocUrl) {
      showToast('error', 'Missing document', 'Please upload your trade certificate or ID first.');
      return;
    }
    setSubmittingVer(true);
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
      showToast('success', 'Verification submitted for admin review');
    } catch (err: any) {
      showToast('error', 'Submission failed', err.message);
    } finally {
      setSubmittingVer(false);
    }
  };

  const handleRemoveSavedJob = async (jobId: string) => {
    try {
      await apiRequest('/api/worker/saved-jobs', {
        method: 'POST',
        body: JSON.stringify({ job_id: jobId }),
      });
      await loadDashboard();
      showToast('info', 'Removed job from saved list');
    } catch (err: any) {
      showToast('error', 'Could not remove saved job', err.message);
    }
  };

  const navItems: SidebarNavItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'profile', label: 'My Profile', icon: UserCheck },
    { id: 'find-jobs', label: 'Find Jobs', icon: Search, count: recommendedJobs.length },
    { id: 'applications', label: 'My Applications', icon: Briefcase, count: applications.length },
    { id: 'saved-jobs', label: 'Saved Jobs', icon: Bookmark, count: savedJobs.length },
    { id: 'resume', label: 'Resume Management', icon: FileText },
    { id: 'notifications', label: 'Notifications', icon: Bell, count: unreadCount },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const appliedJobIds = applications.map((a) => a.job_id);

  return (
    <DashboardShell
      roleLabel="Worker Portal"
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      navItems={navItems}
      primaryAction={{
        label: 'Browse All Jobs',
        onClick: () => navigate('/jobs'),
      }}
    >
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((n) => (
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{profile?.city || 'India'}</span>
                    <span>·</span>
                    <span className="capitalize">
                      Availability: {workerProfile?.availability_status?.replace('_', ' ')}
                    </span>
                    <span>·</span>
                    {profile?.is_verified ? (
                      <span className="text-emerald-700 font-semibold">Verified Trade Worker</span>
                    ) : (
                      <span className="text-amber-700 font-medium">Verification Pending</span>
                    )}
                  </div>
                  <h1 className="font-display text-xl font-bold text-slate-900 mt-1">
                    {profile?.full_name}
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {workerProfile?.headline || 'Add your trade headline and skills to get matched with employers.'}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    Edit Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('resume')}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    Manage Resume
                  </button>
                </div>
              </div>

              {/* Real Database Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Profile Completion</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
                    {stats.profile_completion}%
                  </p>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-amber-600"
                      style={{ width: `${stats.profile_completion}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Total Applications</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
                    {stats.total_applications}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Submitted by you</p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Pending / In Review</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-amber-600 mt-1">
                    {stats.pending_applications}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Awaiting employer action</p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Shortlisted</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
                    {stats.shortlisted_applications}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Trade test / interview stage</p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Accepted Offers</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-emerald-600 mt-1">
                    {stats.accepted_applications}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Confirmed placements</p>
                </div>
              </div>

              {/* Recent Application Activity */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Recent Application Activity
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('applications')}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
                  >
                    View all →
                  </button>
                </div>

                {applications.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-xs text-slate-500">
                      You have not applied to any jobs yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('find-jobs')}
                      className="mt-3 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer"
                    >
                      Explore Recommended Jobs
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50">
                          <th className="py-3 px-6">Position & Employer</th>
                          <th className="py-3 px-4">Location & Shift</th>
                          <th className="py-3 px-4">Salary Range</th>
                          <th className="py-3 px-4">Applied Date</th>
                          <th className="py-3 px-6 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {applications.slice(0, 5).map((app) => (
                          <tr key={app.id} className="hover:bg-slate-50/80">
                            <td className="py-3.5 px-6">
                              <p className="font-semibold text-slate-900">{app.job_title}</p>
                              <p className="text-slate-500">{app.company_name}</p>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              {app.job_city}, {app.job_state} · {app.job_employment_type}
                            </td>
                            <td className="py-3.5 px-4 font-mono tabular-nums text-slate-800">
                              ₹{Number(app.job_salary_min || 0).toLocaleString('en-IN')} – ₹
                              {Number(app.job_salary_max || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="py-3.5 px-4 font-mono tabular-nums text-slate-500">
                              {new Date(app.applied_at).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-3.5 px-6 text-right font-semibold capitalize">
                              <span
                                className={
                                  app.status === 'accepted'
                                    ? 'text-emerald-700'
                                    : app.status === 'shortlisted'
                                    ? 'text-amber-700'
                                    : app.status === 'rejected'
                                    ? 'text-red-700'
                                    : 'text-slate-700'
                                }
                              >
                                {app.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Rule-Based Skill & Location Matched Jobs */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-900">
                      Recommended Jobs Matching Your Trade Skills & Location
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ranked using your listed skills ({(workerProfile?.skills || []).length} skills)
                      and preferred location ({workerProfile?.preferred_location || profile?.city}).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/jobs?sort=match')}
                    className="text-xs font-semibold text-slate-900 hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Open Full Job Search →
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recommendedJobs.slice(0, 4).map((job) => (
                    <div
                      key={job.id}
                      className="p-4 rounded-xl border border-slate-200 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">{job.company_name}</span>
                          <span className="font-mono tabular-nums font-semibold text-amber-700">
                            {job.match_score || 0}% Skill Match
                          </span>
                        </div>
                        <h3 className="font-display text-sm font-bold text-slate-900 mt-1">
                          {job.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {job.city}, {job.state} · {job.employment_type} ·{' '}
                          <span className="font-mono tabular-nums">
                            ₹{job.salary_min.toLocaleString('en-IN')} – ₹
                            {job.salary_max.toLocaleString('en-IN')}
                          </span>
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          {job.matched_skills && job.matched_skills.length > 0
                            ? `Matches: ${job.matched_skills.slice(0, 3).join(', ')}`
                            : `${job.vacancies} vacancies`}
                        </span>
                        {appliedJobIds.includes(job.id) ? (
                          <span className="text-xs font-semibold text-emerald-700">Applied ✓</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setApplyModalJob(job)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                          >
                            Apply Now
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. MY PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8">
              <div className="pb-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Worker Trade Profile & Skills
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Keep your trade skills, experience, and location accurate so companies can shortlist you.
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono tabular-nums text-xs font-bold text-slate-900">
                    Completion: {stats.profile_completion}%
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="mt-6 space-y-5">
                {/* Profile Photo Upload */}
                <div className="flex items-center gap-5 pb-5 border-b border-slate-100">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={fullName}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center font-display text-lg font-bold">
                      {fullName ? fullName.charAt(0).toUpperCase() : 'W'}
                    </div>
                  )}
                  <div>
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Profile Photo</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-slate-500 mt-1">
                      JPG, PNG or WebP (max 5MB). Stored in avatars bucket.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Professional Trade Headline
                  </label>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g. Senior CNC Turning & VMC Operator | ITI Machinist"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Trade Skills & Machines Handled (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={skillsText}
                    onChange={(e) => setSkillsText(e.target.value)}
                    placeholder="e.g. CNC Machining, Fanuc Controls, Blueprint Reading, MIG Welding"
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Experience (Years)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(Number(e.target.value))}
                      className="w-full px-3.5 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Preferred Employment Type
                    </label>
                    <select
                      value={employmentType}
                      onChange={(e) => setEmploymentType(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:border-slate-900 focus:outline-none"
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
                      Expected Monthly Salary (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={expectedSalary}
                      onChange={(e) => setExpectedSalary(e.target.value)}
                      placeholder="e.g. 35000"
                      className="w-full px-3.5 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Education / ITI Trade Diploma
                    </label>
                    <input
                      type="text"
                      value={education}
                      onChange={(e) => setEducation(e.target.value)}
                      placeholder="e.g. ITI Machinist (NCVT)"
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Current City
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Current State
                    </label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Preferred Work Locations
                    </label>
                    <input
                      type="text"
                      value={preferredLocation}
                      onChange={(e) => setPreferredLocation(e.target.value)}
                      placeholder="e.g. Pune, Mumbai, Chakan"
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Current Availability Status
                    </label>
                    <select
                      value={availabilityStatus}
                      onChange={(e) => setAvailabilityStatus(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:border-slate-900 focus:outline-none"
                    >
                      <option value="available">Immediately Available</option>
                      <option value="notice_period">On Notice Period (15-30 Days)</option>
                      <option value="employed">Currently Employed (Open to Offers)</option>
                      <option value="unavailable">Not Looking Right Now</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Preferred Language
                    </label>
                    <input
                      type="text"
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Work Experience & Shop-Floor Bio
                  </label>
                  <textarea
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Describe the factories, projects, machines, and safety protocols you have worked with..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg cursor-pointer"
                  >
                    {savingProfile ? 'Saving Changes...' : 'Save Worker Profile'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 3. FIND JOBS TAB */}
          {activeTab === 'find-jobs' && (
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Skill-Matched Job Recommendations
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Matched against your skills ({skillsText || 'No skills added yet'}) and preferred
                    city ({preferredLocation || city}).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/jobs')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  Open Full Search & Filters
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold text-slate-800">{job.company_name}</span>
                        <span className="font-mono tabular-nums font-bold text-amber-700">
                          {job.match_score || 0}% Match
                        </span>
                      </div>
                      <h3 className="font-display text-base font-bold text-slate-900 mt-1">
                        {job.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {job.city}, {job.state} · {job.category} · {job.employment_type}
                      </p>
                      <p className="text-xs text-slate-600 mt-2.5 line-clamp-2">
                        {job.description}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="font-mono tabular-nums text-xs font-bold text-slate-900">
                        ₹{job.salary_min.toLocaleString('en-IN')} – ₹
                        {job.salary_max.toLocaleString('en-IN')} / {job.salary_type}
                      </span>
                      {appliedJobIds.includes(job.id) ? (
                        <span className="text-xs font-semibold text-emerald-700">Applied ✓</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setApplyModalJob(job)}
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                        >
                          Apply Now
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. MY APPLICATIONS TAB */}
          {activeTab === 'applications' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  My Job Applications & Status Progression
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Track every application through Pending → Reviewing → Shortlisted → Accepted / Rejected.
                </p>
              </div>

              {applications.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm text-slate-600">No job applications submitted yet.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/jobs')}
                    className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer"
                  >
                    Browse Jobs to Apply
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {applications.map((app) => {
                    const steps = ['pending', 'reviewing', 'shortlisted', 'accepted'];
                    const currentIdx = steps.indexOf(app.status);
                    return (
                      <div key={app.id} className="p-6 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-medium text-slate-500">
                              {app.company_name} · {app.job_city}, {app.job_state}
                            </p>
                            <h3 className="font-display text-base font-bold text-slate-900">
                              {app.job_title}
                            </h3>
                          </div>
                          <div className="text-left sm:text-right">
                            <span
                              className={`text-xs font-bold uppercase tracking-wide ${
                                app.status === 'accepted'
                                  ? 'text-emerald-700'
                                  : app.status === 'shortlisted'
                                  ? 'text-amber-700'
                                  : app.status === 'rejected'
                                  ? 'text-red-700'
                                  : 'text-slate-700'
                              }`}
                            >
                              Status: {app.status}
                            </span>
                            <p className="text-[11px] font-mono tabular-nums text-slate-400">
                              Applied {new Date(app.applied_at).toLocaleDateString('en-IN')}
                            </p>
                          </div>
                        </div>

                        {/* Visual Step Progression Bar */}
                        {app.status !== 'rejected' ? (
                          <div className="grid grid-cols-4 gap-2 pt-2">
                            {steps.map((step, idx) => {
                              const reached = idx <= currentIdx;
                              return (
                                <div key={step} className="space-y-1">
                                  <div
                                    className={`h-1.5 rounded-full ${
                                      reached ? 'bg-slate-900' : 'bg-slate-200'
                                    }`}
                                  />
                                  <p
                                    className={`text-[11px] capitalize ${
                                      reached ? 'font-semibold text-slate-900' : 'text-slate-400'
                                    }`}
                                  >
                                    {step}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-red-700">
                            Employer closed or did not select this application.
                          </p>
                        )}

                        {app.cover_letter && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <span className="font-semibold text-slate-800">Cover Note: </span>
                            {app.cover_letter}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 5. SAVED JOBS TAB */}
          {activeTab === 'saved-jobs' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Saved Jobs ({savedJobs.length})
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Bookmarked openings you can apply to before their application deadline.
                </p>
              </div>

              {savedJobs.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm text-slate-600">You have no saved jobs yet.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/jobs')}
                    className="mt-3 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer"
                  >
                    Browse Jobs
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {savedJobs.map((item) => {
                    const job = item.job;
                    if (!job) return null;
                    return (
                      <div
                        key={item.id}
                        className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-xs text-slate-500">
                            {job.company_name} · {job.city}, {job.state}
                          </p>
                          <h3 className="font-display text-base font-bold text-slate-900 mt-0.5">
                            {job.title}
                          </h3>
                          <p className="text-xs font-mono tabular-nums text-slate-600 mt-1">
                            ₹{job.salary_min.toLocaleString('en-IN')} – ₹
                            {job.salary_max.toLocaleString('en-IN')} / {job.salary_type} · Deadline:{' '}
                            {job.application_deadline}
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRemoveSavedJob(job.id)}
                            className="px-3 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                          >
                            Remove
                          </button>
                          {appliedJobIds.includes(job.id) ? (
                            <span className="px-3.5 py-2 text-xs font-semibold text-emerald-700">
                              Applied ✓
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setApplyModalJob(job)}
                              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                            >
                              Apply Now
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 6. RESUME & VERIFICATION MANAGEMENT TAB */}
          {activeTab === 'resume' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Resume Upload Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Private Trade Resume Storage
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Your resume is stored in a private bucket and is only accessible to you,
                    administrators, and companies you explicitly apply to.
                  </p>
                </div>

                {resumeUrl ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          Active Worker Resume On File
                        </p>
                        <a
                          href={getAuthorizedFileUrl(resumeUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-amber-700 hover:underline mt-0.5"
                        >
                          <span>Open / Download Authorized PDF</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    No resume uploaded yet. Upload a PDF/DOC resume to reach 100% profile completion.
                  </div>
                )}

                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl hover:border-slate-500 cursor-pointer bg-slate-50/50">
                  <Upload className="w-6 h-6 text-slate-500 mb-2" />
                  <span className="text-xs font-semibold text-slate-800">
                    Upload New Resume (PDF, DOC, DOCX — Max 10MB)
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf"
                    onChange={handleResumeUpload}
                    className="hidden"
                  />
                </label>

                {uploadingFile && (
                  <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Uploading...</span>
                      <span className="font-mono tabular-nums">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-900 transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Trade Certificate / Identity Verification Request */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Worker Trade & Identity Verification
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Submit your ITI Trade Certificate, Forklift/Wireman License, or Govt. ID for
                    platform verification.
                  </p>
                </div>

                <form onSubmit={handleSubmitVerification} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Document Type
                    </label>
                    <select
                      value={verType}
                      onChange={(e) => setVerType(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="trade_certificate">
                        ITI Diploma / Trade License (Wireman, Forklift, Welder)
                      </option>
                      <option value="worker_identity">Government Identity Document</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Upload Verification File (PDF/JPG/PNG)
                    </label>
                    <input
                      type="file"
                      accept=".pdf,image/jpeg,image/png"
                      onChange={handleVerificationDocUpload}
                      className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Certificate / License Number & Notes
                    </label>
                    <input
                      type="text"
                      value={verNotes}
                      onChange={(e) => setVerNotes(e.target.value)}
                      placeholder="e.g. NCVT Certificate #MH-2021-88412"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingVer || !verDocUrl}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg cursor-pointer"
                  >
                    {submittingVer ? 'Submitting...' : 'Submit for Admin Verification'}
                  </button>
                </form>

                {verifications.length > 0 && (
                  <div className="pt-4 border-t border-slate-200 space-y-2">
                    <p className="text-xs font-semibold text-slate-800">Submitted Requests</p>
                    {verifications.map((v) => (
                      <div
                        key={v.id}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-medium text-slate-900 capitalize">
                            {v.verification_type.replace('_', ' ')}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {v.admin_notes || 'Submitted for review'}
                          </p>
                        </div>
                        <span
                          className={`font-semibold capitalize ${
                            v.status === 'approved'
                              ? 'text-emerald-700'
                              : v.status === 'rejected'
                              ? 'text-red-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 7. NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Notifications ({unreadCount} Unread)
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Real-time alerts when companies review, shortlist, or accept your applications.
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllNotificationsRead()}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    Mark All as Read
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-500">
                    No notifications found.
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
                          className="px-3 py-1 text-xs font-medium text-amber-800 bg-amber-100 rounded-md cursor-pointer shrink-0"
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
            <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-2xl space-y-6">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Worker Account & Availability Settings
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Control how employers see your availability and manage your account security.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-slate-800">
                  Quick Availability Switch
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      ['available', 'Available Now'],
                      ['notice_period', 'Notice Period'],
                      ['employed', 'Employed'],
                      ['unavailable', 'Unavailable'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={async () => {
                        setAvailabilityStatus(val);
                        await apiRequest('/api/worker/profile', {
                          method: 'PUT',
                          body: JSON.stringify({
                            full_name: fullName,
                            availability_status: val,
                          }),
                        });
                        await loadDashboard();
                        showToast('success', `Availability updated to ${label}`);
                      }}
                      className={`py-2.5 px-3 text-xs font-semibold rounded-lg border cursor-pointer ${
                        availabilityStatus === val
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 text-xs text-slate-600 space-y-1">
                <p>
                  <span className="font-semibold text-slate-900">Account Role:</span> Worker
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Registered Email:</span>{' '}
                  {profile?.email}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Account Status:</span>{' '}
                  <span className="capitalize">{profile?.account_status}</span>
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {applyModalJob && (
        <JobApplyModal
          job={applyModalJob}
          onClose={() => setApplyModalJob(null)}
          onSuccess={() => {
            setApplyModalJob(null);
            loadDashboard();
          }}
        />
      )}
    </DashboardShell>
  );
}
