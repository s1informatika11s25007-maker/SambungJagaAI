-- ==============================================================================
-- SAMBUNGJAGA AI — MIGRATION 20261103180000: STRICT HR RLS POLICIES
-- Removes all permissive open policies on hr_domain.shift_rosters, staff_attendance,
-- and leave_requests. Enforces fail-closed multi-tenant facility_id and role restrictions.
-- ==============================================================================

-- DROP ALL PERMISSIVE OPEN POLICIES
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

-- REVOKE ALL ANONYMOUS ACCESS
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
    staff_id::text = COALESCE((SELECT p.id::text FROM hr_domain.staff_profiles p WHERE p.user_id = auth.uid()), '')
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
    staff_id::text = COALESCE((SELECT p.id::text FROM hr_domain.staff_profiles p WHERE p.user_id = auth.uid()), '')
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
    staff_id::text = COALESCE((SELECT p.id::text FROM hr_domain.staff_profiles p WHERE p.user_id = auth.uid()), '')
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
