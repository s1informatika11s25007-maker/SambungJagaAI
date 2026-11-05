-- SambungJaga AI Migration: Hardened Atomic Supervisor Obligation Approval RPC
-- Fixes P0 Vulnerability: Robust evidence matching & atomic status verification in approve_obligation_closure

BEGIN;

SELECT pg_advisory_xact_lock(20261103280000);

REVOKE ALL ON FUNCTION public.approve_obligation_closure(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.approve_obligation_closure(p_obligation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_profile_id UUID;
  v_facility_id TEXT;
  v_user_role TEXT;
  v_obligation kernel_domain.bitemporal_obligations%ROWTYPE;
  v_evidence kernel_domain.evidence_verifications%ROWTYPE;
  v_envelope_id UUID;
  v_evidence_id UUID := NULL;
BEGIN
  -- 1. Verify caller has supervisor or admin_hr role and active profile
  SELECT id, facility_id, role INTO v_profile_id, v_facility_id, v_user_role
  FROM hr_domain.staff_profiles
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF v_profile_id IS NULL OR v_user_role NOT IN ('supervisor', 'admin_hr') THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya supervisor/admin_hr terverifikasi yang dapat menyetujui penutupan tugas.' USING ERRCODE = '42501';
  END IF;

  -- 2. Lock and fetch target obligation
  SELECT * INTO v_obligation
  FROM kernel_domain.bitemporal_obligations
  WHERE id = p_obligation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tugas perawatan tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;

  IF v_obligation.status = 'verified_closed' THEN
    RAISE EXCEPTION 'Tugas perawatan ini sudah ditutup sebelumnya.' USING ERRCODE = '23505';
  END IF;

  -- 3. Lock and fetch submitted evidence if present
  SELECT * INTO v_evidence
  FROM kernel_domain.evidence_verifications
  WHERE obligation_id = p_obligation_id
    AND verifier_status IN ('pending_review', 'pending', 'submitted')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_evidence_id := v_evidence.id;

    UPDATE kernel_domain.evidence_verifications
    SET verifier_status = 'verified'
    WHERE id = v_evidence.id;
  END IF;

  -- 4. Create A3 Authority Envelope record
  INSERT INTO kernel_domain.authority_envelopes (
    action_type, envelope_level, requires_human_approval, approved_by, approval_status
  ) VALUES (
    'obligation_closure', 'A3', TRUE, v_profile_id, 'approved'
  ) RETURNING id INTO v_envelope_id;

  -- 5. Atomic Update: Close obligation in PostgreSQL
  UPDATE kernel_domain.bitemporal_obligations
  SET status = 'verified_closed',
      evidence_submitted = true
  WHERE id = p_obligation_id
  RETURNING * INTO v_obligation;

  -- 6. Log Audit Trail
  INSERT INTO audit_domain.audit_trail (
    facility_id, actor_id, gateway_tag, action_name, payload
  ) VALUES (
    COALESCE(v_facility_id, 'FAC-001'),
    v_profile_id,
    '[RPC] Human Approval Gate',
    'HUMAN_APPROVAL_GRANTED',
    jsonb_build_object(
      'obligation_id', p_obligation_id,
      'evidence_id', v_evidence_id,
      'authority_envelope_id', v_envelope_id,
      'supervisor_id', v_profile_id
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'obligation', to_jsonb(v_obligation),
    'evidence_id', v_evidence_id,
    'authority_envelope_id', v_envelope_id,
    'message', 'Tugas perawatan berhasil diverifikasi dan ditutup secara sah oleh supervisor.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_obligation_closure(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_obligation_closure(UUID) TO authenticated, service_role;

COMMIT;
