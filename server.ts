import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  sqliteDb,
  initializeDatabaseSchema,
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  calculateWorkerProfileCompletion,
  TokenPayload,
} from './src/server/database.ts';
import {
  validateWorkerSignup,
  validateCompanySignup,
  validateEmail,
  validatePassword,
  validateJobPayload,
  validateFileUpload,
  StorageBucketName,
} from './src/lib/validations/index.ts';
import { computeJobMatch } from './src/lib/matching/jobMatcher.ts';
import { isSupabaseServerConfigured } from './src/lib/supabase/server.ts';
import { Job, WorkerProfile } from './src/types/database.ts';

dotenv.config();
initializeDatabaseSchema();

const app = express();
app.use(express.json({ limit: '15mb' }));

interface AuthenticatedRequest extends Request {
  auth?: TokenPayload;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (typeof req.query.token === 'string' && req.query.token) {
    return req.query.token;
  }
  return null;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
  const profile = sqliteDb
    .prepare('SELECT id, role, account_status, email FROM profiles WHERE id = ?')
    .get(payload.sub) as
    | { id: string; role: 'worker' | 'company' | 'admin'; account_status: string; email: string }
    | undefined;

  if (!profile) {
    return res.status(401).json({ error: 'Account no longer exists.' });
  }
  if (profile.account_status === 'suspended') {
    return res.status(403).json({
      error: 'Your account has been suspended by a platform administrator.',
    });
  }
  req.auth = {
    sub: profile.id,
    email: profile.email,
    role: profile.role,
    exp: payload.exp,
  };
  next();
}

function requireRole(...allowedRoles: Array<'worker' | 'company' | 'admin'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    if (!allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }
    next();
  };
}

function formatProfileRow(row: any) {
  if (!row) return null;
  return {
    ...row,
    is_verified: Boolean(row.is_verified),
  };
}

function formatWorkerProfileRow(row: any): WorkerProfile | null {
  if (!row) return null;
  let skills: string[] = [];
  try {
    skills = typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills || [];
  } catch {
    skills = [];
  }
  return {
    ...row,
    skills,
    experience_years: Number(row.experience_years || 0),
    expected_salary: row.expected_salary !== null ? Number(row.expected_salary) : null,
    profile_completion: Number(row.profile_completion || 0),
  };
}

function formatJobRow(row: any): Job {
  let skillsRequired: string[] = [];
  try {
    skillsRequired =
      typeof row.skills_required === 'string'
        ? JSON.parse(row.skills_required)
        : row.skills_required || [];
  } catch {
    skillsRequired = [];
  }
  return {
    ...row,
    experience_required: Number(row.experience_required || 0),
    salary_min: Number(row.salary_min || 0),
    salary_max: Number(row.salary_max || 0),
    vacancies: Number(row.vacancies || 1),
    skills_required: skillsRequired,
    applications_count:
      row.applications_count !== undefined ? Number(row.applications_count) : undefined,
  };
}

function createNotification(params: {
  user_id: string;
  title: string;
  message: string;
  type: 'application_submitted' | 'application_status' | 'job_moderation' | 'verification' | 'system';
  related_job_id?: string | null;
  related_application_id?: string | null;
}) {
  const now = new Date().toISOString();
  sqliteDb
    .prepare(
      `INSERT INTO notifications (id, user_id, title, message, type, related_job_id, related_application_id, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .run(
      crypto.randomUUID(),
      params.user_id,
      params.title,
      params.message,
      params.type,
      params.related_job_id || null,
      params.related_application_id || null,
      now
    );
}

// ============================================================================
// 1. AUTHENTICATION ROUTES
// ============================================================================

app.post('/api/auth/signup', (req: Request, res: Response) => {
  try {
    const {
      role,
      full_name,
      email,
      phone,
      password,
      city,
      state,
      company_name,
      industry,
    } = req.body || {};

    // CRITICAL SECURITY RULE: Never allow public registration as admin
    if (role === 'admin') {
      return res.status(403).json({
        error: 'Security Violation: Administrator accounts cannot be created via public signup.',
      });
    }

    if (role !== 'worker' && role !== 'company') {
      return res.status(400).json({ error: 'Please select a valid account type (Worker or Company).' });
    }

    if (role === 'worker') {
      const check = validateWorkerSignup({ full_name, email, phone, password, city, state });
      if (!check.valid) return res.status(400).json({ error: check.error });
    } else {
      const check = validateCompanySignup({
        full_name,
        company_name,
        email,
        phone,
        password,
        industry,
        city,
        state,
      });
      if (!check.valid) return res.status(400).json({ error: check.error });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = sqliteDb
      .prepare('SELECT id FROM profiles WHERE lower(email) = ?')
      .get(normalizedEmail);

    if (existing) {
      return res.status(409).json({
        error: 'An account with this email address is already registered.',
      });
    }

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = hashPassword(password);

    const signupTx = sqliteDb.transaction(() => {
      sqliteDb
        .prepare(
          `INSERT INTO auth_credentials (user_id, email, password_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(userId, normalizedEmail, passwordHash, now, now);

      sqliteDb
        .prepare(
          `INSERT INTO profiles (id, full_name, email, phone, role, avatar_url, city, state, country, preferred_language, is_verified, account_status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 'India', 'English', 0, 'active', ?, ?)`
        )
        .run(
          userId,
          String(full_name).trim(),
          normalizedEmail,
          String(phone).trim(),
          role,
          String(city).trim(),
          String(state).trim(),
          now,
          now
        );

      if (role === 'worker') {
        const initialCompletion = calculateWorkerProfileCompletion({
          full_name,
          phone,
          city,
          state,
        });
        sqliteDb
          .prepare(
            `INSERT INTO worker_profiles (id, user_id, headline, bio, skills, experience_years, education, employment_type, expected_salary, preferred_location, availability_status, resume_url, profile_completion, created_at, updated_at)
             VALUES (?, ?, '', '', '[]', 0, '', 'Full-Time', NULL, ?, 'available', NULL, ?, ?, ?)`
          )
          .run(
            crypto.randomUUID(),
            userId,
            `${String(city).trim()}, ${String(state).trim()}`,
            initialCompletion,
            now,
            now
          );
      } else {
        sqliteDb
          .prepare(
            `INSERT INTO companies (id, owner_id, company_name, logo_url, industry, description, website, email, phone, city, state, country, verification_status, created_at, updated_at)
             VALUES (?, ?, ?, NULL, ?, '', '', ?, ?, ?, ?, 'India', 'pending', ?, ?)`
          )
          .run(
            crypto.randomUUID(),
            userId,
            String(company_name).trim(),
            String(industry).trim(),
            normalizedEmail,
            String(phone).trim(),
            String(city).trim(),
            String(state).trim(),
            now,
            now
          );
      }

      createNotification({
        user_id: userId,
        title: 'Welcome to Memployment',
        message:
          role === 'worker'
            ? 'Complete your trade skills and upload your resume to start applying for verified jobs.'
            : 'Complete your company profile and submit verification documents to build trust with workers.',
        type: 'system',
      });
    });

    signupTx();

    const profile = formatProfileRow(
      sqliteDb.prepare('SELECT * FROM profiles WHERE id = ?').get(userId)
    );
    const workerProfile =
      role === 'worker'
        ? formatWorkerProfileRow(
            sqliteDb.prepare('SELECT * FROM worker_profiles WHERE user_id = ?').get(userId)
          )
        : null;
    const company =
      role === 'company'
        ? sqliteDb.prepare('SELECT * FROM companies WHERE owner_id = ?').get(userId)
        : null;

    const token = createSessionToken({
      id: userId,
      email: normalizedEmail,
      role,
    });

    return res.status(201).json({
      token,
      user: profile,
      workerProfile,
      company,
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    const emailCheck = validateEmail(email || '');
    if (!emailCheck.valid) return res.status(400).json({ error: emailCheck.error });
    if (!password) return res.status(400).json({ error: 'Password is required.' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const cred = sqliteDb
      .prepare('SELECT * FROM auth_credentials WHERE lower(email) = ?')
      .get(normalizedEmail) as { user_id: string; password_hash: string } | undefined;

    if (!cred || !verifyPassword(password, cred.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const profile = formatProfileRow(
      sqliteDb.prepare('SELECT * FROM profiles WHERE id = ?').get(cred.user_id)
    );
    if (!profile) {
      return res.status(401).json({ error: 'User profile not found.' });
    }
    if (profile.account_status === 'suspended') {
      return res.status(403).json({
        error: 'This account has been suspended by platform administration.',
      });
    }

    const workerProfile =
      profile.role === 'worker'
        ? formatWorkerProfileRow(
            sqliteDb.prepare('SELECT * FROM worker_profiles WHERE user_id = ?').get(profile.id)
          )
        : null;
    const company =
      profile.role === 'company'
        ? sqliteDb.prepare('SELECT * FROM companies WHERE owner_id = ?').get(profile.id)
        : null;

    const token = createSessionToken({
      id: profile.id,
      email: profile.email,
      role: profile.role,
    });

    return res.json({
      token,
      user: profile,
      workerProfile,
      company,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  try {
    const { email, phone, new_password } = req.body || {};
    const emailCheck = validateEmail(email || '');
    if (!emailCheck.valid) return res.status(400).json({ error: emailCheck.error });
    const passCheck = validatePassword(new_password || '');
    if (!passCheck.valid) return res.status(400).json({ error: passCheck.error });

    const normalizedEmail = String(email).trim().toLowerCase();
    const profile = sqliteDb
      .prepare('SELECT id, phone FROM profiles WHERE lower(email) = ?')
      .get(normalizedEmail) as { id: string; phone: string } | undefined;

    if (!profile) {
      return res.status(404).json({ error: 'No account found with that email address.' });
    }

    // Verify phone last 4 digits if phone provided
    if (phone && profile.phone) {
      const cleanInput = String(phone).replace(/\D/g, '');
      const cleanStored = String(profile.phone).replace(/\D/g, '');
      if (cleanInput.slice(-4) !== cleanStored.slice(-4)) {
        return res.status(400).json({
          error: 'Registered phone number verification did not match.',
        });
      }
    }

    const newHash = hashPassword(new_password);
    sqliteDb
      .prepare('UPDATE auth_credentials SET password_hash = ?, updated_at = ? WHERE user_id = ?')
      .run(newHash, new Date().toISOString(), profile.id);

    return res.json({ message: 'Password has been reset successfully. You may now sign in.' });
  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(500).json({ error: 'Could not reset password.' });
  }
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const profile = formatProfileRow(
    sqliteDb.prepare('SELECT * FROM profiles WHERE id = ?').get(userId)
  );
  const workerProfile =
    profile.role === 'worker'
      ? formatWorkerProfileRow(
          sqliteDb.prepare('SELECT * FROM worker_profiles WHERE user_id = ?').get(userId)
        )
      : null;
  const company =
    profile.role === 'company'
      ? sqliteDb.prepare('SELECT * FROM companies WHERE owner_id = ?').get(userId)
      : null;
  const unreadRow = sqliteDb
    .prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(userId) as { count: number };

  return res.json({
    user: profile,
    workerProfile,
    company,
    unreadNotifications: unreadRow.count,
    supabaseConnected: isSupabaseServerConfigured,
  });
});

// ============================================================================
// 2. PUBLIC LANDING & JOBS DISCOVERY ROUTES
// ============================================================================

app.get('/api/public/landing', (req: Request, res: Response) => {
  try {
    const publishedJobsCount = (
      sqliteDb.prepare(`SELECT COUNT(*) as c FROM jobs WHERE status = 'published'`).get() as {
        c: number;
      }
    ).c;
    const totalJobsCount = (
      sqliteDb.prepare(`SELECT COUNT(*) as c FROM jobs`).get() as { c: number }
    ).c;
    const verifiedCompaniesCount = (
      sqliteDb
        .prepare(`SELECT COUNT(*) as c FROM companies WHERE verification_status = 'verified'`)
        .get() as { c: number }
    ).c;
    const totalCompaniesCount = (
      sqliteDb.prepare(`SELECT COUNT(*) as c FROM companies`).get() as { c: number }
    ).c;
    const totalWorkersCount = (
      sqliteDb.prepare(`SELECT COUNT(*) as c FROM profiles WHERE role = 'worker'`).get() as {
        c: number;
      }
    ).c;
    const totalUsersCount = (
      sqliteDb.prepare(`SELECT COUNT(*) as c FROM profiles`).get() as { c: number }
    ).c;
    const totalAppsCount = (
      sqliteDb.prepare(`SELECT COUNT(*) as c FROM applications`).get() as { c: number }
    ).c;
    const acceptedPlacementsCount = (
      sqliteDb
        .prepare(`SELECT COUNT(*) as c FROM applications WHERE status IN ('accepted', 'shortlisted')`)
        .get() as { c: number }
    ).c;
    const pendingVerificationsCount = (
      sqliteDb
        .prepare(`SELECT COUNT(*) as c FROM verification_requests WHERE status = 'pending'`)
        .get() as { c: number }
    ).c;

    const categoryRows = sqliteDb
      .prepare(
        `SELECT category, COUNT(*) as count
         FROM jobs
         WHERE status = 'published'
         GROUP BY category
         ORDER BY count DESC`
      )
      .all() as { category: string; count: number }[];

    const featuredJobRows = sqliteDb
      .prepare(
        `SELECT j.*,
                c.company_name,
                c.logo_url as company_logo,
                c.industry as company_industry,
                c.verification_status as company_verified,
                (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) as applications_count
         FROM jobs j
         JOIN companies c ON c.id = j.company_id
         WHERE j.status = 'published'
         ORDER BY j.created_at DESC
         LIMIT 6`
      )
      .all();

    const genuineReviews = sqliteDb
      .prepare(
        `SELECT r.*,
                p1.full_name as reviewer_name,
                p1.role as reviewer_role,
                p1.city as reviewer_city,
                p2.full_name as reviewed_name,
                j.title as job_title,
                c.company_name
         FROM reviews r
         JOIN profiles p1 ON p1.id = r.reviewer_id
         JOIN profiles p2 ON p2.id = r.reviewed_user_id
         JOIN jobs j ON j.id = r.job_id
         JOIN companies c ON c.id = j.company_id
         ORDER BY r.created_at DESC
         LIMIT 6`
      )
      .all();

    return res.json({
      stats: {
        total_jobs: totalJobsCount,
        published_jobs: publishedJobsCount,
        verified_companies: verifiedCompaniesCount,
        total_companies: totalCompaniesCount,
        total_workers: totalWorkersCount,
        total_users: totalUsersCount,
        total_applications: totalAppsCount,
        accepted_placements: acceptedPlacementsCount,
        pending_verifications: pendingVerificationsCount,
        categories: categoryRows,
      },
      featuredJobs: featuredJobRows.map(formatJobRow),
      reviews: genuineReviews,
    });
  } catch (error) {
    console.error('Landing data error:', error);
    return res.status(500).json({ error: 'Failed to load landing page data.' });
  }
});

app.get('/api/jobs', (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim();
    const location = String(req.query.location || '').trim().toLowerCase();
    const employmentType = String(req.query.employment_type || '').trim();
    const minSalary = Number(req.query.min_salary || 0);
    const maxExperience =
      req.query.max_experience !== undefined && req.query.max_experience !== ''
        ? Number(req.query.max_experience)
        : null;
    const skillFilter = String(req.query.skill || '').trim().toLowerCase();
    const sort = String(req.query.sort || 'newest');
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));

    // Check if authenticated worker to compute skill match scores
    let workerProfile: WorkerProfile | null = null;
    let workerCity = '';
    let workerState = '';
    const token = extractToken(req);
    if (token) {
      const payload = verifySessionToken(token);
      if (payload && payload.role === 'worker') {
        const wpRow = sqliteDb
          .prepare('SELECT * FROM worker_profiles WHERE user_id = ?')
          .get(payload.sub);
        const pRow = sqliteDb
          .prepare('SELECT city, state FROM profiles WHERE id = ?')
          .get(payload.sub) as { city: string; state: string } | undefined;
        workerProfile = formatWorkerProfileRow(wpRow);
        if (pRow) {
          workerCity = pRow.city;
          workerState = pRow.state;
        }
      }
    }

    // Only published jobs are returned on the public discovery endpoint
    const rawRows = sqliteDb
      .prepare(
        `SELECT j.*,
                c.company_name,
                c.logo_url as company_logo,
                c.industry as company_industry,
                c.verification_status as company_verified,
                (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) as applications_count
         FROM jobs j
         JOIN companies c ON c.id = j.company_id
         WHERE j.status = 'published'`
      )
      .all();

    let jobs = rawRows.map(formatJobRow).map((job) => {
      if (workerProfile) {
        return computeJobMatch(job, workerProfile, workerCity, workerState).job;
      }
      return job;
    });

    // Apply search & filters
    if (q) {
      jobs = jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.description.toLowerCase().includes(q) ||
          (j.company_name || '').toLowerCase().includes(q) ||
          j.category.toLowerCase().includes(q) ||
          j.skills_required.some((s) => s.toLowerCase().includes(q))
      );
    }
    if (category && category !== 'All') {
      jobs = jobs.filter((j) => j.category === category);
    }
    if (location) {
      jobs = jobs.filter(
        (j) =>
          j.city.toLowerCase().includes(location) ||
          j.state.toLowerCase().includes(location)
      );
    }
    if (employmentType && employmentType !== 'All') {
      jobs = jobs.filter((j) => j.employment_type === employmentType);
    }
    if (minSalary > 0) {
      jobs = jobs.filter((j) => j.salary_max >= minSalary);
    }
    if (maxExperience !== null && !isNaN(maxExperience)) {
      jobs = jobs.filter((j) => j.experience_required <= maxExperience);
    }
    if (skillFilter) {
      jobs = jobs.filter((j) =>
        j.skills_required.some((s) => s.toLowerCase().includes(skillFilter))
      );
    }

    // Sorting
    if (sort === 'salary_high') {
      jobs.sort((a, b) => b.salary_max - a.salary_max);
    } else if (sort === 'match' && workerProfile) {
      jobs.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
    } else if (sort === 'deadline') {
      jobs.sort(
        (a, b) =>
          new Date(a.application_deadline).getTime() -
          new Date(b.application_deadline).getTime()
      );
    } else {
      jobs.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    const total = jobs.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const paginated = jobs.slice((page - 1) * limit, page * limit);

    return res.json({
      jobs: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Job search error:', error);
    return res.status(500).json({ error: 'Failed to search jobs.' });
  }
});

app.get('/api/jobs/:id', (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    const row = sqliteDb
      .prepare(
        `SELECT j.*,
                c.company_name,
                c.logo_url as company_logo,
                c.industry as company_industry,
                c.description as company_description,
                c.website as company_website,
                c.verification_status as company_verified,
                c.owner_id as company_owner_id,
                (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) as applications_count
         FROM jobs j
         JOIN companies c ON c.id = j.company_id
         WHERE j.id = ?`
      )
      .get(jobId) as any;

    if (!row) {
      return res.status(404).json({ error: 'Job posting not found.' });
    }

    const token = extractToken(req);
    const payload = token ? verifySessionToken(token) : null;

    if (row.status !== 'published') {
      const isOwner = payload && payload.sub === row.company_owner_id;
      const isAdmin = payload && payload.role === 'admin';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          error: 'This job posting is not currently published for public viewing.',
        });
      }
    }

    return res.json({ job: formatJobRow(row) });
  } catch (error) {
    console.error('Job detail error:', error);
    return res.status(500).json({ error: 'Failed to load job details.' });
  }
});

// ============================================================================
// 3. WORKER MODULE ROUTES
// ============================================================================

app.get(
  '/api/worker/dashboard',
  requireAuth,
  requireRole('worker'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const workerId = req.auth!.sub;
      const profile = formatProfileRow(
        sqliteDb.prepare('SELECT * FROM profiles WHERE id = ?').get(workerId)
      );
      const workerProfile = formatWorkerProfileRow(
        sqliteDb.prepare('SELECT * FROM worker_profiles WHERE user_id = ?').get(workerId)
      );

      const applications = sqliteDb
        .prepare(
          `SELECT a.*,
                  j.title as job_title,
                  j.city as job_city,
                  j.state as job_state,
                  j.employment_type as job_employment_type,
                  j.salary_min as job_salary_min,
                  j.salary_max as job_salary_max,
                  j.salary_type as job_salary_type,
                  c.id as company_id,
                  c.company_name,
                  c.logo_url as company_logo
           FROM applications a
           JOIN jobs j ON j.id = a.job_id
           JOIN companies c ON c.id = j.company_id
           WHERE a.worker_id = ?
           ORDER BY a.applied_at DESC`
        )
        .all(workerId);

      const savedRows = sqliteDb
        .prepare(
          `SELECT s.id as saved_id, s.job_id, s.worker_id, s.created_at as saved_at,
                  j.*,
                  c.company_name,
                  c.logo_url as company_logo,
                  c.industry as company_industry,
                  c.verification_status as company_verified
           FROM saved_jobs s
           JOIN jobs j ON j.id = s.job_id
           JOIN companies c ON c.id = j.company_id
           WHERE s.worker_id = ?
           ORDER BY s.created_at DESC`
        )
        .all(workerId) as any[];

      const savedJobs = savedRows.map((r) => ({
        id: r.saved_id,
        worker_id: r.worker_id,
        job_id: r.job_id,
        created_at: r.saved_at,
        job: formatJobRow(r),
      }));

      const verifications = sqliteDb
        .prepare(
          `SELECT * FROM verification_requests WHERE user_id = ? ORDER BY created_at DESC`
        )
        .all(workerId);

      // Compute rule-based recommended jobs
      const publishedJobRows = sqliteDb
        .prepare(
          `SELECT j.*,
                  c.company_name,
                  c.logo_url as company_logo,
                  c.industry as company_industry,
                  c.verification_status as company_verified
           FROM jobs j
           JOIN companies c ON c.id = j.company_id
           WHERE j.status = 'published'`
        )
        .all();

      const recommendedJobs = publishedJobRows
        .map(formatJobRow)
        .map((j) => computeJobMatch(j, workerProfile, profile.city, profile.state).job)
        .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
        .slice(0, 6);

      const stats = {
        profile_completion: workerProfile?.profile_completion || 25,
        total_applications: applications.length,
        pending_applications: applications.filter(
          (a: any) => a.status === 'pending' || a.status === 'reviewing'
        ).length,
        shortlisted_applications: applications.filter((a: any) => a.status === 'shortlisted')
          .length,
        accepted_applications: applications.filter((a: any) => a.status === 'accepted').length,
        rejected_applications: applications.filter((a: any) => a.status === 'rejected').length,
        saved_jobs_count: savedJobs.length,
      };

      return res.json({
        profile,
        workerProfile,
        stats,
        applications,
        savedJobs,
        verifications,
        recommendedJobs,
      });
    } catch (error) {
      console.error('Worker dashboard error:', error);
      return res.status(500).json({ error: 'Failed to load worker dashboard.' });
    }
  }
);

app.put(
  '/api/worker/profile',
  requireAuth,
  requireRole('worker'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const workerId = req.auth!.sub;
      const {
        full_name,
        phone,
        city,
        state,
        preferred_language,
        avatar_url,
        headline,
        bio,
        skills,
        experience_years,
        education,
        employment_type,
        expected_salary,
        preferred_location,
        availability_status,
        resume_url,
      } = req.body || {};

      if (!full_name || String(full_name).trim().length < 2) {
        return res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      }

      const existingProfile = sqliteDb
        .prepare('SELECT * FROM profiles WHERE id = ?')
        .get(workerId) as any;
      const existingWp = sqliteDb
        .prepare('SELECT * FROM worker_profiles WHERE user_id = ?')
        .get(workerId) as any;

      const parsedSkills: string[] = Array.isArray(skills)
        ? skills.map((s) => String(s).trim()).filter(Boolean)
        : typeof skills === 'string'
        ? skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : JSON.parse(existingWp?.skills || '[]');

      const finalAvatar = avatar_url !== undefined ? avatar_url : existingProfile.avatar_url;
      const finalResume = resume_url !== undefined ? resume_url : existingWp?.resume_url || null;

      const completion = calculateWorkerProfileCompletion({
        full_name: String(full_name).trim(),
        phone: String(phone ?? existingProfile.phone).trim(),
        city: String(city ?? existingProfile.city).trim(),
        state: String(state ?? existingProfile.state).trim(),
        avatar_url: finalAvatar,
        headline: String(headline ?? existingWp?.headline ?? '').trim(),
        bio: String(bio ?? existingWp?.bio ?? '').trim(),
        skills: parsedSkills,
        experience_years: Number(experience_years ?? existingWp?.experience_years ?? 0),
        education: String(education ?? existingWp?.education ?? '').trim(),
        expected_salary:
          expected_salary !== undefined && expected_salary !== ''
            ? Number(expected_salary)
            : existingWp?.expected_salary,
        preferred_location: String(
          preferred_location ?? existingWp?.preferred_location ?? ''
        ).trim(),
        resume_url: finalResume,
      });

      const now = new Date().toISOString();

      sqliteDb
        .prepare(
          `UPDATE profiles
           SET full_name = ?, phone = ?, city = ?, state = ?, preferred_language = ?, avatar_url = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          String(full_name).trim(),
          String(phone ?? existingProfile.phone).trim(),
          String(city ?? existingProfile.city).trim(),
          String(state ?? existingProfile.state).trim(),
          String(preferred_language ?? existingProfile.preferred_language).trim(),
          finalAvatar,
          now,
          workerId
        );

      sqliteDb
        .prepare(
          `UPDATE worker_profiles
           SET headline = ?, bio = ?, skills = ?, experience_years = ?, education = ?,
               employment_type = ?, expected_salary = ?, preferred_location = ?,
               availability_status = ?, resume_url = ?, profile_completion = ?, updated_at = ?
           WHERE user_id = ?`
        )
        .run(
          String(headline ?? existingWp?.headline ?? '').trim(),
          String(bio ?? existingWp?.bio ?? '').trim(),
          JSON.stringify(parsedSkills),
          Math.max(0, Number(experience_years ?? existingWp?.experience_years ?? 0)),
          String(education ?? existingWp?.education ?? '').trim(),
          String(employment_type ?? existingWp?.employment_type ?? 'Full-Time'),
          expected_salary !== undefined && expected_salary !== '' && expected_salary !== null
            ? Number(expected_salary)
            : null,
          String(preferred_location ?? existingWp?.preferred_location ?? '').trim(),
          String(availability_status ?? existingWp?.availability_status ?? 'available'),
          finalResume,
          completion,
          now,
          workerId
        );

      const updatedProfile = formatProfileRow(
        sqliteDb.prepare('SELECT * FROM profiles WHERE id = ?').get(workerId)
      );
      const updatedWorkerProfile = formatWorkerProfileRow(
        sqliteDb.prepare('SELECT * FROM worker_profiles WHERE user_id = ?').get(workerId)
      );

      return res.json({
        profile: updatedProfile,
        workerProfile: updatedWorkerProfile,
        message: 'Worker profile updated successfully.',
      });
    } catch (error) {
      console.error('Worker profile update error:', error);
      return res.status(500).json({ error: 'Failed to update profile.' });
    }
  }
);

app.post(
  '/api/worker/applications',
  requireAuth,
  requireRole('worker'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const workerId = req.auth!.sub;
      const { job_id, cover_letter, resume_url } = req.body || {};

      if (!job_id) {
        return res.status(400).json({ error: 'Job ID is required.' });
      }

      const job = sqliteDb
        .prepare(
          `SELECT j.*, c.owner_id as company_owner_id, c.company_name
           FROM jobs j
           JOIN companies c ON c.id = j.company_id
           WHERE j.id = ?`
        )
        .get(job_id) as any;

      if (!job) {
        return res.status(404).json({ error: 'Job posting not found.' });
      }
      if (job.status !== 'published') {
        return res.status(400).json({
          error: 'Applications are closed or unavailable for this job posting.',
        });
      }

      const todayStr = new Date().toISOString().split('T')[0];
      if (job.application_deadline && job.application_deadline < todayStr) {
        return res.status(400).json({
          error: 'The application deadline for this job has already passed.',
        });
      }

      // Check duplicate application
      const duplicate = sqliteDb
        .prepare('SELECT id FROM applications WHERE job_id = ? AND worker_id = ?')
        .get(job_id, workerId);
      if (duplicate) {
        return res.status(409).json({
          error: 'You have already submitted an application for this job.',
        });
      }

      const wp = sqliteDb
        .prepare('SELECT resume_url FROM worker_profiles WHERE user_id = ?')
        .get(workerId) as { resume_url: string | null } | undefined;
      const workerProfileRow = sqliteDb
        .prepare('SELECT full_name FROM profiles WHERE id = ?')
        .get(workerId) as { full_name: string };

      const finalResumeUrl = resume_url || wp?.resume_url || null;
      if (!finalResumeUrl) {
        return res.status(400).json({
          error: 'Please upload or attach your resume before applying.',
        });
      }

      const appId = crypto.randomUUID();
      const now = new Date().toISOString();

      sqliteDb
        .prepare(
          `INSERT INTO applications (id, job_id, worker_id, cover_letter, resume_url, status, applied_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
        )
        .run(
          appId,
          job_id,
          workerId,
          String(cover_letter || '').trim(),
          finalResumeUrl,
          now,
          now
        );

      // Notify company owner
      createNotification({
        user_id: job.company_owner_id,
        title: `New Application: ${job.title}`,
        message: `${workerProfileRow.full_name} applied for ${job.title}. Review their skills and resume in your recruitment dashboard.`,
        type: 'application_submitted',
        related_job_id: job_id,
        related_application_id: appId,
      });

      // Notify worker
      createNotification({
        user_id: workerId,
        title: `Application Submitted: ${job.title}`,
        message: `Your application to ${job.company_name} for ${job.title} has been received.`,
        type: 'application_submitted',
        related_job_id: job_id,
        related_application_id: appId,
      });

      const createdApp = sqliteDb
        .prepare('SELECT * FROM applications WHERE id = ?')
        .get(appId);

      return res.status(201).json({
        application: createdApp,
        message: 'Application submitted successfully.',
      });
    } catch (error) {
      console.error('Submit application error:', error);
      return res.status(500).json({ error: 'Failed to submit application.' });
    }
  }
);

app.post(
  '/api/worker/saved-jobs',
  requireAuth,
  requireRole('worker'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const workerId = req.auth!.sub;
      const { job_id } = req.body || {};
      if (!job_id) return res.status(400).json({ error: 'Job ID is required.' });

      const existing = sqliteDb
        .prepare('SELECT id FROM saved_jobs WHERE worker_id = ? AND job_id = ?')
        .get(workerId, job_id) as { id: string } | undefined;

      if (existing) {
        sqliteDb.prepare('DELETE FROM saved_jobs WHERE id = ?').run(existing.id);
        return res.json({ saved: false, message: 'Removed from saved jobs.' });
      } else {
        sqliteDb
          .prepare('INSERT INTO saved_jobs (id, worker_id, job_id, created_at) VALUES (?, ?, ?, ?)')
          .run(crypto.randomUUID(), workerId, job_id, new Date().toISOString());
        return res.status(201).json({ saved: true, message: 'Job saved to your list.' });
      }
    } catch (error) {
      console.error('Toggle saved job error:', error);
      return res.status(500).json({ error: 'Could not update saved jobs.' });
    }
  }
);

// ============================================================================
// 4. COMPANY MODULE ROUTES
// ============================================================================

app.get(
  '/api/company/dashboard',
  requireAuth,
  requireRole('company'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const ownerId = req.auth!.sub;
      const profile = formatProfileRow(
        sqliteDb.prepare('SELECT * FROM profiles WHERE id = ?').get(ownerId)
      );
      const company = sqliteDb
        .prepare('SELECT * FROM companies WHERE owner_id = ?')
        .get(ownerId) as any;

      if (!company) {
        return res.status(404).json({ error: 'Company profile not found.' });
      }

      const rawJobs = sqliteDb
        .prepare(
          `SELECT j.*,
                  c.company_name,
                  c.logo_url as company_logo,
                  (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) as applications_count
           FROM jobs j
           JOIN companies c ON c.id = j.company_id
           WHERE j.company_id = ?
           ORDER BY j.created_at DESC`
        )
        .all(company.id);

      const jobs = rawJobs.map(formatJobRow);

      const rawApplicants = sqliteDb
        .prepare(
          `SELECT a.*,
                  j.title as job_title,
                  j.city as job_city,
                  j.state as job_state,
                  j.employment_type as job_employment_type,
                  p.full_name as worker_name,
                  p.email as worker_email,
                  p.phone as worker_phone,
                  p.city as worker_city,
                  p.state as worker_state,
                  p.avatar_url as worker_avatar,
                  p.is_verified as worker_verified,
                  wp.headline as worker_headline,
                  wp.skills as worker_skills,
                  wp.experience_years as worker_experience_years,
                  wp.education as worker_education,
                  wp.availability_status as worker_availability,
                  wp.resume_url as worker_profile_resume
           FROM applications a
           JOIN jobs j ON j.id = a.job_id
           JOIN profiles p ON p.id = a.worker_id
           LEFT JOIN worker_profiles wp ON wp.user_id = p.id
           WHERE j.company_id = ?
           ORDER BY a.applied_at DESC`
        )
        .all(company.id) as any[];

      const applicants = rawApplicants.map((row) => {
        let parsedSkills: string[] = [];
        try {
          parsedSkills =
            typeof row.worker_skills === 'string'
              ? JSON.parse(row.worker_skills)
              : row.worker_skills || [];
        } catch {
          parsedSkills = [];
        }
        return {
          ...row,
          worker_verified: Boolean(row.worker_verified),
          worker_skills: parsedSkills,
          resume_url: row.resume_url || row.worker_profile_resume || null,
        };
      });

      const verifications = sqliteDb
        .prepare('SELECT * FROM verification_requests WHERE user_id = ? ORDER BY created_at DESC')
        .all(ownerId);

      const stats = {
        total_jobs: jobs.length,
        active_jobs: jobs.filter((j) => j.status === 'published').length,
        pending_jobs: jobs.filter((j) => j.status === 'pending' || j.status === 'draft').length,
        total_applicants: applicants.length,
        shortlisted_candidates: applicants.filter((a) => a.status === 'shortlisted').length,
        accepted_candidates: applicants.filter((a) => a.status === 'accepted').length,
      };

      return res.json({
        profile,
        company,
        stats,
        jobs,
        applicants,
        verifications,
      });
    } catch (error) {
      console.error('Company dashboard error:', error);
      return res.status(500).json({ error: 'Failed to load company dashboard.' });
    }
  }
);

app.put(
  '/api/company/profile',
  requireAuth,
  requireRole('company'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const ownerId = req.auth!.sub;
      const {
        full_name,
        company_name,
        logo_url,
        industry,
        description,
        website,
        email,
        phone,
        city,
        state,
      } = req.body || {};

      if (!company_name || String(company_name).trim().length < 2) {
        return res.status(400).json({ error: 'Company name is required.' });
      }
      if (!industry || String(industry).trim().length < 2) {
        return res.status(400).json({ error: 'Industry is required.' });
      }

      const existingComp = sqliteDb
        .prepare('SELECT * FROM companies WHERE owner_id = ?')
        .get(ownerId) as any;
      if (!existingComp) {
        return res.status(404).json({ error: 'Company profile not found.' });
      }

      const now = new Date().toISOString();
      const finalLogo = logo_url !== undefined ? logo_url : existingComp.logo_url;

      if (full_name) {
        sqliteDb
          .prepare(
            `UPDATE profiles SET full_name = ?, phone = ?, city = ?, state = ?, avatar_url = ?, updated_at = ? WHERE id = ?`
          )
          .run(
            String(full_name).trim(),
            String(phone ?? existingComp.phone).trim(),
            String(city ?? existingComp.city).trim(),
            String(state ?? existingComp.state).trim(),
            finalLogo,
            now,
            ownerId
          );
      }

      sqliteDb
        .prepare(
          `UPDATE companies
           SET company_name = ?, logo_url = ?, industry = ?, description = ?, website = ?,
               email = ?, phone = ?, city = ?, state = ?, updated_at = ?
           WHERE owner_id = ?`
        )
        .run(
          String(company_name).trim(),
          finalLogo,
          String(industry).trim(),
          String(description ?? existingComp.description ?? '').trim(),
          String(website ?? existingComp.website ?? '').trim(),
          String(email ?? existingComp.email).trim(),
          String(phone ?? existingComp.phone).trim(),
          String(city ?? existingComp.city).trim(),
          String(state ?? existingComp.state).trim(),
          now,
          ownerId
        );

      const updatedCompany = sqliteDb
        .prepare('SELECT * FROM companies WHERE owner_id = ?')
        .get(ownerId);
      const updatedProfile = formatProfileRow(
        sqliteDb.prepare('SELECT * FROM profiles WHERE id = ?').get(ownerId)
      );

      return res.json({
        profile: updatedProfile,
        company: updatedCompany,
        message: 'Company profile updated successfully.',
      });
    } catch (error) {
      console.error('Company profile update error:', error);
      return res.status(500).json({ error: 'Failed to update company profile.' });
    }
  }
);

app.post(
  '/api/company/jobs',
  requireAuth,
  requireRole('company'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const ownerId = req.auth!.sub;
      const company = sqliteDb
        .prepare('SELECT * FROM companies WHERE owner_id = ?')
        .get(ownerId) as any;

      if (!company) {
        return res.status(404).json({ error: 'Company profile not found.' });
      }

      const payload = req.body || {};
      const validation = validateJobPayload(payload);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const parsedSkills: string[] = Array.isArray(payload.skills_required)
        ? payload.skills_required.map((s: any) => String(s).trim()).filter(Boolean)
        : typeof payload.skills_required === 'string'
        ? payload.skills_required
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [];

      const jobStatus =
        payload.status === 'draft'
          ? 'draft'
          : company.verification_status === 'verified'
          ? 'published'
          : 'published';

      const jobId = crypto.randomUUID();
      const now = new Date().toISOString();

      sqliteDb
        .prepare(
          `INSERT INTO jobs (
             id, company_id, title, description, responsibilities, requirements,
             category, employment_type, experience_required, salary_min, salary_max,
             salary_type, vacancies, skills_required, city, state, country,
             application_deadline, status, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'India', ?, ?, ?, ?)`
        )
        .run(
          jobId,
          company.id,
          String(payload.title).trim(),
          String(payload.description).trim(),
          String(payload.responsibilities).trim(),
          String(payload.requirements).trim(),
          String(payload.category).trim(),
          String(payload.employment_type),
          Math.max(0, Number(payload.experience_required || 0)),
          Number(payload.salary_min),
          Number(payload.salary_max),
          String(payload.salary_type || 'monthly'),
          Math.max(1, Number(payload.vacancies || 1)),
          JSON.stringify(parsedSkills),
          String(payload.city).trim(),
          String(payload.state).trim(),
          String(payload.application_deadline),
          jobStatus,
          now,
          now
        );

      const createdJob = formatJobRow(
        sqliteDb.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId)
      );

      return res.status(201).json({
        job: createdJob,
        message: 'Job posting published successfully.',
      });
    } catch (error) {
      console.error('Create job error:', error);
      return res.status(500).json({ error: 'Failed to create job posting.' });
    }
  }
);

app.put(
  '/api/company/jobs/:id',
  requireAuth,
  requireRole('company'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const ownerId = req.auth!.sub;
      const jobId = req.params.id;

      const existing = sqliteDb
        .prepare(
          `SELECT j.*, c.owner_id
           FROM jobs j
           JOIN companies c ON c.id = j.company_id
           WHERE j.id = ?`
        )
        .get(jobId) as any;

      if (!existing) {
        return res.status(404).json({ error: 'Job posting not found.' });
      }
      if (existing.owner_id !== ownerId) {
        return res.status(403).json({
          error: 'Unauthorized: You can only modify your own company job postings.',
        });
      }

      const payload = req.body || {};
      const validation = validateJobPayload({ ...existing, ...payload });
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const parsedSkills: string[] = Array.isArray(payload.skills_required)
        ? payload.skills_required.map((s: any) => String(s).trim()).filter(Boolean)
        : typeof payload.skills_required === 'string'
        ? payload.skills_required
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : JSON.parse(existing.skills_required || '[]');

      const allowedStatuses = ['draft', 'published', 'closed'];
      const nextStatus =
        payload.status && allowedStatuses.includes(payload.status)
          ? payload.status
          : existing.status;

      sqliteDb
        .prepare(
          `UPDATE jobs
           SET title = ?, description = ?, responsibilities = ?, requirements = ?,
               category = ?, employment_type = ?, experience_required = ?,
               salary_min = ?, salary_max = ?, salary_type = ?, vacancies = ?,
               skills_required = ?, city = ?, state = ?, application_deadline = ?,
               status = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          String(payload.title ?? existing.title).trim(),
          String(payload.description ?? existing.description).trim(),
          String(payload.responsibilities ?? existing.responsibilities).trim(),
          String(payload.requirements ?? existing.requirements).trim(),
          String(payload.category ?? existing.category).trim(),
          String(payload.employment_type ?? existing.employment_type),
          Math.max(0, Number(payload.experience_required ?? existing.experience_required)),
          Number(payload.salary_min ?? existing.salary_min),
          Number(payload.salary_max ?? existing.salary_max),
          String(payload.salary_type ?? existing.salary_type),
          Math.max(1, Number(payload.vacancies ?? existing.vacancies)),
          JSON.stringify(parsedSkills),
          String(payload.city ?? existing.city).trim(),
          String(payload.state ?? existing.state).trim(),
          String(payload.application_deadline ?? existing.application_deadline),
          nextStatus,
          new Date().toISOString(),
          jobId
        );

      const updatedJob = formatJobRow(
        sqliteDb.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId)
      );
      return res.json({ job: updatedJob, message: 'Job posting updated successfully.' });
    } catch (error) {
      console.error('Update job error:', error);
      return res.status(500).json({ error: 'Failed to update job posting.' });
    }
  }
);

app.delete(
  '/api/company/jobs/:id',
  requireAuth,
  requireRole('company'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const ownerId = req.auth!.sub;
      const jobId = req.params.id;
      const existing = sqliteDb
        .prepare(
          `SELECT j.id, c.owner_id
           FROM jobs j
           JOIN companies c ON c.id = j.company_id
           WHERE j.id = ?`
        )
        .get(jobId) as any;

      if (!existing) {
        return res.status(404).json({ error: 'Job posting not found.' });
      }
      if (existing.owner_id !== ownerId) {
        return res.status(403).json({
          error: 'Unauthorized: Cannot delete another company’s job posting.',
        });
      }

      sqliteDb.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);
      return res.json({ message: 'Job posting deleted successfully.' });
    } catch (error) {
      console.error('Delete job error:', error);
      return res.status(500).json({ error: 'Failed to delete job posting.' });
    }
  }
);

app.patch(
  '/api/company/applications/:id/status',
  requireAuth,
  requireRole('company'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const ownerId = req.auth!.sub;
      const appId = req.params.id;
      const { status } = req.body || {};

      const validStatuses = ['pending', 'reviewing', 'shortlisted', 'accepted', 'rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid application status.' });
      }

      const appRow = sqliteDb
        .prepare(
          `SELECT a.*, j.title as job_title, c.owner_id, c.company_name
           FROM applications a
           JOIN jobs j ON j.id = a.job_id
           JOIN companies c ON c.id = j.company_id
           WHERE a.id = ?`
        )
        .get(appId) as any;

      if (!appRow) {
        return res.status(404).json({ error: 'Application not found.' });
      }
      if (appRow.owner_id !== ownerId) {
        return res.status(403).json({
          error: 'Unauthorized: You can only update applications for your own jobs.',
        });
      }

      const now = new Date().toISOString();
      sqliteDb
        .prepare('UPDATE applications SET status = ?, updated_at = ? WHERE id = ?')
        .run(status, now, appId);

      const statusMessages: Record<string, { title: string; msg: string }> = {
        reviewing: {
          title: `Application Under Review: ${appRow.job_title}`,
          msg: `${appRow.company_name} is now reviewing your application for ${appRow.job_title}.`,
        },
        shortlisted: {
          title: `Shortlisted for ${appRow.job_title}`,
          msg: `Congratulations! ${appRow.company_name} has shortlisted your application for ${appRow.job_title}.`,
        },
        accepted: {
          title: `Application Accepted: ${appRow.job_title}`,
          msg: `Great news! ${appRow.company_name} has accepted your application for ${appRow.job_title}. Expect a call from their recruitment team.`,
        },
        rejected: {
          title: `Application Status Update: ${appRow.job_title}`,
          msg: `${appRow.company_name} has updated the status of your application for ${appRow.job_title} to not selected at this time.`,
        },
        pending: {
          title: `Application Status Updated: ${appRow.job_title}`,
          msg: `Your application status for ${appRow.job_title} is marked as pending.`,
        },
      };

      const notifCopy = statusMessages[status];
      if (notifCopy) {
        createNotification({
          user_id: appRow.worker_id,
          title: notifCopy.title,
          message: notifCopy.msg,
          type: 'application_status',
          related_job_id: appRow.job_id,
          related_application_id: appId,
        });
      }

      return res.json({
        status,
        message: `Candidate status updated to ${status}.`,
      });
    } catch (error) {
      console.error('Update application status error:', error);
      return res.status(500).json({ error: 'Failed to update application status.' });
    }
  }
);

// ============================================================================
// 5. VERIFICATION REQUESTS (WORKER & COMPANY)
// ============================================================================

app.post('/api/verifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth!.sub;
    const { document_url, verification_type, notes } = req.body || {};

    if (!document_url) {
      return res.status(400).json({ error: 'Please upload a verification document first.' });
    }
    const allowedTypes = [
      'worker_identity',
      'trade_certificate',
      'company_registration',
      'factory_license',
    ];
    if (!allowedTypes.includes(verification_type)) {
      return res.status(400).json({ error: 'Invalid verification type.' });
    }

    const reqId = crypto.randomUUID();
    const now = new Date().toISOString();

    sqliteDb
      .prepare(
        `INSERT INTO verification_requests (id, user_id, document_url, verification_type, status, admin_notes, reviewed_by, reviewed_at, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?, NULL, NULL, ?)`
      )
      .run(reqId, userId, document_url, verification_type, notes ? String(notes).trim() : null, now);

    // Notify admins
    const admins = sqliteDb
      .prepare(`SELECT id FROM profiles WHERE role = 'admin'`)
      .all() as { id: string }[];
    for (const admin of admins) {
      createNotification({
        user_id: admin.id,
        title: 'New Verification Request Submitted',
        message: `A ${req.auth!.role} submitted a ${verification_type.replace('_', ' ')} document for verification.`,
        type: 'verification',
      });
    }

    return res.status(201).json({
      message: 'Verification request submitted to platform administrators.',
    });
  } catch (error) {
    console.error('Verification submit error:', error);
    return res.status(500).json({ error: 'Failed to submit verification request.' });
  }
});

// ============================================================================
// 6. ADMIN MODULE ROUTES (STRICT SERVER-SIDE ADMIN AUTHORIZATION)
// ============================================================================

app.get(
  '/api/admin/dashboard',
  requireAuth,
  requireRole('admin'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const users = sqliteDb
        .prepare('SELECT * FROM profiles ORDER BY created_at DESC')
        .all()
        .map(formatProfileRow);

      const workerProfiles = sqliteDb
        .prepare(
          `SELECT wp.*, p.full_name, p.email, p.phone, p.city, p.state, p.is_verified, p.account_status
           FROM worker_profiles wp
           JOIN profiles p ON p.id = wp.user_id
           ORDER BY wp.created_at DESC`
        )
        .all()
        .map((row: any) => ({
          ...formatWorkerProfileRow(row),
          full_name: row.full_name,
          email: row.email,
          phone: row.phone,
          city: row.city,
          state: row.state,
          is_verified: Boolean(row.is_verified),
          account_status: row.account_status,
        }));

      const companies = sqliteDb
        .prepare(
          `SELECT c.*, p.full_name as owner_name, p.account_status as owner_account_status
           FROM companies c
           JOIN profiles p ON p.id = c.owner_id
           ORDER BY c.created_at DESC`
        )
        .all();

      const jobs = sqliteDb
        .prepare(
          `SELECT j.*, c.company_name, c.verification_status as company_verified,
                  (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) as applications_count
           FROM jobs j
           JOIN companies c ON c.id = j.company_id
           ORDER BY j.created_at DESC`
        )
        .all()
        .map(formatJobRow);

      const applications = sqliteDb
        .prepare(
          `SELECT a.*,
                  j.title as job_title,
                  c.company_name,
                  p.full_name as worker_name,
                  p.email as worker_email,
                  p.city as worker_city
           FROM applications a
           JOIN jobs j ON j.id = a.job_id
           JOIN companies c ON c.id = j.company_id
           JOIN profiles p ON p.id = a.worker_id
           ORDER BY a.applied_at DESC`
        )
        .all();

      const verificationRequests = sqliteDb
        .prepare(
          `SELECT vr.*,
                  p.full_name as user_name,
                  p.email as user_email,
                  p.role as user_role,
                  p.city as user_city,
                  c.company_name
           FROM verification_requests vr
           JOIN profiles p ON p.id = vr.user_id
           LEFT JOIN companies c ON c.owner_id = p.id
           ORDER BY vr.created_at DESC`
        )
        .all();

      const stats = {
        total_users: users.length,
        total_workers: users.filter((u: any) => u.role === 'worker').length,
        total_companies: companies.length,
        verified_companies: companies.filter((c: any) => c.verification_status === 'verified')
          .length,
        total_jobs: jobs.length,
        published_jobs: jobs.filter((j) => j.status === 'published').length,
        pending_jobs: jobs.filter((j) => j.status === 'pending').length,
        total_applications: applications.length,
        accepted_applications: applications.filter((a: any) => a.status === 'accepted').length,
        pending_verifications: verificationRequests.filter((v: any) => v.status === 'pending')
          .length,
      };

      return res.json({
        stats,
        users,
        workerProfiles,
        companies,
        jobs,
        applications,
        verificationRequests,
      });
    } catch (error) {
      console.error('Admin dashboard error:', error);
      return res.status(500).json({ error: 'Failed to load admin dashboard.' });
    }
  }
);

app.patch(
  '/api/admin/users/:id/status',
  requireAuth,
  requireRole('admin'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const targetUserId = req.params.id;
      const { account_status } = req.body || {};

      if (!['active', 'suspended'].includes(account_status)) {
        return res.status(400).json({ error: 'Invalid account status.' });
      }
      if (targetUserId === req.auth!.sub) {
        return res.status(400).json({ error: 'You cannot suspend your own admin account.' });
      }

      sqliteDb
        .prepare('UPDATE profiles SET account_status = ?, updated_at = ? WHERE id = ?')
        .run(account_status, new Date().toISOString(), targetUserId);

      createNotification({
        user_id: targetUserId,
        title: `Account ${account_status === 'active' ? 'Activated' : 'Suspended'}`,
        message: `Your Memployment account status has been set to ${account_status} by platform administration.`,
        type: 'system',
      });

      return res.json({ message: `User account status updated to ${account_status}.` });
    } catch (error) {
      console.error('Admin user status error:', error);
      return res.status(500).json({ error: 'Failed to update account status.' });
    }
  }
);

app.patch(
  '/api/admin/users/:id/verify',
  requireAuth,
  requireRole('admin'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const targetUserId = req.params.id;
      const { is_verified } = req.body || {};

      sqliteDb
        .prepare('UPDATE profiles SET is_verified = ?, updated_at = ? WHERE id = ?')
        .run(is_verified ? 1 : 0, new Date().toISOString(), targetUserId);

      createNotification({
        user_id: targetUserId,
        title: is_verified ? 'Profile Verified by Admin' : 'Profile Verification Updated',
        message: is_verified
          ? 'Your Memployment profile has been verified by platform administration.'
          : 'Your profile verification status was updated by an administrator.',
        type: 'verification',
      });

      return res.json({
        message: `Worker verification status set to ${is_verified ? 'Verified' : 'Unverified'}.`,
      });
    } catch (error) {
      console.error('Admin verify user error:', error);
      return res.status(500).json({ error: 'Failed to update user verification.' });
    }
  }
);

app.patch(
  '/api/admin/companies/:id/verify',
  requireAuth,
  requireRole('admin'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = req.params.id;
      const { verification_status } = req.body || {};

      if (!['pending', 'verified', 'rejected'].includes(verification_status)) {
        return res.status(400).json({ error: 'Invalid company verification status.' });
      }

      const comp = sqliteDb
        .prepare('SELECT owner_id, company_name FROM companies WHERE id = ?')
        .get(companyId) as { owner_id: string; company_name: string } | undefined;

      if (!comp) {
        return res.status(404).json({ error: 'Company not found.' });
      }

      const now = new Date().toISOString();
      sqliteDb
        .prepare('UPDATE companies SET verification_status = ?, updated_at = ? WHERE id = ?')
        .run(verification_status, now, companyId);

      sqliteDb
        .prepare('UPDATE profiles SET is_verified = ?, updated_at = ? WHERE id = ?')
        .run(verification_status === 'verified' ? 1 : 0, now, comp.owner_id);

      createNotification({
        user_id: comp.owner_id,
        title: `Company Verification: ${verification_status.toUpperCase()}`,
        message: `Verification status for ${comp.company_name} has been updated to ${verification_status} by a platform administrator.`,
        type: 'verification',
      });

      return res.json({
        message: `Company verification updated to ${verification_status}.`,
      });
    } catch (error) {
      console.error('Admin verify company error:', error);
      return res.status(500).json({ error: 'Failed to update company verification.' });
    }
  }
);

app.patch(
  '/api/admin/verifications/:id',
  requireAuth,
  requireRole('admin'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const reqId = req.params.id;
      const { status, admin_notes } = req.body || {};

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status must be approved or rejected.' });
      }

      const vr = sqliteDb
        .prepare('SELECT * FROM verification_requests WHERE id = ?')
        .get(reqId) as any;
      if (!vr) {
        return res.status(404).json({ error: 'Verification request not found.' });
      }

      const now = new Date().toISOString();
      sqliteDb
        .prepare(
          `UPDATE verification_requests
           SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = ?
           WHERE id = ?`
        )
        .run(status, admin_notes || vr.admin_notes, req.auth!.sub, now, reqId);

      if (status === 'approved') {
        sqliteDb
          .prepare('UPDATE profiles SET is_verified = 1, updated_at = ? WHERE id = ?')
          .run(now, vr.user_id);

        sqliteDb
          .prepare(
            `UPDATE companies SET verification_status = 'verified', updated_at = ? WHERE owner_id = ?`
          )
          .run(now, vr.user_id);
      } else {
        sqliteDb
          .prepare(
            `UPDATE companies SET verification_status = 'rejected', updated_at = ? WHERE owner_id = ?`
          )
          .run(now, vr.user_id);
      }

      createNotification({
        user_id: vr.user_id,
        title: `Document Verification ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message:
          status === 'approved'
            ? `Your ${vr.verification_type.replace('_', ' ')} document was approved and your account is now verified.`
            : `Your verification request was not approved. Note: ${admin_notes || 'Please upload a clearer document.'}`,
        type: 'verification',
      });

      return res.json({
        message: `Verification request ${status}.`,
      });
    } catch (error) {
      console.error('Admin verification review error:', error);
      return res.status(500).json({ error: 'Failed to process verification request.' });
    }
  }
);

app.patch(
  '/api/admin/jobs/:id/status',
  requireAuth,
  requireRole('admin'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = req.params.id;
      const { status } = req.body || {};

      if (!['published', 'pending', 'closed', 'rejected', 'draft'].includes(status)) {
        return res.status(400).json({ error: 'Invalid job status.' });
      }

      const job = sqliteDb
        .prepare(
          `SELECT j.title, c.owner_id
           FROM jobs j
           JOIN companies c ON c.id = j.company_id
           WHERE j.id = ?`
        )
        .get(jobId) as { title: string; owner_id: string } | undefined;

      if (!job) {
        return res.status(404).json({ error: 'Job posting not found.' });
      }

      sqliteDb
        .prepare('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?')
        .run(status, new Date().toISOString(), jobId);

      createNotification({
        user_id: job.owner_id,
        title: `Job Moderation Update: ${job.title}`,
        message: `Administrator updated the status of "${job.title}" to ${status}.`,
        type: 'job_moderation',
        related_job_id: jobId,
      });

      return res.json({ message: `Job status updated to ${status}.` });
    } catch (error) {
      console.error('Admin job status error:', error);
      return res.status(500).json({ error: 'Failed to update job status.' });
    }
  }
);

app.delete(
  '/api/admin/jobs/:id',
  requireAuth,
  requireRole('admin'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = req.params.id;
      sqliteDb.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);
      return res.json({ message: 'Job posting removed by administrator.' });
    } catch (error) {
      console.error('Admin delete job error:', error);
      return res.status(500).json({ error: 'Failed to remove job posting.' });
    }
  }
);

// ============================================================================
// 7. NOTIFICATIONS & REVIEWS
// ============================================================================

app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  const rows = sqliteDb
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(userId)
    .map((r: any) => ({ ...r, is_read: Boolean(r.is_read) }));

  return res.json({ notifications: rows });
});

app.patch('/api/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  sqliteDb
    .prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, userId);
  return res.json({ message: 'Notification marked as read.' });
});

app.post('/api/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.sub;
  sqliteDb.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
  return res.json({ message: 'All notifications marked as read.' });
});

app.post('/api/reviews', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const reviewerId = req.auth!.sub;
    const { reviewed_user_id, job_id, rating, review_text } = req.body || {};

    if (!reviewed_user_id || !job_id) {
      return res.status(400).json({ error: 'Target user and job are required.' });
    }
    if (reviewerId === reviewed_user_id) {
      return res.status(400).json({ error: 'You cannot review yourself.' });
    }
    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }
    if (!review_text || String(review_text).trim().length < 10) {
      return res.status(400).json({ error: 'Review text must be at least 10 characters.' });
    }

    const existing = sqliteDb
      .prepare(
        'SELECT id FROM reviews WHERE reviewer_id = ? AND reviewed_user_id = ? AND job_id = ?'
      )
      .get(reviewerId, reviewed_user_id, job_id);
    if (existing) {
      return res.status(409).json({
        error: 'You have already submitted a review for this placement.',
      });
    }

    sqliteDb
      .prepare(
        `INSERT INTO reviews (id, reviewer_id, reviewed_user_id, job_id, rating, review_text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        crypto.randomUUID(),
        reviewerId,
        reviewed_user_id,
        job_id,
        numRating,
        String(review_text).trim(),
        new Date().toISOString()
      );

    return res.status(201).json({ message: 'Review published successfully.' });
  } catch (error) {
    console.error('Review create error:', error);
    return res.status(500).json({ error: 'Failed to submit review.' });
  }
});

// ============================================================================
// 8. SECURE FILE UPLOADS & PRIVATE BUCKET AUTHORIZATION
// ============================================================================

app.post('/api/storage/upload', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth!.sub;
    const { bucket, fileName, mimeType, base64Data } = req.body || {};

    const validBuckets: StorageBucketName[] = [
      'avatars',
      'company-logos',
      'resumes',
      'verification-documents',
    ];
    if (!validBuckets.includes(bucket)) {
      return res.status(400).json({ error: 'Invalid storage bucket.' });
    }
    if (!base64Data || !fileName || !mimeType) {
      return res.status(400).json({ error: 'Missing file payload or metadata.' });
    }

    const base64Clean = String(base64Data).includes(',')
      ? String(base64Data).split(',')[1]
      : String(base64Data);
    const buffer = Buffer.from(base64Clean, 'base64');

    const validation = validateFileUpload(bucket, mimeType, buffer.byteLength);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const safeFileName = `${Date.now()}_${String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const userDir = path.resolve(process.cwd(), 'data', 'storage', bucket, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const filePath = path.resolve(userDir, safeFileName);
    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/api/storage/${bucket}/${userId}/${safeFileName}`;
    return res.status(201).json({
      url: fileUrl,
      bucket,
      fileName: safeFileName,
      size: buffer.byteLength,
      message: 'File uploaded securely.',
    });
  } catch (error) {
    console.error('File upload error:', error);
    return res.status(500).json({ error: 'File upload failed.' });
  }
});

app.get('/api/storage/:bucket/:userId/:filename', (req: Request, res: Response) => {
  try {
    const { bucket, userId, filename } = req.params;
    const safeBucket = ['avatars', 'company-logos', 'resumes', 'verification-documents'].includes(
      bucket
    )
      ? bucket
      : null;

    if (!safeBucket) {
      return res.status(400).json({ error: 'Invalid bucket.' });
    }

    // Enforce strict access control for private buckets (resumes & verification-documents)
    if (safeBucket === 'resumes' || safeBucket === 'verification-documents') {
      const token = extractToken(req);
      if (!token) {
        return res.status(401).json({
          error: 'Unauthorized: Private documents require authentication.',
        });
      }
      const payload = verifySessionToken(token);
      if (!payload) {
        return res.status(401).json({ error: 'Invalid or expired session token.' });
      }

      const isOwner = payload.sub === userId;
      const isAdmin = payload.role === 'admin';

      let isAuthorizedCompany = false;
      if (payload.role === 'company' && safeBucket === 'resumes') {
        const hasApplicantRel = sqliteDb
          .prepare(
            `SELECT 1
             FROM applications a
             JOIN jobs j ON j.id = a.job_id
             JOIN companies c ON c.id = j.company_id
             WHERE a.worker_id = ? AND c.owner_id = ?`
          )
          .get(userId, payload.sub);
        isAuthorizedCompany = Boolean(hasApplicantRel);
      }

      if (!isOwner && !isAdmin && !isAuthorizedCompany) {
        return res.status(403).json({
          error: 'Forbidden: You do not have permission to access this private document.',
        });
      }
    }

    const sanitizedFilename = path.basename(filename);
    const filePath = path.resolve(
      process.cwd(),
      'data',
      'storage',
      safeBucket,
      userId,
      sanitizedFilename
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const ext = path.extname(sanitizedFilename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${sanitizedFilename}"`);
    return res.sendFile(filePath);
  } catch (error) {
    console.error('Storage download error:', error);
    return res.status(500).json({ error: 'Could not retrieve file.' });
  }
});

// ============================================================================
// 9. VITE DEV SERVER / STATIC PRODUCTION SERVING
// ============================================================================

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Memployment full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
