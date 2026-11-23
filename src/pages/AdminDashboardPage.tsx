import React, { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Building2,
  Briefcase,
  FileCheck2,
  BarChart3,
  Settings,
  ExternalLink,
  Download,
} from 'lucide-react';
import { DashboardShell, SidebarNavItem } from '../components/layout/DashboardShell.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest, getAuthorizedFileUrl } from '../services/api.ts';
import {
  Application,
  Company,
  Job,
  Profile,
  VerificationRequest,
} from '../types/database.ts';

export function AdminDashboardPage() {
  const { showToast } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    total_users: 0,
    total_workers: 0,
    total_companies: 0,
    verified_companies: 0,
    total_jobs: 0,
    published_jobs: 0,
    pending_jobs: 0,
    total_applications: 0,
    accepted_applications: 0,
    pending_verifications: 0,
  });

  const [users, setUsers] = useState<Profile[]>([]);
  const [workerProfiles, setWorkerProfiles] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);

  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{
        stats: typeof stats;
        users: Profile[];
        workerProfiles: any[];
        companies: any[];
        jobs: Job[];
        applications: Application[];
        verificationRequests: VerificationRequest[];
      }>('/api/admin/dashboard');

      setStats(data.stats);
      setUsers(data.users || []);
      setWorkerProfiles(data.workerProfiles || []);
      setCompanies(data.companies || []);
      setJobs(data.jobs || []);
      setApplications(data.applications || []);
      setVerificationRequests(data.verificationRequests || []);
    } catch (err: any) {
      showToast('error', 'Failed to load admin console', err.message);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleUserStatusToggle = async (userId: string, nextStatus: 'active' | 'suspended') => {
    try {
      const res = await apiRequest<{ message: string }>(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ account_status: nextStatus }),
      });
      showToast('success', res.message);
      await loadAdminData();
    } catch (err: any) {
      showToast('error', 'Action failed', err.message);
    }
  };

  const handleWorkerVerifyToggle = async (userId: string, isVerified: boolean) => {
    try {
      const res = await apiRequest<{ message: string }>(`/api/admin/users/${userId}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ is_verified: isVerified }),
      });
      showToast('success', res.message);
      await loadAdminData();
    } catch (err: any) {
      showToast('error', 'Verification failed', err.message);
    }
  };

  const handleCompanyVerify = async (
    companyId: string,
    verificationStatus: 'verified' | 'rejected' | 'pending'
  ) => {
    try {
      const res = await apiRequest<{ message: string }>(
        `/api/admin/companies/${companyId}/verify`,
        {
          method: 'PATCH',
          body: JSON.stringify({ verification_status: verificationStatus }),
        }
      );
      showToast('success', res.message);
      await loadAdminData();
    } catch (err: any) {
      showToast('error', 'Company verification failed', err.message);
    }
  };

  const handleReviewVerificationRequest = async (
    reqId: string,
    status: 'approved' | 'rejected'
  ) => {
    try {
      const res = await apiRequest<{ message: string }>(`/api/admin/verifications/${reqId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          admin_notes:
            status === 'approved'
              ? 'Verified by Platform Administrator.'
              : 'Rejected: Document unclear or incomplete.',
        }),
      });
      showToast('success', res.message);
      await loadAdminData();
    } catch (err: any) {
      showToast('error', 'Review failed', err.message);
    }
  };

  const handleJobStatusChange = async (jobId: string, status: string) => {
    try {
      const res = await apiRequest<{ message: string }>(`/api/admin/jobs/${jobId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showToast('success', res.message);
      await loadAdminData();
    } catch (err: any) {
      showToast('error', 'Job moderation failed', err.message);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      const res = await apiRequest<{ message: string }>(`/api/admin/jobs/${jobId}`, {
        method: 'DELETE',
      });
      showToast('info', res.message);
      await loadAdminData();
    } catch (err: any) {
      showToast('error', 'Remove job failed', err.message);
    }
  };

  const exportPlatformReportCsv = () => {
    const headers = ['ID', 'Name', 'Email', 'Role', 'City', 'Verified', 'Status'];
    const rows = users.map((u) => [
      u.id,
      `"${u.full_name}"`,
      u.email,
      u.role,
      `"${u.city || ''}"`,
      u.is_verified ? 'Yes' : 'No',
      u.account_status,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memployment_users_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const workerVerificationQueue = verificationRequests.filter((v) => v.user_role === 'worker');
  const companyVerificationQueue = verificationRequests.filter((v) => v.user_role === 'company');

  const navItems: SidebarNavItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'users', label: 'User Management', icon: Users, count: stats.total_users },
    {
      id: 'worker-verification',
      label: 'Worker Verification',
      icon: ShieldCheck,
      count: workerVerificationQueue.filter((v) => v.status === 'pending').length,
    },
    {
      id: 'company-verification',
      label: 'Company Verification',
      icon: Building2,
      count: companyVerificationQueue.filter((v) => v.status === 'pending').length,
    },
    { id: 'jobs', label: 'Job Management', icon: Briefcase, count: stats.total_jobs },
    {
      id: 'applications',
      label: 'Applications Monitoring',
      icon: FileCheck2,
      count: stats.total_applications,
    },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const filteredUsers = users.filter((u) => {
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    const q = userSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.city || '').toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });

  return (
    <DashboardShell
      roleLabel="Admin Console"
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      navItems={navItems}
      primaryAction={{
        label: 'Export CSV Report',
        onClick: exportPlatformReportCsv,
      }}
    >
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-24 bg-white rounded-xl border border-slate-200 animate-pulse"
              />
            ))}
          </div>
          <div className="h-80 bg-white rounded-xl border border-slate-200 animate-pulse" />
        </div>
      ) : (
        <>
          {/* 1. OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div>
                <h1 className="font-display text-xl font-bold text-slate-900">
                  Memployment Platform Administration
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  Real-time governance across registered workers, employer verifications, job
                  moderation, and placement activity.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Total Users</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
                    {stats.total_users}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Total Workers</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
                    {stats.total_workers}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Total Companies</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
                    {stats.total_companies}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Published Jobs</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-emerald-600 mt-1">
                    {stats.published_jobs}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Total Applications</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
                    {stats.total_applications}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Pending Verifications</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-amber-600 mt-1">
                    {stats.pending_verifications}
                  </p>
                </div>
              </div>

              {/* Pending Verifications Action Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-slate-900">
                    Pending Document Verification Requests
                  </h2>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {stats.pending_verifications} pending
                  </span>
                </div>

                {verificationRequests.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No verification requests in queue.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50">
                          <th className="py-3 px-6">Applicant / Company</th>
                          <th className="py-3 px-4">Role & Type</th>
                          <th className="py-3 px-4">Notes</th>
                          <th className="py-3 px-4">Document</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-6 text-right">Moderation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {verificationRequests.map((vr) => (
                          <tr key={vr.id} className="hover:bg-slate-50">
                            <td className="py-3.5 px-6">
                              <p className="font-semibold text-slate-900">
                                {vr.company_name || vr.user_name}
                              </p>
                              <p className="text-slate-500">{vr.user_email}</p>
                            </td>
                            <td className="py-3.5 px-4 capitalize text-slate-700">
                              {vr.user_role} · {vr.verification_type.replace('_', ' ')}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              {vr.admin_notes || '—'}
                            </td>
                            <td className="py-3.5 px-4">
                              <a
                                href={getAuthorizedFileUrl(vr.document_url)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-amber-700 font-medium hover:underline"
                              >
                                <span>Inspect Document</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </td>
                            <td className="py-3.5 px-4 font-semibold capitalize">
                              <span
                                className={
                                  vr.status === 'approved'
                                    ? 'text-emerald-700'
                                    : vr.status === 'rejected'
                                    ? 'text-red-700'
                                    : 'text-amber-700'
                                }
                              >
                                {vr.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleReviewVerificationRequest(vr.id, 'approved')
                                  }
                                  className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleReviewVerificationRequest(vr.id, 'rejected')
                                  }
                                  className="px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-md cursor-pointer"
                                >
                                  Reject
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
            </div>
          )}

          {/* 2. USER MANAGEMENT TAB */}
          {activeTab === 'users' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Registered Platform Users ({filteredUsers.length})
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Monitor accounts, verify profiles, or suspend accounts violating platform terms.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search name, email, city..."
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-300"
                  />
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="all">All Roles</option>
                    <option value="worker">Workers</option>
                    <option value="company">Companies</option>
                    <option value="admin">Admins</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50">
                      <th className="py-3 px-6">Full Name & Email</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Verification</th>
                      <th className="py-3 px-4">Account Status</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-6">
                          <p className="font-semibold text-slate-900">{u.full_name}</p>
                          <p className="text-slate-500">
                            {u.email} · {u.phone}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 capitalize font-medium text-slate-800">
                          {u.role}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {u.city}, {u.state}
                        </td>
                        <td className="py-3.5 px-4">
                          {u.is_verified ? (
                            <span className="text-emerald-700 font-semibold">Verified</span>
                          ) : (
                            <span className="text-slate-500">Unverified</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-semibold capitalize">
                          <span
                            className={
                              u.account_status === 'active'
                                ? 'text-emerald-700'
                                : 'text-red-700'
                            }
                          >
                            {u.account_status}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          {u.role !== 'admin' && (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleWorkerVerifyToggle(u.id, !u.is_verified)}
                                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                              >
                                {u.is_verified ? 'Unverify' : 'Verify'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUserStatusToggle(
                                    u.id,
                                    u.account_status === 'active' ? 'suspended' : 'active'
                                  )
                                }
                                className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                                  u.account_status === 'active'
                                    ? 'text-red-700 bg-red-50 hover:bg-red-100'
                                    : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                }`}
                              >
                                {u.account_status === 'active' ? 'Suspend' : 'Activate'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. WORKER VERIFICATION TAB */}
          {activeTab === 'worker-verification' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Worker Profiles & Trade Credentials Verification
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Review worker skills, resumes, and verify trade certifications.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50">
                      <th className="py-3 px-6">Worker</th>
                      <th className="py-3 px-4">Headline & Trade Skills</th>
                      <th className="py-3 px-4">Experience</th>
                      <th className="py-3 px-4">Resume</th>
                      <th className="py-3 px-4">Verified</th>
                      <th className="py-3 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {workerProfiles.map((wp) => (
                      <tr key={wp.id} className="hover:bg-slate-50">
                        <td className="py-4 px-6">
                          <p className="font-semibold text-slate-900">{wp.full_name}</p>
                          <p className="text-slate-500">
                            {wp.email} · {wp.city}, {wp.state}
                          </p>
                        </td>
                        <td className="py-4 px-4 max-w-xs">
                          <p className="font-medium text-slate-800 truncate">
                            {wp.headline || 'Trade Worker'}
                          </p>
                          <p className="text-slate-500 truncate">
                            {(wp.skills || []).join(' · ')}
                          </p>
                        </td>
                        <td className="py-4 px-4 font-mono tabular-nums text-slate-800">
                          {wp.experience_years} yrs
                        </td>
                        <td className="py-4 px-4">
                          {wp.resume_url ? (
                            <a
                              href={getAuthorizedFileUrl(wp.resume_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-amber-700 font-medium hover:underline"
                            >
                              Inspect PDF ↗
                            </a>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-semibold">
                          {wp.is_verified ? (
                            <span className="text-emerald-700">Verified</span>
                          ) : (
                            <span className="text-amber-700">Pending</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              handleWorkerVerifyToggle(wp.user_id, !wp.is_verified)
                            }
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                              wp.is_verified
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                : 'bg-slate-900 text-white hover:bg-slate-800'
                            }`}
                          >
                            {wp.is_verified ? 'Revoke Verification' : 'Approve & Verify Worker'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. COMPANY VERIFICATION TAB */}
          {activeTab === 'company-verification' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Employer & Contractor Verification Queue ({companies.length})
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Verify company registrations before granting Verified Employer status.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50">
                      <th className="py-3 px-6">Company Name</th>
                      <th className="py-3 px-4">Representative & Contact</th>
                      <th className="py-3 px-4">Industry & Location</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-6 text-right">Verification Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {companies.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-4 px-6">
                          <p className="font-semibold text-slate-900">{c.company_name}</p>
                          <p className="text-slate-500">{c.website || c.email}</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-medium text-slate-800">{c.owner_name}</p>
                          <p className="text-slate-500">{c.phone}</p>
                        </td>
                        <td className="py-4 px-4 text-slate-600">
                          {c.industry} · {c.city}, {c.state}
                        </td>
                        <td className="py-4 px-4 font-semibold capitalize">
                          <span
                            className={
                              c.verification_status === 'verified'
                                ? 'text-emerald-700'
                                : c.verification_status === 'rejected'
                                ? 'text-red-700'
                                : 'text-amber-700'
                            }
                          >
                            {c.verification_status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCompanyVerify(c.id, 'verified')}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer"
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCompanyVerify(c.id, 'rejected')}
                              className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-md cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. JOB MANAGEMENT & MODERATION TAB */}
          {activeTab === 'jobs' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  All Platform Job Postings ({jobs.length})
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Approve pending jobs, suspend or reject inappropriate postings, or remove spam.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50">
                      <th className="py-3 px-6">Job Title & Company</th>
                      <th className="py-3 px-4">Category & Location</th>
                      <th className="py-3 px-4">Salary</th>
                      <th className="py-3 px-4">Applicants</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-6 text-right">Moderation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {jobs.map((j) => (
                      <tr key={j.id} className="hover:bg-slate-50">
                        <td className="py-4 px-6">
                          <p className="font-semibold text-slate-900">{j.title}</p>
                          <p className="text-slate-500">{j.company_name}</p>
                        </td>
                        <td className="py-4 px-4 text-slate-600">
                          {j.category} · {j.city}, {j.state}
                        </td>
                        <td className="py-4 px-4 font-mono tabular-nums text-slate-900">
                          ₹{j.salary_min.toLocaleString('en-IN')} – ₹
                          {j.salary_max.toLocaleString('en-IN')}
                        </td>
                        <td className="py-4 px-4 font-mono tabular-nums font-bold text-slate-900">
                          {j.applications_count ?? 0}
                        </td>
                        <td className="py-4 px-4 font-semibold capitalize">
                          <span
                            className={
                              j.status === 'published'
                                ? 'text-emerald-700'
                                : j.status === 'rejected'
                                ? 'text-red-700'
                                : 'text-amber-700'
                            }
                          >
                            {j.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="inline-flex items-center gap-2">
                            <select
                              value={j.status}
                              onChange={(e) => handleJobStatusChange(j.id, e.target.value)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-300 bg-white capitalize cursor-pointer"
                            >
                              <option value="published">Published (Approved)</option>
                              <option value="pending">Pending Review</option>
                              <option value="closed">Closed / Suspended</option>
                              <option value="rejected">Rejected</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleDeleteJob(j.id)}
                              className="px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-md cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. APPLICATIONS MONITORING TAB */}
          {activeTab === 'applications' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Platform Applications Monitoring ({applications.length})
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Audit live recruitment activity across all workers and companies.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-slate-50">
                      <th className="py-3 px-6">Worker</th>
                      <th className="py-3 px-4">Job Title</th>
                      <th className="py-3 px-4">Company</th>
                      <th className="py-3 px-4">Submitted Date</th>
                      <th className="py-3 px-6 text-right">Current Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {applications.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-6">
                          <p className="font-semibold text-slate-900">{a.worker_name}</p>
                          <p className="text-slate-500">{a.worker_email}</p>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-800">{a.job_title}</td>
                        <td className="py-3.5 px-4 text-slate-600">{a.company_name}</td>
                        <td className="py-3.5 px-4 font-mono tabular-nums text-slate-500">
                          {new Date(a.applied_at).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-3.5 px-6 text-right font-semibold capitalize">
                          {a.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 7. REPORTS TAB */}
          {activeTab === 'reports' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Platform Analytics & Workforce Reports
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Real-time breakdown of marketplace supply, demand, and verification metrics.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={exportPlatformReportCsv}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Users CSV</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-700">Employer Verification Rate</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
                    {stats.total_companies > 0
                      ? Math.round((stats.verified_companies / stats.total_companies) * 100)
                      : 0}
                    %
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {stats.verified_companies} of {stats.total_companies} companies verified
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-700">Job Publication Rate</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
                    {stats.total_jobs > 0
                      ? Math.round((stats.published_jobs / stats.total_jobs) * 100)
                      : 0}
                    %
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {stats.published_jobs} published / {stats.pending_jobs} pending moderation
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-700">Placement Conversion</p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-emerald-700 mt-1">
                    {stats.total_applications > 0
                      ? Math.round((stats.accepted_applications / stats.total_applications) * 100)
                      : 0}
                    %
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {stats.accepted_applications} accepted offers from {stats.total_applications}{' '}
                    applications
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 8. SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-2xl space-y-4">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Platform Security & Governance Configuration
              </h2>
              <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                <p>
                  • <span className="font-semibold text-slate-900">Public Admin Signup Block:</span>{' '}
                  Enforced on server (`/api/auth/signup`) and PostgreSQL RLS triggers
                  (`trg_prevent_public_admin_insert`).
                </p>
                <p>
                  • <span className="font-semibold text-slate-900">Private Document Isolation:</span>{' '}
                  `resumes` and `verification-documents` buckets require valid session tokens and
                  strict relationship verification.
                </p>
                <p>
                  • <span className="font-semibold text-slate-900">Duplicate Application Guard:</span>{' '}
                  Enforced via database unique constraint `UNIQUE(job_id, worker_id)`.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
