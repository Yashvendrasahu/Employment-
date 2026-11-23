-- ============================================================================
-- MEMPLOYMENT — COMPLETE SUPABASE POSTGRESQL SCHEMA, INDEXES, RLS & STORAGE
-- Tagline: Find Work. Hire Faster. Build Better Opportunities.
-- ============================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. UTILITY FUNCTIONS & TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper function to check if the current authenticated user is a verified Admin
-- Uses SECURITY DEFINER to avoid infinite recursion when evaluating RLS policies on profiles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
BEGIN
  SELECT role, account_status INTO v_role, v_status
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN (v_role = 'admin' AND v_status = 'active');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 2. TABLES DEFINITION
-- ============================================================================

-- 2.1 profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 2),
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'worker' CHECK (role IN ('worker', 'company', 'admin')),
  avatar_url TEXT,
  city TEXT,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'India',
  preferred_language TEXT NOT NULL DEFAULT 'English',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Prevent non-admin users from escalating their own role, verification status, or account status
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('role', true) = 'authenticated' AND NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Unauthorized: Cannot modify user role.';
    END IF;
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
      RAISE EXCEPTION 'Unauthorized: Cannot self-verify profile.';
    END IF;
    IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
      RAISE EXCEPTION 'Unauthorized: Cannot modify account status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_protect_profile_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_columns();

-- Prevent public signup from creating admin accounts
CREATE OR REPLACE FUNCTION public.prevent_public_admin_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('role', true) IN ('anon', 'authenticated') AND NEW.role = 'admin' THEN
    RAISE EXCEPTION 'Security Violation: Admin accounts can only be provisioned via server-side service_role.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_prevent_public_admin_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_public_admin_insert();

-- 2.2 worker_profiles
CREATE TABLE IF NOT EXISTS public.worker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  headline TEXT,
  bio TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  experience_years INTEGER NOT NULL DEFAULT 0 CHECK (experience_years >= 0 AND experience_years <= 60),
  education TEXT,
  employment_type TEXT NOT NULL DEFAULT 'Full-Time' CHECK (employment_type IN ('Full-Time', 'Contract', 'Shift-Based', 'Daily Wage', 'Apprenticeship')),
  expected_salary NUMERIC(12, 2) CHECK (expected_salary IS NULL OR expected_salary >= 0),
  preferred_location TEXT,
  availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'employed', 'notice_period', 'unavailable')),
  resume_url TEXT,
  profile_completion INTEGER NOT NULL DEFAULT 25 CHECK (profile_completion >= 0 AND profile_completion <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_worker_profiles_updated_at
BEFORE UPDATE ON public.worker_profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2.3 companies
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL CHECK (char_length(trim(company_name)) >= 2),
  logo_url TEXT,
  industry TEXT NOT NULL,
  description TEXT,
  website TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Prevent company owners from self-verifying their company
CREATE OR REPLACE FUNCTION public.protect_company_verification()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('role', true) = 'authenticated' AND NOT public.is_admin() THEN
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      RAISE EXCEPTION 'Unauthorized: Only administrators can change company verification_status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_protect_company_verification
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.protect_company_verification();

-- 2.4 jobs
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 3),
  description TEXT NOT NULL,
  responsibilities TEXT NOT NULL,
  requirements TEXT NOT NULL,
  category TEXT NOT NULL,
  employment_type TEXT NOT NULL CHECK (employment_type IN ('Full-Time', 'Contract', 'Shift-Based', 'Daily Wage', 'Apprenticeship')),
  experience_required INTEGER NOT NULL DEFAULT 0 CHECK (experience_required >= 0),
  salary_min NUMERIC(12, 2) NOT NULL CHECK (salary_min >= 0),
  salary_max NUMERIC(12, 2) NOT NULL CHECK (salary_max >= salary_min),
  salary_type TEXT NOT NULL DEFAULT 'monthly' CHECK (salary_type IN ('monthly', 'daily', 'hourly', 'yearly')),
  vacancies INTEGER NOT NULL DEFAULT 1 CHECK (vacancies >= 1),
  skills_required TEXT[] NOT NULL DEFAULT '{}',
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  application_deadline DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'pending', 'published', 'closed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2.5 applications
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cover_letter TEXT,
  resume_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'shortlisted', 'accepted', 'rejected')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_applications_job_worker UNIQUE (job_id, worker_id)
);

CREATE TRIGGER trg_applications_updated_at
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2.6 saved_jobs
CREATE TABLE IF NOT EXISTS public.saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_saved_jobs_worker_job UNIQUE (worker_id, job_id)
);

-- 2.7 notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'system' CHECK (type IN ('application_submitted', 'application_status', 'job_moderation', 'verification', 'system')),
  related_job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  related_application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.8 verification_requests
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('worker_identity', 'trade_certificate', 'company_registration', 'factory_license')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.9 reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewed_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT NOT NULL CHECK (char_length(trim(review_text)) >= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_reviews_relationship UNIQUE (reviewer_id, reviewed_user_id, job_id),
  CONSTRAINT chk_no_self_review CHECK (reviewer_id <> reviewed_user_id)
);

-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_user_id ON public.worker_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_worker_profiles_skills ON public.worker_profiles USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON public.companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_city ON public.companies(city);
CREATE INDEX IF NOT EXISTS idx_companies_verification_status ON public.companies(verification_status);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON public.jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON public.jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_city ON public.jobs(city);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_employment_type ON public.jobs(employment_type);
CREATE INDEX IF NOT EXISTS idx_jobs_skills_required ON public.jobs USING GIN(skills_required);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON public.applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_worker_id ON public.applications(worker_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_worker_id ON public.saved_jobs(worker_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON public.verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON public.verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_user_id ON public.reviews(reviewed_user_id);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 4.1 profiles policies
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Companies can read applicant profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      JOIN public.companies c ON c.id = j.company_id
      WHERE a.worker_id = public.profiles.id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own non-admin profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id AND role IN ('worker', 'company'));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- 4.2 worker_profiles policies
CREATE POLICY "Workers can read and manage own worker_profile"
  ON public.worker_profiles FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Companies can view worker_profiles of their applicants"
  ON public.worker_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      JOIN public.companies c ON c.id = j.company_id
      WHERE a.worker_id = public.worker_profiles.user_id
        AND c.owner_id = auth.uid()
    )
  );

-- 4.3 companies policies
CREATE POLICY "Public can view companies"
  ON public.companies FOR SELECT
  USING (true);

CREATE POLICY "Company owners can insert own company"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Company owners and admins can update company"
  ON public.companies FOR UPDATE
  USING (auth.uid() = owner_id OR public.is_admin())
  WITH CHECK (auth.uid() = owner_id OR public.is_admin());

-- 4.4 jobs policies
CREATE POLICY "Public can read published jobs, owners and admins read all"
  ON public.jobs FOR SELECT
  USING (
    status = 'published'
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.jobs.company_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Companies can create jobs for own company"
  ON public.jobs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Companies can update own jobs or admin can moderate"
  ON public.jobs FOR UPDATE
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.jobs.company_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Companies can delete own jobs or admin can remove"
  ON public.jobs FOR DELETE
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = public.jobs.company_id AND c.owner_id = auth.uid()
    )
  );

-- 4.5 applications policies
CREATE POLICY "Workers read own applications, companies read job applications, admins read all"
  ON public.applications FOR SELECT
  USING (
    worker_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.companies c ON c.id = j.company_id
      WHERE j.id = public.applications.job_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Workers can submit applications to published jobs"
  ON public.applications FOR INSERT
  WITH CHECK (
    worker_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id AND j.status = 'published' AND j.application_deadline >= CURRENT_DATE
    )
  );

CREATE POLICY "Companies can update application status for their jobs"
  ON public.applications FOR UPDATE
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.companies c ON c.id = j.company_id
      WHERE j.id = public.applications.job_id AND c.owner_id = auth.uid()
    )
  );

-- 4.6 saved_jobs policies
CREATE POLICY "Workers can manage own saved jobs"
  ON public.saved_jobs FOR ALL
  USING (worker_id = auth.uid())
  WITH CHECK (worker_id = auth.uid());

-- 4.7 notifications policies
CREATE POLICY "Users can read and update own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can mark own notifications read"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4.8 verification_requests policies
CREATE POLICY "Users can view and submit own verification requests, admins manage all"
  ON public.verification_requests FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can insert own verification requests"
  ON public.verification_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Only admins can update verification requests"
  ON public.verification_requests FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4.9 reviews policies
CREATE POLICY "Public can read genuine reviews"
  ON public.reviews FOR SELECT
  USING (true);

CREATE POLICY "Eligible users can create reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (reviewer_id = auth.uid());

-- ============================================================================
-- 5. SUPABASE STORAGE BUCKETS & POLICIES
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('company-logos', 'company-logos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('resumes', 'resumes', false, 10485760, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('verification-documents', 'verification-documents', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "Public read access for avatars and logos"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('avatars', 'company-logos'));

CREATE POLICY "Authenticated users can upload own avatar or logo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('avatars', 'company-logos')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Workers can upload own resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Authorized access to private resumes"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'resumes'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.applications a
        JOIN public.jobs j ON j.id = a.job_id
        JOIN public.companies c ON c.id = j.company_id
        WHERE a.worker_id::text = (storage.foldername(name))[1]
          AND c.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can upload own verification documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Only owner and admin can read verification documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'verification-documents'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_admin()
    )
  );
