export type UserRole = 'worker' | 'company' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'pending';
export type AvailabilityStatus = 'available' | 'employed' | 'notice_period' | 'unavailable';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type JobStatus = 'draft' | 'pending' | 'published' | 'closed' | 'rejected';
export type EmploymentType = 'Full-Time' | 'Contract' | 'Shift-Based' | 'Daily Wage' | 'Apprenticeship';
export type SalaryType = 'monthly' | 'daily' | 'hourly' | 'yearly';
export type ApplicationStatus = 'pending' | 'reviewing' | 'shortlisted' | 'accepted' | 'rejected';
export type VerificationType = 'worker_identity' | 'trade_certificate' | 'company_registration' | 'factory_license';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar_url: string | null;
  city: string;
  state: string;
  country: string;
  preferred_language: string;
  is_verified: boolean;
  account_status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface WorkerProfile {
  id: string;
  user_id: string;
  headline: string;
  bio: string;
  skills: string[];
  experience_years: number;
  education: string;
  employment_type: EmploymentType;
  expected_salary: number | null;
  preferred_location: string;
  availability_status: AvailabilityStatus;
  resume_url: string | null;
  profile_completion: number;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  owner_id: string;
  company_name: string;
  logo_url: string | null;
  industry: string;
  description: string;
  website: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  company_id: string;
  title: string;
  description: string;
  responsibilities: string;
  requirements: string;
  category: string;
  employment_type: EmploymentType;
  experience_required: number;
  salary_min: number;
  salary_max: number;
  salary_type: SalaryType;
  vacancies: number;
  skills_required: string[];
  city: string;
  state: string;
  country: string;
  application_deadline: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  // Joined fields
  company_name?: string;
  company_logo?: string | null;
  company_industry?: string;
  company_verified?: VerificationStatus;
  applications_count?: number;
  match_score?: number;
  matched_skills?: string[];
}

export interface Application {
  id: string;
  job_id: string;
  worker_id: string;
  cover_letter: string;
  resume_url: string | null;
  status: ApplicationStatus;
  applied_at: string;
  updated_at: string;
  // Joined fields for Worker view
  job_title?: string;
  job_city?: string;
  job_state?: string;
  job_employment_type?: EmploymentType;
  job_salary_min?: number;
  job_salary_max?: number;
  job_salary_type?: SalaryType;
  company_id?: string;
  company_name?: string;
  company_logo?: string | null;
  // Joined fields for Company / Admin view
  worker_name?: string;
  worker_email?: string;
  worker_phone?: string;
  worker_city?: string;
  worker_state?: string;
  worker_avatar?: string | null;
  worker_verified?: boolean;
  worker_headline?: string;
  worker_skills?: string[];
  worker_experience_years?: number;
  worker_education?: string;
  worker_availability?: AvailabilityStatus;
  worker_profile_resume?: string | null;
}

export interface SavedJob {
  id: string;
  worker_id: string;
  job_id: string;
  created_at: string;
  job?: Job;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'application_submitted' | 'application_status' | 'job_moderation' | 'verification' | 'system';
  related_job_id: string | null;
  related_application_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface VerificationRequest {
  id: string;
  user_id: string;
  document_url: string;
  verification_type: VerificationType;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  // Joined user/company info
  user_name?: string;
  user_email?: string;
  user_role?: UserRole;
  user_city?: string;
  company_name?: string;
}

export interface Review {
  id: string;
  reviewer_id: string;
  reviewed_user_id: string;
  job_id: string;
  rating: number;
  review_text: string;
  created_at: string;
  reviewer_name?: string;
  reviewer_role?: UserRole;
  reviewer_city?: string;
  reviewed_name?: string;
  job_title?: string;
  company_name?: string;
}

export interface PlatformStats {
  total_jobs: number;
  published_jobs: number;
  verified_companies: number;
  total_companies: number;
  total_workers: number;
  total_users: number;
  total_applications: number;
  accepted_placements: number;
  pending_verifications: number;
  categories: { category: string; count: number }[];
}
