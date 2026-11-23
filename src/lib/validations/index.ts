export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+\d][\d\s-]{7,18}$/;

export function validateEmail(email: string): ValidationResult {
  const trimmed = (email || '').trim();
  if (!trimmed) return { valid: false, error: 'Email address is required.' };
  if (!EMAIL_REGEX.test(trimmed)) return { valid: false, error: 'Please enter a valid email address.' };
  return { valid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (!password) return { valid: false, error: 'Password is required.' };
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return { valid: false, error: 'Password must include both letters and numbers.' };
  }
  return { valid: true };
}

export function validateWorkerSignup(data: {
  full_name?: string;
  email?: string;
  phone?: string;
  password?: string;
  city?: string;
  state?: string;
}): ValidationResult {
  if (!data.full_name || data.full_name.trim().length < 2) {
    return { valid: false, error: 'Full name must be at least 2 characters.' };
  }
  const emailCheck = validateEmail(data.email || '');
  if (!emailCheck.valid) return emailCheck;
  if (!data.phone || !PHONE_REGEX.test(data.phone.trim())) {
    return { valid: false, error: 'Please provide a valid contact phone number.' };
  }
  const passCheck = validatePassword(data.password || '');
  if (!passCheck.valid) return passCheck;
  if (!data.city || data.city.trim().length < 2) {
    return { valid: false, error: 'City is required.' };
  }
  if (!data.state || data.state.trim().length < 2) {
    return { valid: false, error: 'State is required.' };
  }
  return { valid: true };
}

export function validateCompanySignup(data: {
  full_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  password?: string;
  industry?: string;
  city?: string;
  state?: string;
}): ValidationResult {
  if (!data.full_name || data.full_name.trim().length < 2) {
    return { valid: false, error: 'Owner / Representative full name is required.' };
  }
  if (!data.company_name || data.company_name.trim().length < 2) {
    return { valid: false, error: 'Company or contractor name is required.' };
  }
  const emailCheck = validateEmail(data.email || '');
  if (!emailCheck.valid) return emailCheck;
  if (!data.phone || !PHONE_REGEX.test(data.phone.trim())) {
    return { valid: false, error: 'Please provide a valid company phone number.' };
  }
  const passCheck = validatePassword(data.password || '');
  if (!passCheck.valid) return passCheck;
  if (!data.industry || data.industry.trim().length < 2) {
    return { valid: false, error: 'Industry category is required.' };
  }
  if (!data.city || data.city.trim().length < 2) {
    return { valid: false, error: 'City is required.' };
  }
  if (!data.state || data.state.trim().length < 2) {
    return { valid: false, error: 'State is required.' };
  }
  return { valid: true };
}

export function validateJobPayload(data: {
  title?: string;
  description?: string;
  responsibilities?: string;
  requirements?: string;
  category?: string;
  employment_type?: string;
  experience_required?: number;
  salary_min?: number;
  salary_max?: number;
  vacancies?: number;
  city?: string;
  state?: string;
  application_deadline?: string;
}): ValidationResult {
  if (!data.title || data.title.trim().length < 3) {
    return { valid: false, error: 'Job title must be at least 3 characters.' };
  }
  if (!data.category || !data.category.trim()) {
    return { valid: false, error: 'Job category is required.' };
  }
  if (!data.employment_type) {
    return { valid: false, error: 'Employment type is required.' };
  }
  if (!data.description || data.description.trim().length < 15) {
    return { valid: false, error: 'Job description must be at least 15 characters.' };
  }
  if (!data.responsibilities || data.responsibilities.trim().length < 10) {
    return { valid: false, error: 'Key responsibilities are required (min 10 characters).' };
  }
  if (!data.requirements || data.requirements.trim().length < 10) {
    return { valid: false, error: 'Candidate requirements are required (min 10 characters).' };
  }
  const minSal = Number(data.salary_min);
  const maxSal = Number(data.salary_max);
  if (isNaN(minSal) || minSal <= 0) {
    return { valid: false, error: 'Minimum salary must be greater than 0.' };
  }
  if (isNaN(maxSal) || maxSal < minSal) {
    return { valid: false, error: 'Maximum salary must be greater than or equal to minimum salary.' };
  }
  const vacancies = Number(data.vacancies);
  if (isNaN(vacancies) || vacancies < 1) {
    return { valid: false, error: 'Number of vacancies must be at least 1.' };
  }
  if (!data.city || !data.city.trim() || !data.state || !data.state.trim()) {
    return { valid: false, error: 'Job city and state are required.' };
  }
  if (!data.application_deadline) {
    return { valid: false, error: 'Application deadline date is required.' };
  }
  return { valid: true };
}

export type StorageBucketName = 'avatars' | 'company-logos' | 'resumes' | 'verification-documents';

export function validateFileUpload(
  bucket: StorageBucketName,
  mimeType: string,
  sizeBytes: number
): ValidationResult {
  const maxBytes = bucket === 'avatars' || bucket === 'company-logos' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
  if (sizeBytes <= 0) {
    return { valid: false, error: 'Selected file is empty.' };
  }
  if (sizeBytes > maxBytes) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of ${Math.round(maxBytes / (1024 * 1024))}MB.`,
    };
  }

  const allowedTypes: Record<StorageBucketName, string[]> = {
    avatars: ['image/jpeg', 'image/png', 'image/webp'],
    'company-logos': ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    resumes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    'verification-documents': ['application/pdf', 'image/jpeg', 'image/png'],
  };

  if (!allowedTypes[bucket].includes(mimeType)) {
    return {
      valid: false,
      error: `Unsupported file format (${mimeType}). Allowed: ${allowedTypes[bucket].join(', ')}`,
    };
  }

  return { valid: true };
}
