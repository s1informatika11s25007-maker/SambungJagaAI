-- ==============================================================================
-- SambungJaga AI — Autonomous Care Continuity Platform Foundations
-- Migration: 20261102000000_autonomous_platform_foundations.sql
-- Multi-Tenant Security & Strict Role + Action-Level RLS Policy Matrix
-- ==============================================================================

-- 0. HELPER ROLE & MULTI-TENANT FACILITY FUNCTIONS (FAIL-CLOSED SECURITY)
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

-- Fail-closed facility resolution: Returns NULL if no verified database profile link exists
CREATE OR REPLACE FUNCTION public.current_sj_facility_id()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(
    (SELECT p.facility_id FROM hr_domain.staff_profiles p WHERE p.user_id = auth.uid() AND p.facility_id IS NOT NULL LIMIT 1),
    (SELECT r.facility_id FROM resident_domain.residents r JOIN resident_domain.family_resident_access a ON a.resident_id = r.id WHERE a.user_id = auth.uid() AND r.facility_id IS NOT NULL LIMIT 1),
    (SELECT r.facility_id FROM resident_domain.residents r JOIN public.family_visit_requests f ON f.resident_id = r.id WHERE f.family_user_id = auth.uid() AND r.facility_id IS NOT NULL LIMIT 1)
  );
$$;

-- 1. ADD MISSING OBLIGATION_STATUS ENUM VALUES
ALTER TYPE obligation_status ADD VALUE IF NOT EXISTS 'created';
ALTER TYPE obligation_status ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE obligation_status ADD VALUE IF NOT EXISTS 'evidence_submitted';
ALTER TYPE obligation_status ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE obligation_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE obligation_status ADD VALUE IF NOT EXISTS 'closed';

-- 2. ADD FACILITY_ID MULTI-TENANT COLUMN TO ALL BASE DOMAIN TABLES
ALTER TABLE IF EXISTS resident_domain.residents ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS hr_domain.staff_profiles ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS kernel_domain.bitemporal_obligations ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS kernel_domain.epistemic_facts ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS kernel_domain.care_rules ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS kernel_domain.handover_contracts ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS kernel_domain.evidence_verifications ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS audit_domain.audit_trail ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS kernel_domain.agent_execution_logs ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS facility_id TEXT NOT NULL DEFAULT 'FAC-001';
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS recipient_user_id UUID;
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'delivered';
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user_id ON public.notifications(recipient_user_id);

-- ADD MISSING COLUMNS FOR WORKFORCE, EVIDENCE, & OBLIGATION SCHEMA
ALTER TABLE IF EXISTS hr_domain.staff_profiles ADD COLUMN IF NOT EXISTS attendance_status TEXT NOT NULL DEFAULT 'present';
ALTER TABLE IF EXISTS hr_domain.staff_profiles ADD COLUMN IF NOT EXISTS certifications JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS hr_domain.staff_profiles ADD COLUMN IF NOT EXISTS shift_start TEXT DEFAULT '07:00';
ALTER TABLE IF EXISTS hr_domain.staff_profiles ADD COLUMN IF NOT EXISTS shift_end TEXT DEFAULT '15:00';
ALTER TABLE IF EXISTS hr_domain.staff_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE IF EXISTS hr_domain.staff_profiles ADD COLUMN IF NOT EXISTS sys_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS resident_domain.residents ADD COLUMN IF NOT EXISTS care_level TEXT NOT NULL DEFAULT 'partial_care';
ALTER TABLE IF EXISTS resident_domain.residents ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS resident_domain.residents ADD COLUMN IF NOT EXISTS sys_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS kernel_domain.epistemic_facts ADD COLUMN IF NOT EXISTS sys_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS kernel_domain.bitemporal_obligations ADD COLUMN IF NOT EXISTS estimated_duration_minutes INT NOT NULL DEFAULT 30;
ALTER TABLE IF EXISTS kernel_domain.bitemporal_obligations ADD COLUMN IF NOT EXISTS evidence_submitted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS kernel_domain.evidence_verifications ADD COLUMN IF NOT EXISTS verifier_notes TEXT;
ALTER TABLE IF EXISTS kernel_domain.evidence_verifications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE IF EXISTS kernel_domain.evidence_verifications ADD COLUMN IF NOT EXISTS sys_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS kernel_domain.handover_contracts ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS kernel_domain.handover_contracts ADD COLUMN IF NOT EXISTS escalated_reason TEXT;
ALTER TABLE IF EXISTS kernel_domain.handover_contracts ADD COLUMN IF NOT EXISTS sys_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS audit_domain.audit_trail ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS audit_domain.audit_trail ADD COLUMN IF NOT EXISTS sys_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS kernel_domain.agent_execution_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS kernel_domain.agent_execution_logs ADD COLUMN IF NOT EXISTS correlation_id TEXT;
ALTER TABLE IF EXISTS kernel_domain.agent_execution_logs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE IF EXISTS public.family_complaints ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE IF EXISTS public.family_complaints ADD COLUMN IF NOT EXISTS resolved_by UUID;
ALTER TABLE IF EXISTS public.family_complaints ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- 3. RECREATE ALL PUBLIC VIEWS TO EXPOSE ALL COLUMNS WITH SECURITY INVOKER
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('staff_profiles', 'residents', 'bitemporal_obligations', 'epistemic_facts', 'handover_contracts', 'evidence_verifications', 'spot_challenges', 'offline_hash_chains', 'authority_envelopes', 'audit_trail', 'agent_execution_logs', 'family_residents', 'family_obligation_summaries', 'care_rules')
  LOOP
    IF r.relkind = 'r' THEN
      EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.relname);
    ELSIF r.relkind IN ('v', 'm') THEN
      EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', r.relname);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE VIEW public.residents WITH (security_invoker = true) AS
  SELECT id, full_name, room_number, medical_condition_summary, allergies, consent_family_level, care_level, status, facility_id, sys_created_at, created_at
  FROM resident_domain.residents;

CREATE OR REPLACE VIEW public.staff_profiles WITH (security_invoker = true) AS
  SELECT id, user_id, full_name, role, shift_status, attendance_status, competencies, certifications, shift_start, shift_end, is_active, is_demo_login, phone_number, facility_id, sys_created_at, created_at, updated_at
  FROM hr_domain.staff_profiles;

CREATE OR REPLACE VIEW public.bitemporal_obligations WITH (security_invoker = true) AS
  SELECT id, mission_id, resident_id, title, description, priority, status, valid_from, valid_until, required_evidence_grade, assigned_caregiver_id, estimated_duration_minutes, evidence_submitted, required_competencies, requires_human_review, is_negative_obligation, preconditions, postconditions, parent_obligation_id, facility_id, sys_created_at, sys_superseded_at
  FROM kernel_domain.bitemporal_obligations;

CREATE OR REPLACE VIEW public.epistemic_facts WITH (security_invoker = true) AS
  SELECT id, resident_id, fact_key, fact_value, status, confidence_score, source_type, source_actor_id, provenance_chain, observed_at, facility_id, sys_created_at, created_at
  FROM kernel_domain.epistemic_facts;

CREATE OR REPLACE VIEW public.handover_contracts WITH (security_invoker = true) AS
  SELECT id, outgoing_staff_id, incoming_staff_id, shift_name, open_obligations_summary, competency_gaps_identified, outgoing_signed_at, incoming_signed_at, contract_status, escalated_at, escalated_reason, hash_signature, facility_id, sys_created_at
  FROM kernel_domain.handover_contracts;

CREATE OR REPLACE VIEW public.evidence_verifications WITH (security_invoker = true) AS
  SELECT id, obligation_id, submitter_id, evidence_grade, evidence_payload, storage_url, verifier_status, is_spot_challenged, verifier_notes, rejection_reason, verified_at, facility_id, sys_created_at
  FROM kernel_domain.evidence_verifications;

CREATE OR REPLACE VIEW public.audit_trail WITH (security_invoker = true) AS
  SELECT id, sequence_id, actor_id, gateway_tag, action_name, payload, prev_entry_hash, entry_hash, facility_id, created_at, sys_created_at, timestamp
  FROM audit_domain.audit_trail;

CREATE OR REPLACE VIEW public.agent_execution_logs WITH (security_invoker = true) AS
  SELECT id, mission_id, agent_name, model_used, status, input_payload, output_payload, error_message, retry_count, execution_time_ms, facility_id, sys_created_at, sys_updated_at, created_at, correlation_id, idempotency_key
  FROM kernel_domain.agent_execution_logs;

CREATE OR REPLACE VIEW public.care_rules WITH (security_invoker = true) AS
  SELECT id, code, version, title, expression, priority, evidence_grade, description, status, effective_from, approved_by, created_by, supersedes_id, facility_id, created_at, updated_at
  FROM kernel_domain.care_rules;

CREATE OR REPLACE VIEW public.spot_challenges WITH (security_invoker = true) AS
  SELECT id, evidence_id, challenge_reason, verifier_supervisor_id, status, created_at
  FROM kernel_domain.spot_challenges;

CREATE OR REPLACE VIEW public.offline_hash_chains WITH (security_invoker = true) AS
  SELECT id, device_id, sequence_number, payload_hash, previous_hash, signature, synced_at
  FROM kernel_domain.offline_hash_chains;

CREATE OR REPLACE VIEW public.authority_envelopes WITH (security_invoker = true) AS
  SELECT id, action_type, envelope_level, requires_human_approval, approved_by, approval_status, created_at
  FROM kernel_domain.authority_envelopes;

CREATE OR REPLACE VIEW public.family_residents WITH (security_invoker = true) AS
  SELECT a.user_id, a.resident_id, a.disclosure_level, r.full_name AS resident_name, r.room_number, r.facility_id
  FROM resident_domain.family_resident_access a
  JOIN resident_domain.residents r ON r.id = a.resident_id;

CREATE OR REPLACE VIEW public.family_obligation_summaries WITH (security_invoker = true) AS
  SELECT o.id, o.resident_id, o.title, o.status, o.valid_from, o.valid_until, o.facility_id
  FROM kernel_domain.bitemporal_obligations o;

-- GRANT VIEW PERMISSIONS TO AUTHENTICATED USERS
GRANT SELECT ON public.residents TO authenticated;
GRANT SELECT ON public.staff_profiles TO authenticated;
GRANT SELECT ON public.bitemporal_obligations TO authenticated;
GRANT SELECT ON public.epistemic_facts TO authenticated;
GRANT SELECT ON public.handover_contracts TO authenticated;
GRANT SELECT ON public.evidence_verifications TO authenticated;
GRANT SELECT ON public.audit_trail TO authenticated;
GRANT SELECT ON public.agent_execution_logs TO authenticated;
GRANT SELECT ON public.care_rules TO authenticated;
GRANT SELECT ON public.spot_challenges TO authenticated;
GRANT SELECT ON public.offline_hash_chains TO authenticated;
GRANT SELECT ON public.authority_envelopes TO authenticated;
GRANT SELECT ON public.family_residents TO authenticated;
GRANT SELECT ON public.family_obligation_summaries TO authenticated;

-- 4. TABLES FOR AGENT MESH & WORKER HEARTBEATS
CREATE TABLE IF NOT EXISTS public.agent_mesh_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    agent_name TEXT UNIQUE NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0.0',
    policy_level TEXT NOT NULL DEFAULT 'A1',
    status TEXT NOT NULL DEFAULT 'idle',
    consecutive_failures INT NOT NULL DEFAULT 0,
    total_executions INT NOT NULL DEFAULT 0,
    successful_executions INT NOT NULL DEFAULT 0,
    last_execution_time_ms INT DEFAULT 0,
    circuit_open BOOLEAN NOT NULL DEFAULT FALSE,
    last_executed_at TIMESTAMPTZ,
    last_error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.worker_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    worker_id TEXT UNIQUE NOT NULL,
    worker_type TEXT NOT NULL DEFAULT 'background_worker',
    status TEXT NOT NULL DEFAULT 'active',
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    jobs_processed INT NOT NULL DEFAULT 0,
    jobs_failed INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE ON kernel_domain.agent_execution_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.agent_execution_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.agent_mesh_states TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.worker_heartbeats TO authenticated;

-- 5. FAMILY INTERACTION TABLES
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
    ticket_number TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.family_visit_requests
    ADD COLUMN IF NOT EXISTS ticket_number TEXT;

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
    ticket_number TEXT,
    status TEXT NOT NULL DEFAULT 'received',
    acknowledged_by_family BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.family_complaints
    ADD COLUMN IF NOT EXISTS ticket_number TEXT;

GRANT SELECT, INSERT, UPDATE ON public.family_visit_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.family_complaints TO authenticated;

-- 6. SYSTEM OUTBOX QUEUE TABLE & FUNCTION
CREATE TABLE IF NOT EXISTS public.system_outbox_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INT NOT NULL DEFAULT 0,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_outbox_idempotency_key ON public.system_outbox_queue(idempotency_key);

CREATE TABLE IF NOT EXISTS public.dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    original_event_id UUID,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    failure_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QUEUE PERMISSIONS: SELECT/INSERT TO AUTHENTICATED, MUTATIONS RESTRICTED TO SERVICE ROLE
GRANT SELECT, INSERT ON public.system_outbox_queue TO authenticated;
GRANT SELECT ON public.dead_letter_queue TO authenticated;

DROP FUNCTION IF EXISTS public.fn_claim_outbox_jobs(TEXT, INT);
CREATE OR REPLACE FUNCTION public.fn_claim_outbox_jobs(
    p_worker_id TEXT,
    p_batch_size INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    facility_id TEXT,
    event_type TEXT,
    payload JSONB,
    status TEXT,
    retry_count INT,
    idempotency_key TEXT,
    locked_at TIMESTAMPTZ,
    scheduled_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
    RETURN QUERY
    WITH pending_jobs AS (
        SELECT q.id
        FROM public.system_outbox_queue q
        WHERE q.status IN ('pending', 'retrying')
          AND COALESCE(q.scheduled_at, q.created_at) <= NOW()
          AND (q.locked_at IS NULL OR q.locked_at < NOW() - INTERVAL '3 minutes')
        ORDER BY q.created_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.system_outbox_queue target
    SET status = 'processing',
        locked_at = NOW(),
        error_message = p_worker_id
    FROM pending_jobs
    WHERE target.id = pending_jobs.id
    RETURNING
        target.id,
        target.facility_id,
        target.event_type,
        target.payload,
        target.status,
        target.retry_count,
        target.idempotency_key,
        target.locked_at,
        target.scheduled_at;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_claim_outbox_jobs(TEXT,INT) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_claim_outbox_jobs(TEXT,INT) TO service_role;

-- 7. ATOMIC EVIDENCE CLOSURE RPC
DROP FUNCTION IF EXISTS public.fn_submit_evidence_and_close_obligation(UUID, TEXT, JSONB, TEXT);
CREATE OR REPLACE FUNCTION public.fn_submit_evidence_and_close_obligation(
    p_obligation_id UUID,
    p_evidence_grade TEXT,
    p_evidence_payload JSONB,
    p_storage_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_facility_id TEXT;
    v_evidence_id UUID;
    v_submitter_id UUID;
    v_lifecycle_status TEXT;
    v_requires_human BOOLEAN;
BEGIN
    -- 1. Get staff profile submitter
    SELECT id, facility_id INTO v_submitter_id, v_facility_id
    FROM hr_domain.staff_profiles
    WHERE user_id = auth.uid();

    IF v_submitter_id IS NULL THEN
        RAISE EXCEPTION 'Pengguna tidak memiliki profil staf yang valid.';
    END IF;

    -- 2. Verify obligation exists and belongs to submitter facility
    SELECT facility_id, requires_human_review INTO v_facility_id, v_requires_human
    FROM kernel_domain.bitemporal_obligations
    WHERE id = p_obligation_id AND facility_id = v_facility_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Obligasi tidak ditemukan atau tidak berada dalam fasilitas yang sama.';
    END IF;

    -- 3. Extract lifecycle status from payload or default to pending_review
    v_lifecycle_status := COALESCE(p_evidence_payload->>'lifecycle_status', 'pending_review');

    -- 4. Insert evidence verification record
    INSERT INTO kernel_domain.evidence_verifications (
        obligation_id,
        submitter_id,
        evidence_grade,
        evidence_payload,
        storage_url,
        verifier_status,
        facility_id
    ) VALUES (
        p_obligation_id,
        v_submitter_id,
        p_evidence_grade,
        p_evidence_payload,
        p_storage_url,
        v_lifecycle_status,
        v_facility_id
    ) RETURNING id INTO v_evidence_id;

    -- 5. Update obligation status: if approved, close; if pending_review, set evidence_submitted
    IF v_lifecycle_status = 'approved' AND v_requires_human IS NOT TRUE THEN
        UPDATE kernel_domain.bitemporal_obligations
        SET status = 'closed',
            evidence_submitted = true
        WHERE id = p_obligation_id;
    ELSE
        UPDATE kernel_domain.bitemporal_obligations
        SET status = 'evidence_submitted',
            evidence_submitted = true
        WHERE id = p_obligation_id;
    END IF;

    -- 6. Insert audit trail entry
    INSERT INTO audit_domain.audit_trail (
        facility_id,
        actor_id,
        gateway_tag,
        action_name,
        payload
    ) VALUES (
        v_facility_id,
        auth.uid(),
        '[RPC] Atomic Evidence Verification',
        'EVIDENCE_SUBMITTED_LIFECYCLE_UPDATED',
        jsonb_build_object(
            'evidence_id', v_evidence_id,
            'obligation_id', p_obligation_id,
            'lifecycle_status', v_lifecycle_status
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'evidence_id', v_evidence_id,
        'lifecycle_status', v_lifecycle_status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_submit_evidence_and_close_obligation(UUID,TEXT,JSONB,TEXT) TO authenticated;

-- STORAGE POLICIES (STRICT TENANT FOLDER PATH)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    DROP POLICY IF EXISTS "Allow authenticated staff to upload care evidence" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated staff to view care evidence" ON storage.objects;
    DROP POLICY IF EXISTS "Tenant strict care evidence upload" ON storage.objects;
    DROP POLICY IF EXISTS "Tenant strict care evidence select" ON storage.objects;

    CREATE POLICY "Tenant strict care evidence upload"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'private-care-evidence'
      AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr')
      AND public.current_sj_facility_id() IS NOT NULL
      AND split_part(name, '/', 1) = public.current_sj_facility_id()
      AND name LIKE public.current_sj_facility_id() || '/%'
    );

    CREATE POLICY "Tenant strict care evidence select"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'private-care-evidence'
      AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr')
      AND public.current_sj_facility_id() IS NOT NULL
      AND split_part(name, '/', 1) = public.current_sj_facility_id()
      AND name LIKE public.current_sj_facility_id() || '/%'
    );
  END IF;
END $$;

-- 8. ENABLE ROW LEVEL SECURITY ON ALL DOMAIN TABLES
ALTER TABLE hr_domain.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident_domain.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel_domain.epistemic_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel_domain.bitemporal_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel_domain.evidence_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel_domain.handover_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel_domain.spot_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel_domain.offline_hash_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel_domain.authority_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_domain.audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel_domain.agent_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_visit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_outbox_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dead_letter_queue ENABLE ROW LEVEL SECURITY;

-- 9. ACTION-LEVEL ACTION-RESTRICTED RLS POLICY MATRIX (NO GENERIC FOR ALL TO AUTHENTICATED)

-- A. Staff Profiles
DROP POLICY IF EXISTS "Tenant strict policy for staff_profiles_select" ON hr_domain.staff_profiles;
DROP POLICY IF EXISTS "Tenant strict policy for staff_profiles_update" ON hr_domain.staff_profiles;
DROP POLICY IF EXISTS "Tenant strict policy for staff_profiles" ON hr_domain.staff_profiles;

CREATE POLICY "Tenant strict policy for staff_profiles_select"
ON hr_domain.staff_profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (public.current_sj_facility_id() IS NOT NULL AND facility_id = public.current_sj_facility_id() AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr'))
);

CREATE POLICY "Tenant strict policy for staff_profiles_update"
ON hr_domain.staff_profiles FOR UPDATE TO authenticated
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

-- B. Residents
DROP POLICY IF EXISTS "Tenant strict policy for residents_select" ON resident_domain.residents;
DROP POLICY IF EXISTS "Tenant strict policy for residents_write" ON resident_domain.residents;
DROP POLICY IF EXISTS "Tenant strict policy for residents" ON resident_domain.residents;

CREATE POLICY "Tenant strict policy for residents_select"
ON resident_domain.residents FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.sj_can_access_resident(id)
);

CREATE POLICY "Tenant strict policy for residents_write"
ON resident_domain.residents FOR ALL TO authenticated
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

-- C. Epistemic Facts
DROP POLICY IF EXISTS "Tenant strict policy for epistemic_facts" ON kernel_domain.epistemic_facts;
DROP POLICY IF EXISTS "Tenant strict policy for epistemic_facts_select" ON kernel_domain.epistemic_facts;
DROP POLICY IF EXISTS "Tenant strict policy for epistemic_facts_insert" ON kernel_domain.epistemic_facts;

CREATE POLICY "Tenant strict policy for epistemic_facts_select"
ON kernel_domain.epistemic_facts FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr')
);

CREATE POLICY "Tenant strict policy for epistemic_facts_insert"
ON kernel_domain.epistemic_facts FOR INSERT TO authenticated
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr')
);

-- D. Bitemporal Obligations
DROP POLICY IF EXISTS "Tenant strict policy for bitemporal_obligations_select" ON kernel_domain.bitemporal_obligations;
DROP POLICY IF EXISTS "Tenant strict policy for bitemporal_obligations_insert" ON kernel_domain.bitemporal_obligations;
DROP POLICY IF EXISTS "Tenant strict policy for bitemporal_obligations_update" ON kernel_domain.bitemporal_obligations;
DROP POLICY IF EXISTS "Tenant strict policy for bitemporal_obligations" ON kernel_domain.bitemporal_obligations;

CREATE POLICY "Tenant strict policy for bitemporal_obligations_select"
ON kernel_domain.bitemporal_obligations FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND (
    assigned_caregiver_id = (SELECT p.id FROM hr_domain.staff_profiles p WHERE p.user_id = auth.uid())
    OR public.current_sj_role() IN ('supervisor','admin_hr')
    OR public.sj_can_access_resident(resident_id)
  )
);

CREATE POLICY "Tenant strict policy for bitemporal_obligations_insert"
ON kernel_domain.bitemporal_obligations FOR INSERT TO authenticated
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr')
);

CREATE POLICY "Tenant strict policy for bitemporal_obligations_update"
ON kernel_domain.bitemporal_obligations FOR UPDATE TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND (
    public.current_sj_role() IN ('supervisor','admin_hr')
    OR assigned_caregiver_id = (SELECT p.id FROM hr_domain.staff_profiles p WHERE p.user_id = auth.uid())
  )
)
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
);

-- E. Evidence Verifications (Caregivers submit own; Supervisors review/update)
DROP POLICY IF EXISTS "Tenant strict policy for evidence_verifications" ON kernel_domain.evidence_verifications;
DROP POLICY IF EXISTS "Tenant strict policy for evidence_verifications_select" ON kernel_domain.evidence_verifications;
DROP POLICY IF EXISTS "Tenant strict policy for evidence_verifications_insert" ON kernel_domain.evidence_verifications;
DROP POLICY IF EXISTS "Tenant strict policy for evidence_verifications_update" ON kernel_domain.evidence_verifications;

CREATE POLICY "Tenant strict policy for evidence_verifications_select"
ON kernel_domain.evidence_verifications FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr')
);

CREATE POLICY "Tenant strict policy for evidence_verifications_insert"
ON kernel_domain.evidence_verifications FOR INSERT TO authenticated
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr')
  AND submitter_id = (SELECT p.id FROM hr_domain.staff_profiles p WHERE p.user_id = auth.uid())
);

CREATE POLICY "Tenant strict policy for evidence_verifications_update"
ON kernel_domain.evidence_verifications FOR UPDATE TO authenticated
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

-- F. Notifications (Strict per-user or target role in same facility)
DROP POLICY IF EXISTS "Tenant strict policy for notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "Tenant strict policy for notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "Tenant strict policy for notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "Tenant strict policy for notifications" ON public.notifications;

CREATE POLICY "Tenant strict policy for notifications_select"
ON public.notifications FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND (
    recipient_user_id = auth.uid()
    OR (recipient_user_id IS NULL AND recipient_role = public.current_sj_role())
  )
);

CREATE POLICY "Tenant strict policy for notifications_insert"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
);

CREATE POLICY "Tenant strict policy for notifications_update"
ON public.notifications FOR UPDATE TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND (
    recipient_user_id = auth.uid()
    OR (recipient_user_id IS NULL AND recipient_role = public.current_sj_role())
  )
)
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
);

-- G. Audit Trail (Strict Append-Only: INSERT allowed, SELECT for supervisors, UPDATE/DELETE FORBIDDEN)
DROP POLICY IF EXISTS "Tenant strict policy for audit_trail_select" ON audit_domain.audit_trail;
DROP POLICY IF EXISTS "Tenant strict policy for audit_trail_insert" ON audit_domain.audit_trail;
DROP POLICY IF EXISTS "Tenant strict policy for audit_trail" ON audit_domain.audit_trail;

CREATE POLICY "Tenant strict policy for audit_trail_select"
ON audit_domain.audit_trail FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('supervisor','admin_hr')
);

CREATE POLICY "Tenant strict policy for audit_trail_insert"
ON audit_domain.audit_trail FOR INSERT TO authenticated
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
);

-- H. Handover Contracts
DROP POLICY IF EXISTS "Tenant strict policy for handover_contracts" ON kernel_domain.handover_contracts;
DROP POLICY IF EXISTS "Tenant strict policy for handover_contracts_select" ON kernel_domain.handover_contracts;
DROP POLICY IF EXISTS "Tenant strict policy for handover_contracts_insert" ON kernel_domain.handover_contracts;
DROP POLICY IF EXISTS "Tenant strict policy for handover_contracts_update" ON kernel_domain.handover_contracts;

CREATE POLICY "Tenant strict policy for handover_contracts_select"
ON kernel_domain.handover_contracts FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr')
);

CREATE POLICY "Tenant strict policy for handover_contracts_insert"
ON kernel_domain.handover_contracts FOR INSERT TO authenticated
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr')
);

CREATE POLICY "Tenant strict policy for handover_contracts_update"
ON kernel_domain.handover_contracts FOR UPDATE TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr')
)
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
);

-- I. Agent Execution Logs
DROP POLICY IF EXISTS "Tenant strict policy for agent_execution_logs" ON kernel_domain.agent_execution_logs;
DROP POLICY IF EXISTS "Tenant strict policy for agent_execution_logs_select" ON kernel_domain.agent_execution_logs;
DROP POLICY IF EXISTS "Tenant strict policy for agent_execution_logs_insert" ON kernel_domain.agent_execution_logs;

CREATE POLICY "Tenant strict policy for agent_execution_logs_select"
ON kernel_domain.agent_execution_logs FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('supervisor','admin_hr')
);

CREATE POLICY "Tenant strict policy for agent_execution_logs_insert"
ON kernel_domain.agent_execution_logs FOR INSERT TO authenticated
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
);

-- J. System Outbox Queue (Regular users: INSERT only; Supervisors: Monitoring SELECT; Mutations: service_role)
DROP POLICY IF EXISTS "Tenant strict policy for system_outbox_queue" ON public.system_outbox_queue;
DROP POLICY IF EXISTS "Tenant strict policy for system_outbox_queue_select" ON public.system_outbox_queue;
DROP POLICY IF EXISTS "Tenant strict policy for system_outbox_queue_insert" ON public.system_outbox_queue;

CREATE POLICY "Tenant strict policy for system_outbox_queue_select"
ON public.system_outbox_queue FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('supervisor','admin_hr')
);

CREATE POLICY "Tenant strict policy for system_outbox_queue_insert"
ON public.system_outbox_queue FOR INSERT TO authenticated
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
);

-- K. Dead Letter Queue
DROP POLICY IF EXISTS "Tenant strict policy for dead_letter_queue" ON public.dead_letter_queue;
DROP POLICY IF EXISTS "Tenant strict policy for dead_letter_queue_select" ON public.dead_letter_queue;

CREATE POLICY "Tenant strict policy for dead_letter_queue_select"
ON public.dead_letter_queue FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND public.current_sj_role() IN ('supervisor','admin_hr')
);

-- L. Family Visit Requests (Family users: INSERT own, SELECT own; Supervisors: SELECT/UPDATE in facility)
DROP POLICY IF EXISTS "Tenant strict policy for family_visit_requests" ON public.family_visit_requests;
DROP POLICY IF EXISTS "Tenant strict policy for family_visit_requests_select" ON public.family_visit_requests;
DROP POLICY IF EXISTS "Tenant strict policy for family_visit_requests_insert" ON public.family_visit_requests;
DROP POLICY IF EXISTS "Tenant strict policy for family_visit_requests_update" ON public.family_visit_requests;

CREATE POLICY "Tenant strict policy for family_visit_requests_select"
ON public.family_visit_requests FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND (
    family_user_id = auth.uid()
    OR public.current_sj_role() IN ('supervisor','admin_hr')
  )
);

CREATE POLICY "Tenant strict policy for family_visit_requests_insert"
ON public.family_visit_requests FOR INSERT TO authenticated
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND family_user_id = auth.uid()
);

CREATE POLICY "Tenant strict policy for family_visit_requests_update"
ON public.family_visit_requests FOR UPDATE TO authenticated
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

-- M. Family Complaints (Family users: INSERT own, SELECT own; Supervisors: SELECT/UPDATE in facility)
DROP POLICY IF EXISTS "Tenant strict policy for family_complaints" ON public.family_complaints;
DROP POLICY IF EXISTS "Tenant strict policy for family_complaints_select" ON public.family_complaints;
DROP POLICY IF EXISTS "Tenant strict policy for family_complaints_insert" ON public.family_complaints;
DROP POLICY IF EXISTS "Tenant strict policy for family_complaints_update" ON public.family_complaints;

CREATE POLICY "Tenant strict policy for family_complaints_select"
ON public.family_complaints FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND (
    family_user_id = auth.uid()
    OR public.current_sj_role() IN ('supervisor','admin_hr')
  )
);

CREATE POLICY "Tenant strict policy for family_complaints_insert"
ON public.family_complaints FOR INSERT TO authenticated
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND family_user_id = auth.uid()
);

CREATE POLICY "Tenant strict policy for family_complaints_update"
ON public.family_complaints FOR UPDATE TO authenticated
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

-- 10. DEDICATED AUTOMATION & DISTRIBUTED QUEUE TABLES
CREATE TABLE IF NOT EXISTS public.automation_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    schedule_name TEXT UNIQUE NOT NULL,
    cron_expression TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.automation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    job_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    lease_owner TEXT,
    lease_expires_at TIMESTAMPTZ,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    max_retries INT NOT NULL DEFAULT 3,
    retry_count INT NOT NULL DEFAULT 0,
    idempotency_key TEXT UNIQUE,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_jobs_idempotency ON public.automation_jobs(idempotency_key);

CREATE TABLE IF NOT EXISTS public.automation_job_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.automation_jobs(id) ON DELETE CASCADE,
    worker_id TEXT NOT NULL,
    attempt_number INT NOT NULL,
    status TEXT NOT NULL,
    execution_time_ms INT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.automation_worker_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id TEXT UNIQUE NOT NULL,
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    worker_type TEXT NOT NULL DEFAULT 'background_worker',
    status TEXT NOT NULL DEFAULT 'active',
    active_jobs INT NOT NULL DEFAULT 0,
    jobs_processed INT NOT NULL DEFAULT 0,
    jobs_failed INT NOT NULL DEFAULT 0,
    cpu_usage_pct INT DEFAULT 0,
    memory_mb INT DEFAULT 0,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.automation_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID,
    worker_id TEXT NOT NULL,
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    status TEXT NOT NULL,
    logs JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.automation_dead_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    original_job_id UUID,
    job_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    failure_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DISTRIBUTED LOCK & JOB LEASE CLAIM FUNCTION FOR AUTOMATION JOBS
DROP FUNCTION IF EXISTS public.fn_claim_automation_jobs(TEXT, INT, INT);
CREATE OR REPLACE FUNCTION public.fn_claim_automation_jobs(
    p_worker_id TEXT,
    p_batch_size INT DEFAULT 10,
    p_lease_duration_seconds INT DEFAULT 300
)
RETURNS TABLE (
    id UUID,
    facility_id TEXT,
    job_type TEXT,
    payload JSONB,
    status TEXT,
    retry_count INT,
    idempotency_key TEXT,
    scheduled_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
    RETURN QUERY
    WITH pending_automation_jobs AS (
        SELECT q.id
        FROM public.automation_jobs q
        WHERE q.status IN ('pending', 'retrying')
          AND COALESCE(q.scheduled_at, q.created_at) <= NOW()
          AND (q.lease_expires_at IS NULL OR q.lease_expires_at < NOW())
        ORDER BY q.created_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.automation_jobs target
    SET status = 'processing',
        lease_owner = p_worker_id,
        lease_expires_at = NOW() + (p_lease_duration_seconds || ' seconds')::INTERVAL,
        error_message = p_worker_id
    FROM pending_automation_jobs
    WHERE target.id = pending_automation_jobs.id
    RETURNING
        target.id,
        target.facility_id,
        target.job_type,
        target.payload,
        target.status,
        target.retry_count,
        target.idempotency_key,
        target.scheduled_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_claim_automation_jobs(TEXT, INT, INT) TO service_role;

