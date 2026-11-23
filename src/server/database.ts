import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORAGE_DIR = path.resolve(DATA_DIR, 'storage');
const DB_PATH = path.resolve(DATA_DIR, 'memployment.sqlite');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
for (const bucket of ['avatars', 'company-logos', 'resumes', 'verification-documents']) {
  const bucketDir = path.resolve(STORAGE_DIR, bucket);
  if (!fs.existsSync(bucketDir)) {
    fs.mkdirSync(bucketDir, { recursive: true });
  }
}

export const sqliteDb = new Database(DB_PATH);
sqliteDb.pragma('journal_mode = WAL');
sqliteDb.pragma('foreign_keys = ON');

const TOKEN_SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.ADMIN_BOOTSTRAP_SECRET ||
  'memployment-production-hmac-secret-key-2026';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derived, 'hex'));
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: 'worker' | 'company' | 'admin';
  exp: number;
}

export function createSessionToken(user: {
  id: string;
  email: string;
  role: 'worker' | 'company' | 'admin';
}): string {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(encoded)
      .digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function calculateWorkerProfileCompletion(params: {
  full_name?: string;
  phone?: string;
  city?: string;
  state?: string;
  avatar_url?: string | null;
  headline?: string;
  bio?: string;
  skills?: string[];
  experience_years?: number;
  education?: string;
  expected_salary?: number | null;
  preferred_location?: string;
  resume_url?: string | null;
}): number {
  let score = 0;
  if (params.full_name && params.full_name.trim().length >= 2) score += 10;
  if (params.phone && params.phone.trim().length >= 8) score += 10;
  if (params.city && params.state) score += 10;
  if (params.headline && params.headline.trim().length >= 5) score += 10;
  if (params.bio && params.bio.trim().length >= 15) score += 10;
  if (params.skills && params.skills.length >= 2) score += 15;
  if (params.education && params.education.trim().length >= 2) score += 10;
  if (params.preferred_location && params.preferred_location.trim().length >= 2) score += 5;
  if (params.expected_salary && params.expected_salary > 0) score += 5;
  if (params.resume_url) score += 15;
  return Math.min(100, score);
}

export function initializeDatabaseSchema() {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS auth_credentials (
      user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL CHECK (role IN ('worker', 'company', 'admin')),
      avatar_url TEXT,
      city TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT 'India',
      preferred_language TEXT NOT NULL DEFAULT 'English',
      is_verified INTEGER NOT NULL DEFAULT 0,
      account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'pending')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS worker_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
      headline TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      skills TEXT NOT NULL DEFAULT '[]',
      experience_years INTEGER NOT NULL DEFAULT 0,
      education TEXT NOT NULL DEFAULT '',
      employment_type TEXT NOT NULL DEFAULT 'Full-Time',
      expected_salary REAL,
      preferred_location TEXT NOT NULL DEFAULT '',
      availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'employed', 'notice_period', 'unavailable')),
      resume_url TEXT,
      profile_completion INTEGER NOT NULL DEFAULT 25,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
      company_name TEXT NOT NULL,
      logo_url TEXT,
      industry TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'India',
      verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      responsibilities TEXT NOT NULL,
      requirements TEXT NOT NULL,
      category TEXT NOT NULL,
      employment_type TEXT NOT NULL,
      experience_required INTEGER NOT NULL DEFAULT 0,
      salary_min REAL NOT NULL,
      salary_max REAL NOT NULL,
      salary_type TEXT NOT NULL DEFAULT 'monthly',
      vacancies INTEGER NOT NULL DEFAULT 1,
      skills_required TEXT NOT NULL DEFAULT '[]',
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'India',
      application_deadline TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'pending', 'published', 'closed', 'rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      worker_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      cover_letter TEXT NOT NULL DEFAULT '',
      resume_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'shortlisted', 'accepted', 'rejected')),
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (job_id, worker_id)
    );

    CREATE TABLE IF NOT EXISTS saved_jobs (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (worker_id, job_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'system',
      related_job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
      related_application_id TEXT REFERENCES applications(id) ON DELETE SET NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS verification_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      document_url TEXT NOT NULL,
      verification_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      admin_notes TEXT,
      reviewed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      reviewer_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      reviewed_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      review_text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (reviewer_id, reviewed_user_id, job_id)
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
    CREATE INDEX IF NOT EXISTS idx_jobs_city ON jobs(city);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
    CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
    CREATE INDEX IF NOT EXISTS idx_applications_worker_id ON applications(worker_id);
    CREATE INDEX IF NOT EXISTS idx_saved_jobs_worker_id ON saved_jobs(worker_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON verification_requests(user_id);
  `);

  seedInitialDatabaseIfNeeded();
}

function createSamplePdfFile(bucket: string, userId: string, filename: string, title: string) {
  const userFolder = path.resolve(STORAGE_DIR, bucket, userId);
  if (!fs.existsSync(userFolder)) {
    fs.mkdirSync(userFolder, { recursive: true });
  }
  const filePath = path.resolve(userFolder, filename);
  if (!fs.existsSync(filePath)) {
    const pdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 120 >> stream
BT /F1 16 Tf 50 720 Td (${title} - Memployment Verified Document) Tj ET
endstream endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000229 00000 n 
0000000297 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
468
%%EOF`;
    fs.writeFileSync(filePath, pdfContent, 'utf8');
  }
  return `/api/storage/${bucket}/${userId}/${filename}`;
}

function seedInitialDatabaseIfNeeded() {
  const existingCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM profiles').get() as {
    count: number;
  };
  if (existingCount.count > 0) return;

  const now = new Date().toISOString();

  // 1. Server-side Provisioned Admin Account
  const adminId = '00000000-0000-4000-a000-000000000001';
  // 2. Companies
  const compOwner1 = '00000000-0000-4000-b000-000000000001';
  const compOwner2 = '00000000-0000-4000-b000-000000000002';
  const compOwner3 = '00000000-0000-4000-b000-000000000003';
  const compId1 = '00000000-0000-4000-c000-000000000001';
  const compId2 = '00000000-0000-4000-c000-000000000002';
  const compId3 = '00000000-0000-4000-c000-000000000003';
  // 3. Workers
  const worker1 = '00000000-0000-4000-d000-000000000001';
  const worker2 = '00000000-0000-4000-d000-000000000002';
  const worker3 = '00000000-0000-4000-d000-000000000003';

  const insertAuth = sqliteDb.prepare(
    `INSERT INTO auth_credentials (user_id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
  );
  const insertProfile = sqliteDb.prepare(
    `INSERT INTO profiles (id, full_name, email, phone, role, avatar_url, city, state, country, preferred_language, is_verified, account_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // Admin
  insertAuth.run(adminId, 'admin@memployment.in', hashPassword('Admin@1234'), now, now);
  insertProfile.run(
    adminId,
    'Vikramaditya Rao (Platform Admin)',
    'admin@memployment.in',
    '+91 98200 11000',
    'admin',
    null,
    'Mumbai',
    'Maharashtra',
    'India',
    'English',
    1,
    'active',
    now,
    now
  );

  // Company 1: Apex Heavy Manufacturing Pvt. Ltd.
  insertAuth.run(compOwner1, 'hr@apexmanufacturing.in', hashPassword('Company@1234'), now, now);
  insertProfile.run(
    compOwner1,
    'Meera Deshpande',
    'hr@apexmanufacturing.in',
    '+91 98230 44510',
    'company',
    '/src/assets/images/company_apex_manufacturing_1794992917809.jpg',
    'Pune',
    'Maharashtra',
    'India',
    'English',
    1,
    'active',
    now,
    now
  );

  // Company 2: Titan Freight & Logistics Corp.
  insertAuth.run(compOwner2, 'talent@titanlogistics.in', hashPassword('Company@1234'), now, now);
  insertProfile.run(
    compOwner2,
    'Arjun Malhotra',
    'talent@titanlogistics.in',
    '+91 98111 77820',
    'company',
    '/src/assets/images/company_titan_logistics_1794992916920.jpg',
    'Gurugram',
    'Haryana',
    'India',
    'English',
    1,
    'active',
    now,
    now
  );

  // Company 3: Vishwakarma Civil & Structural Contractors
  insertAuth.run(compOwner3, 'contact@vishwakarmacivil.in', hashPassword('Company@1234'), now, now);
  insertProfile.run(
    compOwner3,
    'Devendra Sharma',
    'contact@vishwakarmacivil.in',
    '+91 97250 89100',
    'company',
    null,
    'Ahmedabad',
    'Gujarat',
    'India',
    'Hindi',
    0,
    'active',
    now,
    now
  );

  // Worker 1: Rajesh Kumar (Senior CNC & Welding Technician)
  insertAuth.run(worker1, 'rajesh.kumar@memployment.in', hashPassword('Worker@1234'), now, now);
  insertProfile.run(
    worker1,
    'Rajesh Kumar Verma',
    'rajesh.kumar@memployment.in',
    '+91 98901 23456',
    'worker',
    null,
    'Pune',
    'Maharashtra',
    'India',
    'Hindi & English',
    1,
    'active',
    now,
    now
  );

  // Worker 2: Suresh Patil (Industrial Electrician & PLC Specialist)
  insertAuth.run(worker2, 'suresh.patil@memployment.in', hashPassword('Worker@1234'), now, now);
  insertProfile.run(
    worker2,
    'Suresh Patil',
    'suresh.patil@memployment.in',
    '+91 97654 32109',
    'worker',
    null,
    'Chakan',
    'Maharashtra',
    'India',
    'Marathi & English',
    1,
    'active',
    now,
    now
  );

  // Worker 3: Anita Deshmukh (Warehouse & Forklift Supervisor)
  insertAuth.run(worker3, 'anita.deshmukh@memployment.in', hashPassword('Worker@1234'), now, now);
  insertProfile.run(
    worker3,
    'Anita Deshmukh',
    'anita.deshmukh@memployment.in',
    '+91 98104 56789',
    'worker',
    null,
    'Gurugram',
    'Haryana',
    'India',
    'English',
    0,
    'active',
    now,
    now
  );

  // Sample Resumes & Verification Docs
  const resume1Url = createSamplePdfFile(
    'resumes',
    worker1,
    'Rajesh_Kumar_CNC_Resume.pdf',
    'Rajesh Kumar Verma - Senior CNC Machinist & MIG Welder Resume'
  );
  const resume2Url = createSamplePdfFile(
    'resumes',
    worker2,
    'Suresh_Patil_Electrician_Resume.pdf',
    'Suresh Patil - Industrial Electrician & PLC Technician Resume'
  );
  const resume3Url = createSamplePdfFile(
    'resumes',
    worker3,
    'Anita_Deshmukh_Logistics_Resume.pdf',
    'Anita Deshmukh - Warehouse Operations & Forklift Lead Resume'
  );

  const insertWorkerProfile = sqliteDb.prepare(
    `INSERT INTO worker_profiles (id, user_id, headline, bio, skills, experience_years, education, employment_type, expected_salary, preferred_location, availability_status, resume_url, profile_completion, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertWorkerProfile.run(
    crypto.randomUUID(),
    worker1,
    'Senior CNC Turning & 5-Axis Milling Operator | ITI Machinist',
    'Over 6 years of hands-on precision machining experience in automotive and heavy engineering plants. Skilled in Fanuc/Siemens CNC controls, GD&T blueprint reading, micrometer calibration, and 5S shop-floor safety.',
    JSON.stringify([
      'CNC Machining',
      'Fanuc Controls',
      'Blueprint Reading',
      'GD&T',
      'MIG Welding',
      'Micrometer Inspection',
    ]),
    6,
    'ITI Diploma in Machinist Trade (NCVT Certified)',
    'Full-Time',
    38000,
    'Pune, Maharashtra',
    'available',
    resume1Url,
    100,
    now,
    now
  );

  insertWorkerProfile.run(
    crypto.randomUUID(),
    worker2,
    'Licensed Industrial Electrician & PLC Panel Wireman',
    '5 years maintaining HV/LV switchgear, VFD drives, 3-phase motors, and Siemens PLC automation panels in continuous-process manufacturing plants.',
    JSON.stringify([
      'Industrial Wiring',
      'PLC Troubleshooting',
      '3-Phase Motors',
      'Preventive Maintenance',
      'Electrical Safety',
    ]),
    5,
    'ITI Electrician + Govt. Wireman License',
    'Full-Time',
    35000,
    'Pune, Mumbai',
    'available',
    resume2Url,
    100,
    now,
    now
  );

  insertWorkerProfile.run(
    crypto.randomUUID(),
    worker3,
    'Certified Reach-Truck & Forklift Operator | Inventory Lead',
    '4 years operating electric reach trucks and 3-ton counterbalance forklifts in high-bay automated distribution centers with zero safety incidents.',
    JSON.stringify([
      'Forklift Operation',
      'Reach Truck',
      'WMS Scanner',
      'Inventory Control',
      'Loading Bay Safety',
    ]),
    4,
    'Higher Secondary (12th) + Forklift Operator Certification',
    'Shift-Based',
    28000,
    'Gurugram, Bhiwandi',
    'available',
    resume3Url,
    95,
    now,
    now
  );

  const insertCompany = sqliteDb.prepare(
    `INSERT INTO companies (id, owner_id, company_name, logo_url, industry, description, website, email, phone, city, state, country, verification_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertCompany.run(
    compId1,
    compOwner1,
    'Apex Heavy Manufacturing Pvt. Ltd.',
    '/src/assets/images/company_apex_manufacturing_1794992917809.jpg',
    'Manufacturing & Precision Engineering',
    'ISO 9001:2015 certified manufacturer of precision powertrain shafts, hydraulic valves, and CNC fabricated assemblies supplying Tier-1 OEM plants across Western India.',
    'https://apexmanufacturing.in',
    'hr@apexmanufacturing.in',
    '+91 98230 44510',
    'Pune',
    'Maharashtra',
    'India',
    'verified',
    now,
    now
  );

  insertCompany.run(
    compId2,
    compOwner2,
    'Titan Freight & Logistics Corp.',
    '/src/assets/images/company_titan_logistics_1794992916920.jpg',
    'Logistics, Warehousing & Supply Chain',
    'Operates 14 Grade-A automated fulfillment hubs and cold-chain distribution centers across NCR, Maharashtra, and Gujarat with 1,800+ full-time floor staff.',
    'https://titanlogistics.in',
    'talent@titanlogistics.in',
    '+91 98111 77820',
    'Gurugram',
    'Haryana',
    'India',
    'verified',
    now,
    now
  );

  insertCompany.run(
    compId3,
    compOwner3,
    'Vishwakarma Civil & Structural Contractors',
    null,
    'Construction & Infrastructure',
    'Turnkey industrial shed fabrication, pre-engineered steel buildings (PEB), and civil foundation contractors for manufacturing parks and metro rail corridors.',
    'https://vishwakarmacivil.in',
    'contact@vishwakarmacivil.in',
    '+91 97250 89100',
    'Ahmedabad',
    'Gujarat',
    'India',
    'pending',
    now,
    now
  );

  // Jobs
  const jobId1 = '00000000-0000-4000-e000-000000000001';
  const jobId2 = '00000000-0000-4000-e000-000000000002';
  const jobId3 = '00000000-0000-4000-e000-000000000003';
  const jobId4 = '00000000-0000-4000-e000-000000000004';
  const jobId5 = '00000000-0000-4000-e000-000000000005';
  const jobId6 = '00000000-0000-4000-e000-000000000006';

  const insertJob = sqliteDb.prepare(
    `INSERT INTO jobs (id, company_id, title, description, responsibilities, requirements, category, employment_type, experience_required, salary_min, salary_max, salary_type, vacancies, skills_required, city, state, country, application_deadline, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertJob.run(
    jobId1,
    compId1,
    'Senior CNC Turning & VMC Operator',
    'Apex Heavy Manufacturing is hiring experienced CNC Turning and VMC Machine Operators for our Chakan Phase-II production line. Includes subsidized canteen meals, overtime allowance at 2x statutory rate, ESIC/PF coverage, and annual performance bonus.',
    '• Set up and operate Fanuc and Siemens controlled CNC turning centers and 4-axis VMCs.\n• Inspect finished components using micrometers, vernier calipers, and bore gauges.\n• Maintain tool offset adjustments and log hourly production metrics.\n• Adhere strictly to shop-floor PPE and LOTO safety protocols.',
    '• ITI in Machinist / Turner / Fitter trade or Diploma in Mechanical Engineering.\n• Minimum 3 years experience on CNC Turning or VMC machines.\n• Ability to read engineering drawings and GD&T tolerances.',
    'CNC & Precision Machining',
    'Full-Time',
    3,
    32000,
    45000,
    'monthly',
    8,
    JSON.stringify(['CNC Machining', 'Fanuc Controls', 'Blueprint Reading', 'GD&T', 'Micrometer Inspection']),
    'Pune',
    'Maharashtra',
    'India',
    '2027-03-31',
    'published',
    now,
    now
  );

  insertJob.run(
    jobId2,
    compId1,
    'Industrial Maintenance Electrician (HV/LV & PLC)',
    'Join our plant engineering team to oversee electrical uptime for robotic welding cells, overhead EOT cranes, and CNC machining lines.',
    '• Perform preventive and breakdown maintenance on 415V 3-phase panels, VFDs, and induction motors.\n• Troubleshoot Siemens S7-1200 PLC I/O modules, sensors, and relay logic circuits.\n• Maintain transformer yard logs and earth-pit testing compliance.',
    '• ITI Electrician with valid State Government Wireman / Supervisor License.\n• 3+ years industrial factory maintenance experience.\n• Strong knowledge of LOTO and electrical panel schematics.',
    'Electrical & Maintenance',
    'Full-Time',
    3,
    30000,
    42000,
    'monthly',
    4,
    JSON.stringify(['Industrial Wiring', 'PLC Troubleshooting', '3-Phase Motors', 'Preventive Maintenance', 'Electrical Safety']),
    'Pune',
    'Maharashtra',
    'India',
    '2027-03-20',
    'published',
    now,
    now
  );

  insertJob.run(
    jobId3,
    compId1,
    'Certified MIG / TIG Structural Welder (6G Position)',
    'Immediate openings for qualified structural and pressure-vessel welders in our Heavy Fabrication Division.',
    '• Execute precision MIG (GMAW) and TIG (GTAW) welding on carbon steel and stainless steel sub-assemblies.\n• Prepare weld joints, pre-heat heavy plates, and ensure zero-defect ultrasonic/X-ray weld quality.\n• Follow WPS (Welding Procedure Specification) parameters accurately.',
    '• ITI Welder certification; 3G/6G certification preferred.\n• 2+ years fabrication shop experience.\n• Ability to interpret weld symbols on structural blueprints.',
    'Welding & Fabrication',
    'Full-Time',
    2,
    28000,
    39000,
    'monthly',
    12,
    JSON.stringify(['MIG Welding', 'TIG Welding', 'Blueprint Reading', 'Fabrication', 'Safety Compliance']),
    'Pune',
    'Maharashtra',
    'India',
    '2027-04-15',
    'published',
    now,
    now
  );

  insertJob.run(
    jobId4,
    compId2,
    'Certified Electric Reach-Truck & Forklift Operator',
    'Titan Freight & Logistics is recruiting licensed MHE (Material Handling Equipment) operators for our 400,000 sq.ft. Bilaspur Grade-A fulfillment hub.',
    '• Operate electric reach trucks (up to 11m height) and 3-ton counterbalance forklifts safely.\n• Perform daily pre-shift battery, hydraulic, and brake inspections.\n• Scan pallet barcodes using RF/WMS handheld terminals for put-away and dispatch.',
    '• Valid LMV / Forklift Operator certification.\n• Minimum 2 years warehouse MHE experience.\n• Willingness to work rotational 8-hour shifts (transport & shift allowance provided).',
    'Logistics & Warehouse',
    'Shift-Based',
    2,
    24000,
    32000,
    'monthly',
    15,
    JSON.stringify(['Forklift Operation', 'Reach Truck', 'WMS Scanner', 'Loading Bay Safety', 'Inventory Control']),
    'Gurugram',
    'Haryana',
    'India',
    '2027-03-25',
    'published',
    now,
    now
  );

  insertJob.run(
    jobId5,
    compId2,
    'Warehouse Dispatch & Linehaul Bay Supervisor',
    'Lead a 25-member loading bay and dispatch sorting crew at our regional hub.',
    '• Coordinate inbound and outbound container dock scheduling and e-Way bill verification.\n• Supervise barcode scanning accuracy, pallet shrink-wrapping, and FIFO inventory movement.\n• Conduct daily 10-minute toolbox safety briefings.',
    '• 12th Pass or Graduate with 3+ years logistics/warehouse floor supervision.\n• Proficiency with handheld WMS scanners and basic Excel reporting.',
    'Logistics & Warehouse',
    'Full-Time',
    3,
    30000,
    38000,
    'monthly',
    5,
    JSON.stringify(['Inventory Control', 'WMS Scanner', 'Dispatch Operations', 'Team Supervision', 'Loading Bay Safety']),
    'Gurugram',
    'Haryana',
    'India',
    '2027-04-10',
    'published',
    now,
    now
  );

  insertJob.run(
    jobId6,
    compId3,
    'Heavy Tower Crane & Rigging Foreperson (PEB Industrial Sheds)',
    'Seeking experienced structural steel erection and rigging supervisors for our Sanand industrial park project.',
    '• Supervise lifting and bolting of pre-engineered steel rafters, columns, and gantry girders.\n• Inspect wire ropes, D-shackles, and crane outrigger stability prior to critical lifts.\n• Enforce height-safety harness compliance for erection crews.',
    '• 4+ years experience in PEB structural erection and heavy rigging.\n• Sound knowledge of lift plans and crane hand/radio signaling.',
    'Construction & Civil',
    'Contract',
    4,
    36000,
    48000,
    'monthly',
    6,
    JSON.stringify(['Structural Rigging', 'Crane Signaling', 'Height Safety', 'Blueprint Reading']),
    'Ahmedabad',
    'Gujarat',
    'India',
    '2027-04-20',
    'pending',
    now,
    now
  );

  // Applications
  const appId1 = '00000000-0000-4000-f000-000000000001';
  const appId2 = '00000000-0000-4000-f000-000000000002';
  const appId3 = '00000000-0000-4000-f000-000000000003';

  const insertApplication = sqliteDb.prepare(
    `INSERT INTO applications (id, job_id, worker_id, cover_letter, resume_url, status, applied_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertApplication.run(
    appId1,
    jobId1,
    worker1,
    'I have 6 years of experience operating Fanuc CNC turning centers and 4-axis VMCs in Pune automotive plants. I am immediately available for an on-floor trade test at Chakan Phase-II.',
    resume1Url,
    'shortlisted',
    now,
    now
  );

  insertApplication.run(
    appId2,
    jobId2,
    worker2,
    'I hold a Maharashtra Govt. Wireman License with 5 years of factory maintenance experience on 415V switchgear, VFDs, and Siemens S7-1200 PLCs.',
    resume2Url,
    'accepted',
    now,
    now
  );

  insertApplication.run(
    appId3,
    jobId4,
    worker3,
    'Certified Reach-Truck and 3-ton Counterbalance Forklift operator with 4 years of zero-incident experience in Gurugram high-bay fulfillment centers.',
    resume3Url,
    'reviewing',
    now,
    now
  );

  // Saved Jobs
  sqliteDb
    .prepare(`INSERT INTO saved_jobs (id, worker_id, job_id, created_at) VALUES (?, ?, ?, ?)`)
    .run(crypto.randomUUID(), worker1, jobId3, now);

  // Verification Requests
  const verDoc1 = createSamplePdfFile(
    'verification-documents',
    compOwner3,
    'Vishwakarma_Factory_Registration.pdf',
    'Vishwakarma Civil Contractors - GST & Labour License Certificate'
  );
  const verDoc2 = createSamplePdfFile(
    'verification-documents',
    worker3,
    'Anita_Forklift_License.pdf',
    'Anita Deshmukh - Certified Forklift & MHE Operator License'
  );

  const insertVerification = sqliteDb.prepare(
    `INSERT INTO verification_requests (id, user_id, document_url, verification_type, status, admin_notes, reviewed_by, reviewed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertVerification.run(
    crypto.randomUUID(),
    compOwner3,
    verDoc1,
    'company_registration',
    'pending',
    'Awaiting GSTIN and BOCW contractor registration review.',
    null,
    null,
    now
  );

  insertVerification.run(
    crypto.randomUUID(),
    worker3,
    verDoc2,
    'trade_certificate',
    'pending',
    'Submitted MHE & Reach-Truck operator license for verification.',
    null,
    null,
    now
  );

  // Notifications
  const insertNotification = sqliteDb.prepare(
    `INSERT INTO notifications (id, user_id, title, message, type, related_job_id, related_application_id, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertNotification.run(
    crypto.randomUUID(),
    worker1,
    'Application Shortlisted: Senior CNC Turning & VMC Operator',
    'Apex Heavy Manufacturing Pvt. Ltd. has shortlisted your application and invited you for a shop-floor trade assessment.',
    'application_status',
    jobId1,
    appId1,
    0,
    now
  );

  insertNotification.run(
    crypto.randomUUID(),
    compOwner1,
    'New Candidate Application Received',
    'Rajesh Kumar Verma applied for Senior CNC Turning & VMC Operator (100% skill match).',
    'application_submitted',
    jobId1,
    appId1,
    0,
    now
  );

  insertNotification.run(
    crypto.randomUUID(),
    adminId,
    '2 Pending Verification Requests',
    'Vishwakarma Civil Contractors and Anita Deshmukh have submitted verification documents for review.',
    'verification',
    null,
    null,
    0,
    now
  );

  // Genuine Verified Placement Reviews (only for real database records)
  const insertReview = sqliteDb.prepare(
    `INSERT INTO reviews (id, reviewer_id, reviewed_user_id, job_id, rating, review_text, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  insertReview.run(
    crypto.randomUUID(),
    worker2,
    compOwner1,
    jobId2,
    5,
    'Joined Apex Heavy Manufacturing as an Industrial Maintenance Electrician through Memployment. No middleman deductions, direct company payroll with PF/ESIC from Day 1, and transparent trade test process.',
    now
  );

  insertReview.run(
    crypto.randomUUID(),
    compOwner1,
    worker2,
    jobId2,
    5,
    'Hired Suresh Patil for our Chakan plant electrical team within 5 days of posting. Verified ITI credentials and hands-on Siemens PLC troubleshooting reduced our line downtime by 32%.',
    now
  );
}
