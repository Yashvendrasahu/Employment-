import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2 } from 'lucide-react';
import { Job } from '../../types/database.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  apiRequest,
  uploadFileToStorage,
  getAuthorizedFileUrl,
} from '../../services/api.ts';

interface JobApplyModalProps {
  job: Job;
  onClose: () => void;
  onSuccess: () => void;
}

export function JobApplyModal({ job, onClose, onSuccess }: JobApplyModalProps) {
  const { workerProfile, showToast, refreshSession } = useAuth();
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeUrl, setResumeUrl] = useState<string>(workerProfile?.resume_url || '');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    setUploadProgress(0);
    try {
      const uploaded = await uploadFileToStorage('resumes', file, (pct) =>
        setUploadProgress(pct)
      );
      setResumeUrl(uploaded.url);
      showToast('success', 'Resume uploaded', file.name);
    } catch (err: any) {
      setError(err.message || 'Resume upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!resumeUrl) {
      setError('Please upload your resume (PDF/DOC) before submitting your application.');
      return;
    }
    if (coverLetter.trim().length < 15) {
      setError(
        'Please write a brief note (at least 15 characters) describing your trade experience and availability.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest('/api/worker/applications', {
        method: 'POST',
        body: JSON.stringify({
          job_id: job.id,
          cover_letter: coverLetter.trim(),
          resume_url: resumeUrl,
        }),
      });
      await refreshSession();
      showToast(
        'success',
        'Application Submitted',
        `Your application for ${job.title} has been sent to ${job.company_name}.`
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Could not submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-medium text-amber-700">{job.company_name}</p>
            <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5">
              Apply for {job.title}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {job.city}, {job.state} · ₹{job.salary_min.toLocaleString('en-IN')} – ₹
              {job.salary_max.toLocaleString('en-IN')} / {job.salary_type}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Trade Resume / CV Document (Required)
            </label>
            {resumeUrl ? (
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">
                      Attached Resume Ready
                    </p>
                    <a
                      href={getAuthorizedFileUrl(resumeUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-amber-700 hover:underline"
                    >
                      Preview attached document ↗
                    </a>
                  </div>
                </div>
                <label className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0">
                  Replace File
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf"
                    onChange={handleResumeUpload}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 rounded-lg hover:border-slate-400 cursor-pointer bg-slate-50/50">
                <Upload className="w-5 h-5 text-slate-500 mb-1.5" />
                <span className="text-xs font-medium text-slate-700">
                  Click to upload Resume (PDF or DOC, max 10MB)
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf"
                  onChange={handleResumeUpload}
                  className="hidden"
                />
              </label>
            )}

            {uploading && (
              <div className="mt-2">
                <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                  <span>Uploading resume to secure storage...</span>
                  <span className="font-mono tabular-nums">{uploadProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-600 transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Experience Summary & Cover Note (Required)
            </label>
            <textarea
              rows={4}
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              placeholder="Describe your relevant machines/tools handled, years of trade experience, licenses held, and notice period..."
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {submitting ? 'Submitting Application...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
