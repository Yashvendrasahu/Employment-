# Memployment — Industrial & Skilled Workforce Marketplace

> **Tagline:** Find Work. Hire Faster. Build Better Opportunities.

## 1. Project Overview

**Memployment** is a production-oriented full-stack employment marketplace and workforce management platform built specifically for blue-collar, industrial, construction, logistics, factory, and skilled-trade employment. It connects three distinct user roles through a single verified ecosystem:

1. **Workers / Job Seekers** — Discover verified factory and contractor jobs, match by trade skills and location, manage resumes, apply directly, bookmark openings, and track application progression (`Pending → Reviewing → Shortlisted → Accepted / Rejected`).
2. **Companies / Factories / Contractors** — Create employer profiles, submit GST/Factory registration documents for verification, publish and manage job openings, inspect applicant profiles and private resumes, shortlist candidates, and update application statuses.
3. **Platform Administrators** — Govern platform security, manage registered users, verify worker and company credentials, moderate job listings, monitor applications, and export workforce reports.

---

## 2. Technologies Used

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, React Router v7, Lucide React icons
- **Backend Runtime:** Node.js + Express full-stack API server (`server.ts`) with Vite middleware
- **Database & Auth Architecture:**
  - **Supabase Integration:** Official `@supabase/supabase-js` client & server SDK (`src/lib/supabase/client.ts` & `src/lib/supabase/server.ts`) + complete PostgreSQL schema, triggers, indexes, Row Level Security (RLS) policies, and Storage bucket policies in `supabase/schema.sql`.
  - **Embedded SQL Relational Engine:** Automatic relational SQL persistence (`better-sqlite3` in `src/server/database.ts`) mirroring all 9 PostgreSQL tables, foreign keys, unique constraints, and indexes when Supabase environment variables are not yet populated in `.env`.

---

## 3. Installation Steps

```bash
# 1. Install all dependencies
npm install

# 2. Copy the example environment file
cp .env.example .env
```

---

## 4. Required Environment Variables

Configure the following variables in `.env` (see `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-secret-key

# Optional Vite alias (vite.config.ts natively supports both NEXT_PUBLIC_ and VITE_ prefixes)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-public-key

# Server-only secret for administrative bootstrap operations
ADMIN_BOOTSTRAP_SECRET=your-strong-server-secret
```

> **Security Rule:** `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_BOOTSTRAP_SECRET` are strictly server-only and are never exposed to client-side bundles.

---

## 5. Supabase Project Creation

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and click **New Project**.
2. Choose your organization, enter **Memployment** as the project name, generate a strong database password, and select the closest region.
3. Once provisioned, navigate to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY`

---

## 6. How to Execute Database Schema

1. Open your Supabase Dashboard and navigate to **SQL Editor**.
2. Click **New Query**.
3. Copy the entire contents of [`supabase/schema.sql`](./supabase/schema.sql) and paste it into the SQL Editor.
4. Click **Run**. This creates:
   - All 9 tables: `profiles`, `worker_profiles`, `companies`, `jobs`, `applications`, `saved_jobs`, `notifications`, `verification_requests`, and `reviews`.
   - Unique constraints (`uq_applications_job_worker`, `uq_saved_jobs_worker_job`, `uq_reviews_relationship`).
   - Database indexes for `category`, `city`, `status`, `company_id`, `worker_id`, and `job_id`.
   - Security triggers preventing privilege escalation and blocking public admin registration.
   - Row Level Security (RLS) policies on all tables.

---

## 7. How to Configure Storage Buckets

Executing `supabase/schema.sql` automatically provisions the four required storage buckets and their RLS policies:

- `avatars` (Public read, authenticated owner upload, max 5MB, `image/jpeg`, `image/png`, `image/webp`)
- `company-logos` (Public read, authenticated owner upload, max 5MB, `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`)
- `resumes` (**Private bucket**, max 10MB, PDF/DOC/DOCX — accessible only to the owning worker, companies reviewing that worker's application, and verified admins)
- `verification-documents` (**Private bucket**, max 10MB, PDF/JPG/PNG — accessible only to the submitting user and verified admins)

---

## 8. How to Configure Authentication

1. In Supabase Dashboard, open **Authentication → Providers → Email**.
2. Ensure **Enable Email Provider** is turned ON.
3. Under **Authentication → URL Configuration**, set your Site URL (e.g., `http://localhost:3000` in development or your production deployment URL).

---

## 9. How to Create the First Admin Securely

Public registration (`POST /api/auth/signup` and PostgreSQL trigger `trg_prevent_public_admin_insert`) strictly blocks any user from signing up as `admin` or escalating their role via profile updates.

- **In Supabase SQL Editor (using `service_role` / Postgres admin):**
  After creating the user in **Authentication → Users**, promote their profile record using:
  ```sql
  INSERT INTO public.profiles (id, full_name, email, phone, role, is_verified, account_status)
  VALUES ('<AUTH_USER_UUID>', 'Platform Administrator', 'admin@memployment.in', '+91 98200 11000', 'admin', true, 'active')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', is_verified = true, account_status = 'active';
  ```
- **In Local / Preview Development:**
  The server bootstrap (`src/server/database.ts`) automatically provisions a verified administrator account (`admin@memployment.in` / `Admin@1234`), a verified Worker (`rajesh.kumar@memployment.in` / `Worker@1234`), and a verified Company (`hr@apexmanufacturing.in` / `Company@1234`) so all three role portals can be tested immediately.

---

## 10. How to Run the Development Server

```bash
npm run dev
```

The full-stack Express + Vite application starts on `http://localhost:3000`.

---

## 11. How to Build and Deploy the Application

```bash
# Type-check the codebase
npm run lint

# Build the production frontend bundle into dist/
npm run build

# Start the production full-stack server
npm run start
```
