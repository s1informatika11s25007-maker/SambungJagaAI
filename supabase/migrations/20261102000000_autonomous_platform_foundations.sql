-- ==============================================================================
-- SambungJaga AI — Autonomous Care Continuity Platform Foundations
-- Migration: 20261102000000_autonomous_platform_foundations.sql
-- ==============================================================================

-- 0. HELPER ROLE & MULTI-TENANT FACILITY FUNCTIONS
CREATE OR REPLACE FUNCTION public.current_sj_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(
    (SELECT p.role::text FROM hr_domain.staff_profiles p WHERE p.user_id = auth.uid()),
    'family'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_sj_facility_id()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(
    (SELECT p.facility_id FROM hr_domain.staff_profiles p WHERE p.user_id = auth.uid() LIMIT 1),
    (SELECT r.facility_id FROM resident_domain.residents r WHERE r.id IN (
      SELECT f.resident_id FROM public.family_visit_requests f WHERE f.family_user_id = auth.uid()
    ) LIMIT 1),
    'FAC-001'
  );
$$;

-- 1. ADD FACILITY_ID MULTI-TENANT COLUMN TO ALL BASE DOMAIN TABLES
ALTER TABLE IF EXISTS resident_domain.residents ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS hr_domain.staff_profiles ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS kernel_domain.bitemporal_obligations ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS kernel_domain.epistemic_facts ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS kernel_domain.handover_contracts ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS kernel_domain.evidence_verifications ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS audit_domain.audit_trail ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS kernel_domain.agent_execution_logs ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';

-- 2. ADD MISSING COLUMNS FOR WORKFORCE, EVIDENCE, & OBLIGATION SCHEMA
ALTER TABLE IF EXISTS hr_domain.staff_profiles
    ADD COLUMN IF NOT EXISTS attendance_status TEXT NOT NULL DEFAULT 'present',
    ADD COLUMN IF NOT EXISTS certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS shift_start TEXT DEFAULT '07:00',
    ADD COLUMN IF NOT EXISTS shift_end TEXT DEFAULT '15:00',
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE IF EXISTS resident_domain.residents
    ADD COLUMN IF NOT EXISTS care_level TEXT NOT NULL DEFAULT 'partial_care';

ALTER TABLE IF EXISTS kernel_domain.bitemporal_obligations
    ADD COLUMN IF NOT EXISTS estimated_duration_minutes INT NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS evidence_submitted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS required_competencies JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS kernel_domain.evidence_verifications
    ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    ADD COLUMN IF NOT EXISTS verifier_notes TEXT,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE IF EXISTS kernel_domain.handover_contracts
    ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS escalated_reason TEXT;

-- 3. RECREATE PUBLIC VIEWS TO EXPOSE ALL COLUMNS (EXPLICIT AND COMPLETE) WITH SECURITY INVOKER
CREATE OR REPLACE VIEW public.residents WITH (security_invoker = true) AS
  SELECT id, full_name, room_number, care_level, status, facility_id, sys_created_at
  FROM resident_domain.residents;

CREATE OR REPLACE VIEW public.staff_profiles WITH (security_invoker = true) AS
  SELECT id, user_id, full_name, role, shift_status, attendance_status, competencies, certifications, shift_start, shift_end, is_active, facility_id, sys_created_at
  FROM hr_domain.staff_profiles;

CREATE OR REPLACE VIEW public.bitemporal_obligations WITH (security_invoker = true) AS
  SELECT id, mission_id, resident_id, title, description, priority, status, valid_from, valid_until, required_evidence_grade, assigned_caregiver_id, estimated_duration_minutes, evidence_submitted, required_competencies, requires_human_review, facility_id, sys_created_at
  FROM kernel_domain.bitemporal_obligations;

CREATE OR REPLACE VIEW public.epistemic_facts WITH (security_invoker = true) AS
  SELECT id, resident_id, fact_key, fact_value, status, confidence_score, source_type, source_actor_id, provenance_chain, observed_at, facility_id, sys_created_at
  FROM kernel_domain.epistemic_facts;

CREATE OR REPLACE VIEW public.handover_contracts WITH (security_invoker = true) AS
  SELECT id, outgoing_staff_id, incoming_staff_id, shift_name, open_obligations_summary, competency_gaps_identified, outgoing_signed_at, incoming_signed_at, contract_status, escalated_at, escalated_reason, facility_id, sys_created_at
  FROM kernel_domain.handover_contracts;

CREATE OR REPLACE VIEW public.evidence_verifications WITH (security_invoker = true) AS
  SELECT id, obligation_id, submitter_id, evidence_grade, evidence_payload, verifier_status, is_spot_challenged, verifier_notes, rejection_reason, facility_id, sys_created_at
  FROM kernel_domain.evidence_verifications;

CREATE OR REPLACE VIEW public.audit_trail WITH (security_invoker = true) AS
  SELECT id, actor_id, gateway_tag, action_name, payload, prev_entry_hash, entry_hash, facility_id, timestamp
  FROM audit_domain.audit_trail;

CREATE OR REPLACE VIEW public.agent_execution_logs WITH (security_invoker = true) AS
  SELECT id, mission_id, agent_name, model_used, status, input_payload, output_payload, facility_id, created_at
  FROM kernel_domain.agent_execution_logs;

GRANT SELECT, INSERT ON kernel_domain.agent_execution_logs TO authenticated;
GRANT SELECT, INSERT ON public.agent_execution_logs TO authenticated;

GRANT SELECT, INSERT, UPDATE ON kernel_domain.evidence_verifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.evidence_verifications TO authenticated;

-- 4. DURABLE SYSTEM OUTBOX QUEUE & DEAD LETTER QUEUE (DLQ)
CREATE TABLE IF NOT EXISTS public.system_outbox_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INT NOT NULL DEFAULT 0,
    idempotency_key TEXT,
    locked_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    original_event_id UUID,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    failure_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. FAMILY INTERACTION TABLES (VISIT REQUESTS & COMPLAINTS)
CREATE TABLE IF NOT EXISTS public.family_visit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    family_user_id UUID REFERENCES auth.users(id),
    resident_id UUID REFERENCES resident_domain.residents(id),
    resident_name TEXT NOT NULL,
    proposed_date DATE NOT NULL,
    proposed_time TEXT NOT NULL,
    visitor_count INT NOT NULL DEFAULT 1,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.family_complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    family_user_id UUID REFERENCES auth.users(id),
    resident_id UUID REFERENCES resident_domain.residents(id),
    resident_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    complaint_text TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'routine',
    target_role TEXT NOT NULL DEFAULT 'supervisor',
    status TEXT NOT NULL DEFAULT 'received',
    acknowledged_by_family BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. PRIVATE EVIDENCE STORAGE BUCKET SETUP
INSERT INTO storage.buckets (id, name, public)
VALUES ('private-care-evidence', 'private-care-evidence', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage RLS Policies
DROP POLICY IF EXISTS "Allow authenticated staff to upload care evidence" ON storage.objects;
CREATE POLICY "Allow authenticated staff to upload care evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'private-care-evidence' AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr'));

DROP POLICY IF EXISTS "Allow authenticated staff to view care evidence" ON storage.objects;
CREATE POLICY "Allow authenticated staff to view care evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'private-care-evidence' AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr'));

-- 7. TENANT & ROLE STRICT RLS POLICIES FOR FAMILY VISIT REQUESTS, COMPLAINTS, OUTBOX & DLQ
ALTER TABLE public.family_visit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_outbox_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dead_letter_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow family to view own visit requests" ON public.family_visit_requests;
CREATE POLICY "Allow family to view own visit requests"
ON public.family_visit_requests FOR SELECT
TO authenticated
USING (
  (family_user_id = auth.uid() OR public.current_sj_role() IN ('supervisor','admin_hr','caregiver'))
  AND facility_id = public.current_sj_facility_id()
);

DROP POLICY IF EXISTS "Allow family to insert visit requests" ON public.family_visit_requests;
CREATE POLICY "Allow family to insert visit requests"
ON public.family_visit_requests FOR INSERT
TO authenticated
WITH CHECK (
  (family_user_id = auth.uid() OR public.current_sj_role() = 'family')
  AND facility_id = public.current_sj_facility_id()
);

DROP POLICY IF EXISTS "Allow family to view own complaints" ON public.family_complaints;
CREATE POLICY "Allow family to view own complaints"
ON public.family_complaints FOR SELECT
TO authenticated
USING (
  (family_user_id = auth.uid() OR public.current_sj_role() IN ('supervisor','admin_hr'))
  AND facility_id = public.current_sj_facility_id()
);

DROP POLICY IF EXISTS "Allow family to insert complaints" ON public.family_complaints;
CREATE POLICY "Allow family to insert complaints"
ON public.family_complaints FOR INSERT
TO authenticated
WITH CHECK (
  (family_user_id = auth.uid() OR public.current_sj_role() = 'family')
  AND facility_id = public.current_sj_facility_id()
);

-- Outbox & DLQ Restricted Staff Access per Facility
DROP POLICY IF EXISTS "Allow staff to read/write outbox" ON public.system_outbox_queue;
CREATE POLICY "Allow staff to read/write outbox"
ON public.system_outbox_queue FOR ALL
TO authenticated
USING (
  public.current_sj_role() IN ('caregiver','supervisor','admin_hr')
  AND facility_id = public.current_sj_facility_id()
)
WITH CHECK (
  public.current_sj_role() IN ('caregiver','supervisor','admin_hr')
  AND facility_id = public.current_sj_facility_id()
);

DROP POLICY IF EXISTS "Allow staff to read/write DLQ" ON public.dead_letter_queue;
CREATE POLICY "Allow staff to read/write DLQ"
ON public.dead_letter_queue FOR ALL
TO authenticated
USING (
  public.current_sj_role() IN ('supervisor','admin_hr')
  AND facility_id = public.current_sj_facility_id()
)
WITH CHECK (
  public.current_sj_role() IN ('supervisor','admin_hr')
  AND facility_id = public.current_sj_facility_id()
);

-- 8. TENANT ISOLATION POLICIES FOR EPISTEMIC FACTS, OBLIGATIONS, EVIDENCE, AUDIT TRAIL, AND HANDOVER CONTRACTS
ALTER TABLE kernel_domain.epistemic_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel_domain.bitemporal_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel_domain.evidence_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel_domain.handover_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_domain.audit_trail ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation policy for epistemic_facts" ON kernel_domain.epistemic_facts;
CREATE POLICY "Tenant isolation policy for epistemic_facts"
ON kernel_domain.epistemic_facts FOR ALL
TO authenticated
USING (facility_id = public.current_sj_facility_id())
WITH CHECK (facility_id = public.current_sj_facility_id());

DROP POLICY IF EXISTS "Tenant isolation policy for bitemporal_obligations" ON kernel_domain.bitemporal_obligations;
CREATE POLICY "Tenant isolation policy for bitemporal_obligations"
ON kernel_domain.bitemporal_obligations FOR ALL
TO authenticated
USING (facility_id = public.current_sj_facility_id())
WITH CHECK (facility_id = public.current_sj_facility_id());

DROP POLICY IF EXISTS "Tenant isolation policy for evidence_verifications" ON kernel_domain.evidence_verifications;
CREATE POLICY "Tenant isolation policy for evidence_verifications"
ON kernel_domain.evidence_verifications FOR ALL
TO authenticated
USING (facility_id = public.current_sj_facility_id())
WITH CHECK (facility_id = public.current_sj_facility_id());

DROP POLICY IF EXISTS "Tenant isolation policy for handover_contracts" ON kernel_domain.handover_contracts;
CREATE POLICY "Tenant isolation policy for handover_contracts"
ON kernel_domain.handover_contracts FOR ALL
TO authenticated
USING (facility_id = public.current_sj_facility_id())
WITH CHECK (facility_id = public.current_sj_facility_id());

DROP POLICY IF EXISTS "Tenant isolation policy for audit_trail" ON audit_domain.audit_trail;
CREATE POLICY "Tenant isolation policy for audit_trail"
ON audit_domain.audit_trail FOR ALL
TO authenticated
USING (facility_id = public.current_sj_facility_id())
WITH CHECK (facility_id = public.current_sj_facility_id());
