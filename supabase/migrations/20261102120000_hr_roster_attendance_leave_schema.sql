-- ==============================================================================
-- SAMBUNGJAGA AI — MIGRATION 20261102120000: HR PERSISTENT DOMAIN TABLES
-- Provides persistent database storage for shift rosters, staff attendance, and leave.
-- Strict Multi-Tenant, Action-Level, Role-Restricted Fail-Closed RLS Policies.
-- ==============================================================================

-- 1. Shift Rosters Table
CREATE TABLE IF NOT EXISTS hr_domain.shift_rosters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id VARCHAR(64) NOT NULL DEFAULT 'FAC-001',
  roster_date DATE NOT NULL,
  pagi JSONB NOT NULL DEFAULT '[]'::jsonb,
  siang JSONB NOT NULL DEFAULT '[]'::jsonb,
  malam JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'published',
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Staff Attendance Table
CREATE TABLE IF NOT EXISTS hr_domain.staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id VARCHAR(64) NOT NULL DEFAULT 'FAC-001',
  staff_id VARCHAR(128) NOT NULL,
  staff_name VARCHAR(255) NOT NULL,
  clock_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out_at TIMESTAMPTZ NULL,
  location JSONB NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'present',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Staff Leave Requests Table
CREATE TABLE IF NOT EXISTS hr_domain.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id VARCHAR(64) NOT NULL DEFAULT 'FAC-001',
  staff_id VARCHAR(128) NOT NULL,
  staff_name VARCHAR(255) NOT NULL,
  leave_type VARCHAR(64) NOT NULL DEFAULT 'ANNUAL',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shift_rosters_facility ON hr_domain.shift_rosters(facility_id, roster_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff ON hr_domain.staff_attendance(facility_id, staff_id, clock_in_at);
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff ON hr_domain.leave_requests(facility_id, staff_id);

-- Enable RLS
ALTER TABLE hr_domain.shift_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_domain.staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_domain.leave_requests ENABLE ROW LEVEL SECURITY;

-- DROP ALL PERMISSIVE OPEN POLICIES (FAIL-CLOSED SECURITY ENFORCEMENT)
DROP POLICY IF EXISTS "Permissive select for users on shift_rosters" ON hr_domain.shift_rosters;
DROP POLICY IF EXISTS "Permissive write for users on shift_rosters" ON hr_domain.shift_rosters;
DROP POLICY IF EXISTS "Tenant strict policy for shift_rosters_select" ON hr_domain.shift_rosters;
DROP POLICY IF EXISTS "Tenant strict policy for shift_rosters_write" ON hr_domain.shift_rosters;

DROP POLICY IF EXISTS "Permissive select for users on staff_attendance" ON hr_domain.staff_attendance;
DROP POLICY IF EXISTS "Permissive write for users on staff_attendance" ON hr_domain.staff_attendance;
DROP POLICY IF EXISTS "Tenant strict policy for staff_attendance_select" ON hr_domain.staff_attendance;
DROP POLICY IF EXISTS "Tenant strict policy for staff_attendance_insert" ON hr_domain.staff_attendance;
DROP POLICY IF EXISTS "Tenant strict policy for staff_attendance_update" ON hr_domain.staff_attendance;

DROP POLICY IF EXISTS "Permissive select for users on leave_requests" ON hr_domain.leave_requests;
DROP POLICY IF EXISTS "Permissive write for users on leave_requests" ON hr_domain.leave_requests;
DROP POLICY IF EXISTS "Tenant strict policy for leave_requests_select" ON hr_domain.leave_requests;
DROP POLICY IF EXISTS "Tenant strict policy for leave_requests_insert" ON hr_domain.leave_requests;
DROP POLICY IF EXISTS "Tenant strict policy for leave_requests_update" ON hr_domain.leave_requests;

-- REVOKE ALL ANONYMOUS ACCESS (NO UNAUTHENTICATED READ/WRITE TO HR DOMAIN)
REVOKE ALL ON hr_domain.shift_rosters FROM anon;
REVOKE ALL ON hr_domain.staff_attendance FROM anon;
REVOKE ALL ON hr_domain.leave_requests FROM anon;

-- A. SHIFT ROSTERS POLICIES
CREATE POLICY "Tenant strict policy for shift_rosters_select"
ON hr_domain.shift_rosters FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr')
);

CREATE POLICY "Tenant strict policy for shift_rosters_write"
ON hr_domain.shift_rosters FOR ALL TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('supervisor','admin_hr')
)
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('supervisor','admin_hr')
);

-- B. STAFF ATTENDANCE POLICIES
CREATE POLICY "Tenant strict policy for staff_attendance_select"
ON hr_domain.staff_attendance FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND (
    staff_id = (SELECT p.id FROM hr_domain.staff_profiles p WHERE p.user_id = auth.uid())
    OR public.current_sj_role() IN ('supervisor','admin_hr')
  )
);

CREATE POLICY "Tenant strict policy for staff_attendance_insert"
ON hr_domain.staff_attendance FOR INSERT TO authenticated
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr')
);

CREATE POLICY "Tenant strict policy for staff_attendance_update"
ON hr_domain.staff_attendance FOR UPDATE TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND (
    staff_id = (SELECT p.id FROM hr_domain.staff_profiles p WHERE p.user_id = auth.uid())
    OR public.current_sj_role() IN ('supervisor','admin_hr')
  )
)
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
);

-- C. LEAVE REQUESTS POLICIES (DECISIONS RESTRICTED TO AUTHORIZED HR / SUPERVISOR ROLE)
CREATE POLICY "Tenant strict policy for leave_requests_select"
ON hr_domain.leave_requests FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND (
    staff_id = (SELECT p.id FROM hr_domain.staff_profiles p WHERE p.user_id = auth.uid())
    OR public.current_sj_role() IN ('supervisor','admin_hr')
  )
);

CREATE POLICY "Tenant strict policy for leave_requests_insert"
ON hr_domain.leave_requests FOR INSERT TO authenticated
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr')
);

CREATE POLICY "Tenant strict policy for leave_requests_update"
ON hr_domain.leave_requests FOR UPDATE TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('supervisor','admin_hr')
)
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('supervisor','admin_hr')
);
