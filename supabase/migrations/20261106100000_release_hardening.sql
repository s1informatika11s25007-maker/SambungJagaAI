-- SambungJaga Release Hardening — P0/P1
-- Corrects final definitions used by the application. Apply after all 2026-11-03 migrations.

BEGIN;
SELECT pg_advisory_xact_lock(20261106100000);

-- Role and facility helpers must resolve from an active database profile only.
CREATE OR REPLACE FUNCTION public.current_sj_role()
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT p.role::text
  FROM hr_domain.staff_profiles AS p
  WHERE p.user_id = auth.uid()
    AND p.is_active = TRUE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_sj_facility_id()
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(
    (SELECT p.facility_id FROM hr_domain.staff_profiles p
      WHERE p.user_id = auth.uid() AND p.is_active = TRUE AND p.facility_id IS NOT NULL LIMIT 1),
    (SELECT r.facility_id FROM resident_domain.residents r
      JOIN resident_domain.family_resident_access a ON a.resident_id = r.id
      WHERE a.user_id = auth.uid() AND r.facility_id IS NOT NULL LIMIT 1)
  );
$$;

REVOKE ALL ON FUNCTION public.current_sj_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_sj_role() TO authenticated;
REVOKE ALL ON FUNCTION public.current_sj_facility_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_sj_facility_id() TO authenticated;

-- -----------------------------------------------------------------------------
-- 1. Persist facts and proposed obligations with the resident's actual facility.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION kernel_domain.fn_record_care_fact_and_obligation(
  p_resident_id UUID,
  p_fact_key TEXT,
  p_fact_value JSONB,
  p_source_type TEXT,
  p_source_actor_id UUID,
  p_close_obligation_id UUID DEFAULT NULL,
  p_close_note TEXT DEFAULT NULL,
  p_proposed_obligations JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_fact_id UUID;
  v_mission_id UUID := gen_random_uuid();
  v_facility_id TEXT;
  v_actor_role TEXT;
  v_new_ob_count INTEGER := 0;
  v_prop JSONB;
  v_priority public.obligation_priority;
  v_minutes INTEGER;
  v_assignee UUID;
BEGIN
  IF p_resident_id IS NULL OR NULLIF(BTRIM(p_fact_key), '') IS NULL THEN
    RAISE EXCEPTION 'Penghuni dan fact_key wajib diisi.' USING ERRCODE = '22023';
  END IF;

  SELECT r.facility_id INTO v_facility_id
  FROM resident_domain.residents r
  WHERE r.id = p_resident_id;
  IF NOT FOUND OR v_facility_id IS NULL THEN
    RAISE EXCEPTION 'Penghuni tidak ditemukan atau belum memiliki fasilitas.' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.role::text INTO v_actor_role
  FROM hr_domain.staff_profiles p
  WHERE p.id = p_source_actor_id
    AND p.user_id = auth.uid()
    AND p.is_active = true
    AND p.facility_id = v_facility_id;
  IF NOT FOUND OR v_actor_role NOT IN ('caregiver', 'supervisor', 'admin_hr') THEN
    RAISE EXCEPTION 'Aktor tidak aktif atau tidak berada pada fasilitas penghuni.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(COALESCE(p_proposed_obligations, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'proposed_obligations harus berupa array JSON.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO kernel_domain.epistemic_facts (
    resident_id, fact_key, fact_value, status, confidence_score, source_type,
    source_actor_id, observed_at, facility_id
  ) VALUES (
    p_resident_id,
    LEFT(BTRIM(p_fact_key), 120),
    COALESCE(p_fact_value, '{}'::jsonb),
    'reported',
    CASE
      WHEN COALESCE(p_fact_value->>'confidence', '') ~ '^[0-9]+(\.[0-9]+)?$'
        THEN LEAST(1.00, GREATEST(0.00, (p_fact_value->>'confidence')::NUMERIC))
      ELSE NULL
    END,
    COALESCE(NULLIF(BTRIM(p_source_type), ''), 'human_report'),
    p_source_actor_id,
    NOW(),
    v_facility_id
  ) RETURNING id INTO v_fact_id;

  IF jsonb_array_length(COALESCE(p_proposed_obligations, '[]'::jsonb)) > 0 THEN
    FOR v_prop IN
      SELECT item.value
      FROM jsonb_array_elements(COALESCE(p_proposed_obligations, '[]'::jsonb)) WITH ORDINALITY AS item(value, ordinal)
      WHERE item.ordinal <= 3
    LOOP
      IF NULLIF(BTRIM(v_prop->>'title'), '') IS NULL THEN
        CONTINUE;
      END IF;

      v_priority := CASE
        WHEN v_prop->>'priority' IN ('emergency', 'critical', 'important', 'routine')
          THEN (v_prop->>'priority')::public.obligation_priority
        WHEN v_prop->>'priority' = 'urgent' THEN 'important'::public.obligation_priority
        ELSE 'routine'::public.obligation_priority
      END;

      v_minutes := CASE
        WHEN COALESCE(v_prop->>'valid_until_minutes', '') ~ '^[0-9]{1,4}$'
          THEN GREATEST(5, LEAST((v_prop->>'valid_until_minutes')::INTEGER, 1440))
        ELSE 120
      END;

      -- Only the authenticated caregiver reporter is assigned automatically.
      -- Supervisor and HR reports create unassigned work for an authorized assignment flow.
      v_assignee := CASE WHEN v_actor_role = 'caregiver' THEN p_source_actor_id ELSE NULL END;

      INSERT INTO kernel_domain.bitemporal_obligations (
        mission_id, resident_id, title, description, assigned_caregiver_id,
        priority, status, valid_from, valid_until, required_evidence_grade,
        requires_human_review, facility_id
      ) VALUES (
        v_mission_id,
        p_resident_id,
        LEFT(BTRIM(v_prop->>'title'), 180),
        LEFT(COALESCE(v_prop->>'description', 'Menunggu tinjauan petugas berwenang.'), 1200),
        v_assignee,
        v_priority,
        'open',
        NOW(),
        NOW() + make_interval(mins => v_minutes),
        CASE WHEN v_prop->>'required_evidence_grade' IN ('E0', 'E1', 'E2', 'E3') THEN v_prop->>'required_evidence_grade' ELSE 'E1' END,
        TRUE,
        v_facility_id
      );
      v_new_ob_count := v_new_ob_count + 1;
    END LOOP;
  END IF;

  INSERT INTO audit_domain.audit_trail (
    facility_id, actor_id, gateway_tag, action_name, payload
  ) VALUES (
    v_facility_id,
    p_source_actor_id,
    '[A] Perception & Obligation Gateway',
    'FACT_AND_OBLIGATION_RECORDED',
    jsonb_build_object(
      'fact_id', v_fact_id,
      'fact_key', p_fact_key,
      'new_obligations_created', v_new_ob_count,
      'mission_id', v_mission_id,
      'closure_requested_but_not_performed', p_close_obligation_id IS NOT NULL,
      'close_note_not_applied', p_close_note IS NOT NULL
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'fact_id', v_fact_id,
    'closed_obligation_id', NULL,
    'new_obligations_count', v_new_ob_count,
    'mission_id', v_mission_id,
    'facility_id', v_facility_id,
    'requires_human_review', TRUE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_record_care_fact_and_obligation(
  p_resident_id UUID,
  p_fact_key TEXT,
  p_fact_value JSONB,
  p_source_type TEXT,
  p_source_actor_id UUID,
  p_close_obligation_id UUID DEFAULT NULL,
  p_close_note TEXT DEFAULT NULL,
  p_proposed_obligations JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor UUID;
BEGIN
  IF public.current_sj_role() NOT IN ('caregiver', 'supervisor', 'admin_hr') THEN
    RAISE EXCEPTION 'Role tidak diizinkan mencatat observasi.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.sj_can_access_resident(p_resident_id) THEN
    RAISE EXCEPTION 'Akses ke profil penghuni tidak diizinkan.' USING ERRCODE = '42501';
  END IF;

  SELECT p.id INTO v_actor
  FROM hr_domain.staff_profiles p
  WHERE p.user_id = auth.uid()
    AND p.is_active = true
    AND p.facility_id = public.current_sj_facility_id()
  LIMIT 1;
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Profil staf aktif pada fasilitas belum tersedia.' USING ERRCODE = '42501';
  END IF;

  RETURN kernel_domain.fn_record_care_fact_and_obligation(
    p_resident_id, p_fact_key, p_fact_value, p_source_type, v_actor,
    p_close_obligation_id, p_close_note, p_proposed_obligations
  );
END;
$$;

REVOKE ALL ON FUNCTION kernel_domain.fn_record_care_fact_and_obligation(UUID,TEXT,JSONB,TEXT,UUID,UUID,TEXT,JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_record_care_fact_and_obligation(UUID,TEXT,JSONB,TEXT,UUID,UUID,TEXT,JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_record_care_fact_and_obligation(UUID,TEXT,JSONB,TEXT,UUID,UUID,TEXT,JSONB) TO authenticated;

-- Manual obligation creation uses a server-derived tenant and a generated mission_id.
CREATE OR REPLACE FUNCTION public.create_care_obligation(
  p_resident_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT 'important',
  p_required_evidence_grade TEXT DEFAULT 'E1',
  p_assigned_caregiver_id UUID DEFAULT NULL,
  p_valid_until_minutes INTEGER DEFAULT 240
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor_id UUID;
  v_facility_id TEXT;
  v_role TEXT;
  v_resident_facility TEXT;
  v_priority public.obligation_priority;
  v_obligation kernel_domain.bitemporal_obligations%ROWTYPE;
BEGIN
  SELECT p.id, p.facility_id, p.role::text
  INTO v_actor_id, v_facility_id, v_role
  FROM hr_domain.staff_profiles p
  WHERE p.user_id = auth.uid() AND p.is_active = TRUE
  LIMIT 1;

  IF v_actor_id IS NULL OR v_facility_id IS NULL OR v_role NOT IN ('supervisor', 'admin_hr') THEN
    RAISE EXCEPTION 'Hanya supervisor atau HR aktif pada fasilitas terverifikasi yang dapat membuat tugas manual.' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(BTRIM(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'Judul tugas wajib diisi.' USING ERRCODE = '22023';
  END IF;
  IF p_required_evidence_grade NOT IN ('E0', 'E1', 'E2', 'E3') THEN
    RAISE EXCEPTION 'Evidence grade tidak valid.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_valid_until_minutes, 0) < 5 OR p_valid_until_minutes > 10080 THEN
    RAISE EXCEPTION 'Batas waktu tugas harus 5–10080 menit.' USING ERRCODE = '22023';
  END IF;
  SELECT r.facility_id INTO v_resident_facility
  FROM resident_domain.residents r
  WHERE r.id = p_resident_id;
  IF NOT FOUND OR v_resident_facility IS DISTINCT FROM v_facility_id THEN
    RAISE EXCEPTION 'Penghuni tidak ditemukan atau berbeda fasilitas.' USING ERRCODE = '42501';
  END IF;
  IF p_assigned_caregiver_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM hr_domain.staff_profiles c
    WHERE c.id = p_assigned_caregiver_id
      AND c.facility_id = v_facility_id
      AND c.role::text = 'caregiver'
      AND c.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Caregiver tujuan tidak aktif atau berbeda fasilitas.' USING ERRCODE = '42501';
  END IF;
  v_priority := CASE
    WHEN p_priority IN ('routine', 'important', 'critical', 'emergency') THEN p_priority::public.obligation_priority
    WHEN p_priority = 'urgent' THEN 'important'::public.obligation_priority
    ELSE 'routine'::public.obligation_priority
  END;

  INSERT INTO kernel_domain.bitemporal_obligations (
    mission_id, resident_id, title, description, assigned_caregiver_id,
    priority, status, valid_from, valid_until, required_evidence_grade,
    requires_human_review, facility_id
  ) VALUES (
    gen_random_uuid(), p_resident_id, LEFT(BTRIM(p_title), 180),
    LEFT(COALESCE(p_description, ''), 1200), p_assigned_caregiver_id,
    v_priority, 'open', NOW(), NOW() + make_interval(mins => p_valid_until_minutes),
    p_required_evidence_grade, TRUE, v_facility_id
  ) RETURNING * INTO v_obligation;

  INSERT INTO audit_domain.audit_trail (facility_id, actor_id, gateway_tag, action_name, payload)
  VALUES (
    v_facility_id, v_actor_id, '[RPC] Care Obligation Creation', 'CARE_OBLIGATION_CREATED',
    jsonb_build_object('obligation_id', v_obligation.id, 'resident_id', p_resident_id,
      'assigned_caregiver_id', p_assigned_caregiver_id, 'mission_id', v_obligation.mission_id)
  );

  RETURN jsonb_build_object('success', TRUE, 'obligation', to_jsonb(v_obligation));
END;
$$;
REVOKE ALL ON FUNCTION public.create_care_obligation(UUID,TEXT,TEXT,TEXT,TEXT,UUID,INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_care_obligation(UUID,TEXT,TEXT,TEXT,TEXT,UUID,INTEGER) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Evidence submission is always pending review; no client lifecycle override.
--    Requires a real object in the private bucket for E1 evidence.
-- -----------------------------------------------------------------------------
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
  v_submitter_id UUID;
  v_submitter_facility TEXT;
  v_submitter_role TEXT;
  v_obligation kernel_domain.bitemporal_obligations%ROWTYPE;
  v_evidence_id UUID;
BEGIN
  SELECT p.id, p.facility_id, p.role::text
  INTO v_submitter_id, v_submitter_facility, v_submitter_role
  FROM hr_domain.staff_profiles p
  WHERE p.user_id = auth.uid() AND p.is_active = true
  LIMIT 1;

  IF v_submitter_id IS NULL OR v_submitter_role <> 'caregiver' THEN
    RAISE EXCEPTION 'Hanya caregiver dengan profil aktif yang boleh mengirim bukti.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_obligation
  FROM kernel_domain.bitemporal_obligations o
  WHERE o.id = p_obligation_id
    AND o.facility_id = v_submitter_facility
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tugas tidak ditemukan atau berbeda fasilitas.' USING ERRCODE = 'P0002';
  END IF;

  IF v_obligation.assigned_caregiver_id IS NULL OR v_obligation.assigned_caregiver_id <> v_submitter_id THEN
    RAISE EXCEPTION 'Caregiver bukan penanggung jawab tugas ini.' USING ERRCODE = '42501';
  END IF;
  IF v_obligation.status IN ('closed', 'verified_closed', 'canceled') THEN
    RAISE EXCEPTION 'Tugas sudah ditutup atau dibatalkan.' USING ERRCODE = '23505';
  END IF;
  IF p_evidence_grade NOT IN ('E0', 'E1', 'E2', 'E3') THEN
    RAISE EXCEPTION 'Evidence grade tidak valid.' USING ERRCODE = '22023';
  END IF;

  IF p_evidence_grade = 'E1' THEN
    IF NULLIF(p_storage_url, '') IS NULL
      OR NULLIF(p_evidence_payload->>'sha256_hash', '') IS NULL
      OR left(p_storage_url, length(v_submitter_facility || '/' || p_obligation_id::text || '/')) <> (v_submitter_facility || '/' || p_obligation_id::text || '/') THEN
      RAISE EXCEPTION 'Bukti E1 harus mempunyai objek privat dan SHA-256 yang terikat pada tugas/fasilitas.' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM storage.objects so
      WHERE so.bucket_id = 'private-care-evidence' AND so.name = p_storage_url
    ) THEN
      RAISE EXCEPTION 'Objek bukti tidak ditemukan pada private-care-evidence.' USING ERRCODE = '23514';
    END IF;
  END IF;

  INSERT INTO kernel_domain.evidence_verifications (
    obligation_id, submitter_id, evidence_grade, evidence_payload,
    storage_url, verifier_status, facility_id
  ) VALUES (
    p_obligation_id,
    v_submitter_id,
    p_evidence_grade,
    COALESCE(p_evidence_payload, '{}'::jsonb) || jsonb_build_object('lifecycle_status', 'pending_review'),
    p_storage_url,
    'pending_review',
    v_submitter_facility
  ) RETURNING id INTO v_evidence_id;

  UPDATE kernel_domain.bitemporal_obligations
  SET status = 'evidence_submitted', evidence_submitted = TRUE
  WHERE id = p_obligation_id AND facility_id = v_submitter_facility;

  INSERT INTO audit_domain.audit_trail (
    facility_id, actor_id, gateway_tag, action_name, payload
  ) VALUES (
    v_submitter_facility,
    v_submitter_id,
    '[RPC] Evidence Submission Gate',
    'EVIDENCE_SUBMITTED_PENDING_REVIEW',
    jsonb_build_object('evidence_id', v_evidence_id, 'obligation_id', p_obligation_id, 'submitter_id', v_submitter_id)
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'evidence_id', v_evidence_id,
    'obligation_id', p_obligation_id,
    'lifecycle_status', 'pending_review'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_submit_evidence_and_close_obligation(UUID,TEXT,JSONB,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_submit_evidence_and_close_obligation(UUID,TEXT,JSONB,TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Single supervisor authority gate for approval, rejection and resubmission.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_obligation_evidence(
  p_evidence_id UUID,
  p_obligation_id UUID,
  p_decision TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_supervisor_id UUID;
  v_facility_id TEXT;
  v_role TEXT;
  v_obligation kernel_domain.bitemporal_obligations%ROWTYPE;
  v_evidence kernel_domain.evidence_verifications%ROWTYPE;
  v_envelope_id UUID;
  v_evidence_status TEXT;
  v_obligation_status TEXT;
BEGIN
  SELECT p.id, p.facility_id, p.role::text
  INTO v_supervisor_id, v_facility_id, v_role
  FROM hr_domain.staff_profiles p
  WHERE p.user_id = auth.uid() AND p.is_active = true
  LIMIT 1;

  IF v_supervisor_id IS NULL OR v_role <> 'supervisor' OR v_facility_id IS NULL THEN
    RAISE EXCEPTION 'Hanya supervisor aktif pada fasilitas yang sama yang dapat meninjau bukti.' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected', 'resubmission_required') THEN
    RAISE EXCEPTION 'Keputusan tinjauan tidak valid.' USING ERRCODE = '22023';
  END IF;
  IF p_decision IN ('rejected', 'resubmission_required') AND NULLIF(BTRIM(p_rejection_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Alasan penolakan/perbaikan wajib diisi.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_obligation
  FROM kernel_domain.bitemporal_obligations o
  WHERE o.id = p_obligation_id AND o.facility_id = v_facility_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tugas tidak ditemukan atau berbeda fasilitas.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_evidence
  FROM kernel_domain.evidence_verifications e
  WHERE e.id = p_evidence_id
    AND e.obligation_id = p_obligation_id
    AND e.facility_id = v_facility_id
    AND e.verifier_status = 'pending_review'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bukti tidak ditemukan, tidak cocok dengan tugas, atau bukan pending_review.' USING ERRCODE = '23514';
  END IF;

  IF p_decision = 'approved' THEN
    IF v_evidence.evidence_grade = 'E1' THEN
      IF NULLIF(v_evidence.storage_url, '') IS NULL
        OR NULLIF(v_evidence.evidence_payload->>'sha256_hash', '') IS NULL
        OR NOT EXISTS (SELECT 1 FROM storage.objects so
          WHERE so.bucket_id = 'private-care-evidence' AND so.name = v_evidence.storage_url) THEN
        RAISE EXCEPTION 'Bukti E1 tidak mempunyai objek privat yang tersedia dan SHA-256.' USING ERRCODE = '23514';
      END IF;
    END IF;

    INSERT INTO kernel_domain.authority_envelopes (
      action_type, envelope_level, requires_human_approval, approved_by, approval_status
    ) VALUES (
      'obligation_closure', 'A3', TRUE, v_supervisor_id, 'approved'
    ) RETURNING id INTO v_envelope_id;

    v_evidence_status := 'approved';
    v_obligation_status := 'verified_closed';
    UPDATE kernel_domain.evidence_verifications
    SET verifier_status = v_evidence_status,
        verifier_notes = 'Disetujui supervisor melalui authority gate.',
        verified_at = NOW()
    WHERE id = p_evidence_id AND facility_id = v_facility_id;

    UPDATE kernel_domain.bitemporal_obligations
    SET status = v_obligation_status, evidence_submitted = TRUE
    WHERE id = p_obligation_id AND facility_id = v_facility_id
    RETURNING * INTO v_obligation;
  ELSE
    v_evidence_status := p_decision;
    v_obligation_status := 'open';
    UPDATE kernel_domain.evidence_verifications
    SET verifier_status = v_evidence_status,
        rejection_reason = LEFT(BTRIM(p_rejection_reason), 1000),
        verifier_notes = LEFT(BTRIM(p_rejection_reason), 1000),
        verified_at = NOW()
    WHERE id = p_evidence_id AND facility_id = v_facility_id;

    UPDATE kernel_domain.bitemporal_obligations
    SET status = v_obligation_status, evidence_submitted = FALSE
    WHERE id = p_obligation_id AND facility_id = v_facility_id
    RETURNING * INTO v_obligation;
  END IF;

  INSERT INTO audit_domain.audit_trail (
    facility_id, actor_id, gateway_tag, action_name, payload
  ) VALUES (
    v_facility_id,
    v_supervisor_id,
    '[RPC] Human Evidence Authority Gate',
    'EVIDENCE_SUPERVISOR_' || upper(p_decision),
    jsonb_build_object(
      'evidence_id', p_evidence_id,
      'obligation_id', p_obligation_id,
      'decision', p_decision,
      'rejection_reason', p_rejection_reason,
      'authority_envelope_id', v_envelope_id
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'evidence_id', p_evidence_id,
    'obligation', to_jsonb(v_obligation),
    'evidence_status', v_evidence_status,
    'obligation_status', v_obligation_status,
    'authority_envelope_id', v_envelope_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_obligation_evidence(UUID,UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_obligation_evidence(UUID,UUID,TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_obligation_closure(p_obligation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_facility_id TEXT;
  v_role TEXT;
  v_evidence_id UUID;
BEGIN
  SELECT p.facility_id, p.role::text INTO v_facility_id, v_role
  FROM hr_domain.staff_profiles p
  WHERE p.user_id = auth.uid() AND p.is_active = true
  LIMIT 1;
  IF v_role <> 'supervisor' OR v_facility_id IS NULL THEN
    RAISE EXCEPTION 'Hanya supervisor aktif yang dapat menyetujui penutupan tugas.' USING ERRCODE = '42501';
  END IF;

  SELECT e.id INTO v_evidence_id
  FROM kernel_domain.evidence_verifications e
  JOIN kernel_domain.bitemporal_obligations o ON o.id = e.obligation_id
  WHERE e.obligation_id = p_obligation_id
    AND e.facility_id = v_facility_id
    AND o.facility_id = v_facility_id
    AND e.verifier_status = 'pending_review'
  ORDER BY e.sys_created_at DESC
  LIMIT 1;
  IF v_evidence_id IS NULL THEN
    RAISE EXCEPTION 'Tidak ada bukti pending_review pada fasilitas supervisor.' USING ERRCODE = '23514';
  END IF;

  RETURN public.review_obligation_evidence(v_evidence_id, p_obligation_id, 'approved', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_obligation_closure(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_obligation_closure(UUID) TO authenticated;

-- Notification inbox is account-scoped. Role labels are not a substitute for recipient identity.
DROP POLICY IF EXISTS "Tenant strict policy for notifications_delete" ON public.notifications;
CREATE POLICY "Tenant strict policy for notifications_delete"
ON public.notifications FOR DELETE TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND recipient_user_id = auth.uid()
);

-- Notification inbox is account-scoped. Role labels are not a substitute for recipient identity.
DROP POLICY IF EXISTS "Tenant strict policy for notifications_select" ON public.notifications;
CREATE POLICY "Tenant strict policy for notifications_select"
ON public.notifications FOR SELECT TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND recipient_user_id = auth.uid()
);

DROP POLICY IF EXISTS "Tenant strict policy for notifications_update" ON public.notifications;
CREATE POLICY "Tenant strict policy for notifications_update"
ON public.notifications FOR UPDATE TO authenticated
USING (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND recipient_user_id = auth.uid()
)
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND recipient_user_id = auth.uid()
);

DROP POLICY IF EXISTS "Tenant strict policy for notifications_insert" ON public.notifications;
CREATE POLICY "Tenant strict policy for notifications_insert"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  public.current_sj_facility_id() IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND recipient_user_id IS NOT NULL
);

-- -----------------------------------------------------------------------------
-- 4. Remove legacy policies from pre-tenant migration. PostgreSQL permissive
-- policies combine with OR; keeping these beside tenant policies weakens them.
-- Current named "Tenant strict policy ..." policies are preserved.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  legacy RECORD;
BEGIN
  FOR legacy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE (schemaname, tablename, policyname) IN (
      ('hr_domain','staff_profiles','staff_profiles_read'),
      ('hr_domain','staff_profiles','staff_profiles_admin_update'),
      ('resident_domain','residents','residents_authorized_read'),
      ('resident_domain','residents','residents_admin_insert'),
      ('resident_domain','residents','residents_admin_update'),
      ('kernel_domain','bitemporal_obligations','obligations_staff_family_read'),
      ('kernel_domain','bitemporal_obligations','obligations_staff_insert'),
      ('kernel_domain','bitemporal_obligations','obligations_supervisor_update'),
      ('kernel_domain','epistemic_facts','facts_staff_read'),
      ('kernel_domain','epistemic_facts','facts_staff_insert'),
      ('kernel_domain','evidence_verifications','evidence_staff_read'),
      ('kernel_domain','evidence_verifications','evidence_submit_own'),
      ('kernel_domain','evidence_verifications','evidence_supervisor_update'),
      ('kernel_domain','spot_challenges','challenges_supervisor_all'),
      ('kernel_domain','handover_contracts','handover_staff_read'),
      ('kernel_domain','handover_contracts','handover_create_as_sender'),
      ('kernel_domain','authority_envelopes','authority_staff_read'),
      ('audit_domain','audit_trail','audit_staff_read'),
      ('audit_domain','audit_trail','audit_staff_insert'),
      ('public','notifications','notifications_own_role_read'),
      ('public','notifications','notifications_own_role_insert'),
      ('public','notifications','notifications_role_update'),
      ('public','notifications','notifications_role_delete'),
      ('kernel_domain','care_rules','care_rules_staff_read'),
      ('kernel_domain','care_rules','care_rules_supervisor_insert'),
      ('kernel_domain','care_rules','care_rules_supervisor_update')
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', legacy.policyname, legacy.schemaname, legacy.tablename);
  END LOOP;
END;
$$;

COMMIT;
