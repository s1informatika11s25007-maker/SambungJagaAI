-- ==============================================================================
-- SambungJaga AI — Autonomous HRIS & Employee Management Tables
-- Migration: 20261103120000_hris_autonomous_schema.sql
-- ==============================================================================

-- 1. HR Employees View & Alias Table
CREATE OR REPLACE VIEW public.hr_employees WITH (security_invoker = true) AS
  SELECT id, user_id, full_name, role, shift_status, attendance_status, competencies, certifications, shift_start, shift_end, is_active, is_demo_login, phone_number, facility_id, sys_created_at, created_at, updated_at
  FROM hr_domain.staff_profiles;

-- 2. Shift Assignments Table
CREATE TABLE IF NOT EXISTS hr_domain.shift_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    roster_id UUID REFERENCES hr_domain.shift_rosters(id) ON DELETE CASCADE,
    staff_id TEXT NOT NULL,
    staff_name TEXT NOT NULL,
    shift_name TEXT NOT NULL DEFAULT 'pagi',
    assigned_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'assigned',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Staff Credentials Table
CREATE TABLE IF NOT EXISTS hr_domain.staff_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    staff_id TEXT NOT NULL,
    credential_name TEXT NOT NULL,
    issued_by TEXT,
    issued_date DATE,
    expiration_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'valid',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Training Records Table
CREATE TABLE IF NOT EXISTS hr_domain.training_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    staff_id TEXT NOT NULL,
    course_name TEXT NOT NULL,
    provider TEXT,
    completion_date DATE,
    score INT DEFAULT 100,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Employee Documents Table
CREATE TABLE IF NOT EXISTS hr_domain.employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    staff_id TEXT NOT NULL,
    document_type TEXT NOT NULL,
    document_name TEXT NOT NULL,
    storage_url TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Employee Events Table (Onboarding / Offboarding / Transfer)
CREATE TABLE IF NOT EXISTS hr_domain.employee_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    staff_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Staffing Forecasts Table
CREATE TABLE IF NOT EXISTS hr_domain.staffing_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    forecast_date DATE NOT NULL,
    projected_resident_count INT NOT NULL,
    required_caregivers INT NOT NULL,
    available_caregivers INT NOT NULL,
    shortage_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PUBLIC VIEWS WITH SECURITY INVOKER
CREATE OR REPLACE VIEW public.shift_assignments WITH (security_invoker = true) AS SELECT * FROM hr_domain.shift_assignments;
CREATE OR REPLACE VIEW public.staff_credentials WITH (security_invoker = true) AS SELECT * FROM hr_domain.staff_credentials;
CREATE OR REPLACE VIEW public.training_records WITH (security_invoker = true) AS SELECT * FROM hr_domain.training_records;
CREATE OR REPLACE VIEW public.employee_documents WITH (security_invoker = true) AS SELECT * FROM hr_domain.employee_documents;
CREATE OR REPLACE VIEW public.employee_events WITH (security_invoker = true) AS SELECT * FROM hr_domain.employee_events;
CREATE OR REPLACE VIEW public.staffing_forecasts WITH (security_invoker = true) AS SELECT * FROM hr_domain.staffing_forecasts;
CREATE OR REPLACE VIEW public.attendance_records WITH (security_invoker = true) AS SELECT * FROM hr_domain.staff_attendance;

-- PERMISSIONS
GRANT SELECT ON public.hr_employees TO authenticated;
GRANT SELECT ON public.shift_assignments TO authenticated;
GRANT SELECT ON public.staff_credentials TO authenticated;
GRANT SELECT ON public.training_records TO authenticated;
GRANT SELECT ON public.employee_documents TO authenticated;
GRANT SELECT ON public.employee_events TO authenticated;
GRANT SELECT ON public.staffing_forecasts TO authenticated;
GRANT SELECT ON public.attendance_records TO authenticated;
