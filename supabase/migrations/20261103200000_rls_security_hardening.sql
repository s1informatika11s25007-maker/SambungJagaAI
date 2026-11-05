-- ==============================================================================
-- SAMBUNGJAGA AI — MIGRATION 20261103200000: RLS SECURITY HARDENING & FUNCTION REVOKE
-- 1. Hardens HRIS tables RLS and facility isolation
-- 2. Revokes public EXECUTE permissions on fn_claim_automation_jobs RPC
-- 3. Enables RLS & tenant policies on all messaging gateway tables
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDEN HRIS DOMAIN TABLES RLS
-- ------------------------------------------------------------------------------
ALTER TABLE hr_domain.shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_domain.staff_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_domain.training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_domain.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_domain.employee_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_domain.staffing_forecasts ENABLE ROW LEVEL SECURITY;

-- REVOKE ANON ACCESS TO HR DOMAIN
REVOKE ALL ON hr_domain.shift_assignments FROM anon;
REVOKE ALL ON hr_domain.staff_credentials FROM anon;
REVOKE ALL ON hr_domain.training_records FROM anon;
REVOKE ALL ON hr_domain.employee_documents FROM anon;
REVOKE ALL ON hr_domain.employee_events FROM anon;
REVOKE ALL ON hr_domain.staffing_forecasts FROM anon;

-- SHIFT ASSIGNMENTS POLICIES
DROP POLICY IF EXISTS "Tenant strict policy for shift_assignments_select" ON hr_domain.shift_assignments;
CREATE POLICY "Tenant strict policy for shift_assignments_select"
ON hr_domain.shift_assignments FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr')
);

DROP POLICY IF EXISTS "Tenant strict policy for shift_assignments_write" ON hr_domain.shift_assignments;
CREATE POLICY "Tenant strict policy for shift_assignments_write"
ON hr_domain.shift_assignments FOR ALL TO authenticated
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

-- EMPLOYEE DOCUMENTS POLICIES (MUTATIONS RESTRICTED TO AUTHORIZED HR / SUPERVISOR ROLE)
DROP POLICY IF EXISTS "Tenant strict policy for employee_documents_select" ON hr_domain.employee_documents;
CREATE POLICY "Tenant strict policy for employee_documents_select"
ON hr_domain.employee_documents FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND (
    staff_id::text = COALESCE((SELECT p.id::text FROM hr_domain.staff_profiles p WHERE p.user_id = auth.uid()), '')
    OR public.current_sj_role() IN ('supervisor','admin_hr')
  )
);

DROP POLICY IF EXISTS "Tenant strict policy for employee_documents_write" ON hr_domain.employee_documents;
CREATE POLICY "Tenant strict policy for employee_documents_write"
ON hr_domain.employee_documents FOR ALL TO authenticated
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

-- STAFF CREDENTIALS & TRAINING RECORDS POLICIES
DROP POLICY IF EXISTS "Tenant strict policy for staff_credentials_select" ON hr_domain.staff_credentials;
CREATE POLICY "Tenant strict policy for staff_credentials_select"
ON hr_domain.staff_credentials FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
);

DROP POLICY IF EXISTS "Tenant strict policy for training_records_select" ON hr_domain.training_records;
CREATE POLICY "Tenant strict policy for training_records_select"
ON hr_domain.training_records FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
);

-- EMPLOYEE EVENTS POLICIES
DROP POLICY IF EXISTS "Tenant strict policy for employee_events_select" ON hr_domain.employee_events;
CREATE POLICY "Tenant strict policy for employee_events_select"
ON hr_domain.employee_events FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('supervisor','admin_hr')
);

-- STAFFING FORECASTS POLICIES
DROP POLICY IF EXISTS "Tenant strict policy for staffing_forecasts_select" ON hr_domain.staffing_forecasts;
CREATE POLICY "Tenant strict policy for staffing_forecasts_select"
ON hr_domain.staffing_forecasts FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('supervisor','admin_hr')
);

-- ------------------------------------------------------------------------------
-- 2. REVOKE PUBLIC EXECUTE PRIVILEGES ON AUTOMATION QUEUE RPC
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.fn_claim_automation_jobs(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_claim_automation_jobs(TEXT, INT, INT) TO service_role;

-- ------------------------------------------------------------------------------
-- 3. HARDEN MESSAGING GATEWAY TABLES RLS
-- ------------------------------------------------------------------------------
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_webhook_events ENABLE ROW LEVEL SECURITY;

-- REVOKE ANON ACCESS TO MESSAGING GATEWAY
REVOKE ALL ON public.notification_outbox FROM anon;
REVOKE ALL ON public.notification_deliveries FROM anon;
REVOKE ALL ON public.notification_preferences FROM anon;
REVOKE ALL ON public.notification_templates FROM anon;
REVOKE ALL ON public.provider_webhook_events FROM anon;

-- A. NOTIFICATION OUTBOX
DROP POLICY IF EXISTS "Tenant strict policy for notification_outbox_select" ON public.notification_outbox;
CREATE POLICY "Tenant strict policy for notification_outbox_select"
ON public.notification_outbox FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND (
    recipient_user_id = auth.uid()
    OR public.current_sj_role() IN ('supervisor','admin_hr')
  )
);

DROP POLICY IF EXISTS "Tenant strict policy for notification_outbox_insert" ON public.notification_outbox;
CREATE POLICY "Tenant strict policy for notification_outbox_insert"
ON public.notification_outbox FOR INSERT TO authenticated
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
);

-- B. NOTIFICATION DELIVERIES
DROP POLICY IF EXISTS "Tenant strict policy for notification_deliveries_select" ON public.notification_deliveries;
CREATE POLICY "Tenant strict policy for notification_deliveries_select"
ON public.notification_deliveries FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND (
    recipient_user_id = auth.uid()
    OR public.current_sj_role() IN ('supervisor','admin_hr')
  )
);

-- C. NOTIFICATION PREFERENCES (USERS ONLY EDIT THEIR OWN)
DROP POLICY IF EXISTS "Tenant strict policy for notification_preferences_select" ON public.notification_preferences;
CREATE POLICY "Tenant strict policy for notification_preferences_select"
ON public.notification_preferences FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (public.current_sj_facility_id() IS NOT NULL AND facility_id = public.current_sj_facility_id() AND public.current_sj_role() IN ('supervisor','admin_hr'))
);

DROP POLICY IF EXISTS "Tenant strict policy for notification_preferences_update" ON public.notification_preferences;
CREATE POLICY "Tenant strict policy for notification_preferences_update"
ON public.notification_preferences FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- D. NOTIFICATION TEMPLATES (MUTATIONS RESTRICTED TO AUTHORIZED HR / SUPERVISOR ROLE)
DROP POLICY IF EXISTS "Tenant strict policy for notification_templates_select" ON public.notification_templates;
CREATE POLICY "Tenant strict policy for notification_templates_select"
ON public.notification_templates FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
);

DROP POLICY IF EXISTS "Tenant strict policy for notification_templates_write" ON public.notification_templates;
CREATE POLICY "Tenant strict policy for notification_templates_write"
ON public.notification_templates FOR ALL TO authenticated
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

-- E. PROVIDER WEBHOOK EVENTS (MUTATIONS RESTRICTED TO SERVICE ROLE / BACKEND ONLY)
DROP POLICY IF EXISTS "Tenant strict policy for provider_webhook_events_select" ON public.provider_webhook_events;
CREATE POLICY "Tenant strict policy for provider_webhook_events_select"
ON public.provider_webhook_events FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('supervisor','admin_hr')
);
