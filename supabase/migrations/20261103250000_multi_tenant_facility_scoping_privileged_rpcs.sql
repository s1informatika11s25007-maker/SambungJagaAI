-- SambungJaga AI Migration: Multi-Tenant Facility Scoping for Privileged Security Definer RPCs
-- Resolves P0 Critical Security Vulnerability: Enforces strict facility_id matching on approve_obligation_closure and sign_handover_contract.

BEGIN;

-- Advisory lock to prevent concurrent migration collisions
SELECT pg_advisory_xact_lock(20261103250000);

-- 1. HARDENED SUPERVISOR OBLIGATION CLOSURE APPROVAL RPC
DROP FUNCTION IF EXISTS public.approve_obligation_closure(UUID);
CREATE OR REPLACE FUNCTION public.approve_obligation_closure(p_obligation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_profile_id UUID;
  v_facility_id TEXT;
  v_obligation kernel_domain.bitemporal_obligations%ROWTYPE;
  v_evidence kernel_domain.evidence_verifications%ROWTYPE;
  v_envelope_id UUID;
BEGIN
  -- Verify supervisor / admin role
  IF public.current_sj_role() NOT IN ('supervisor', 'admin_hr') THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya supervisor/admin_hr yang dapat meninjau dan menyetujui bukti.' USING ERRCODE = '42501';
  END IF;

  -- Fetch active supervisor profile and facility_id
  SELECT id, facility_id INTO v_profile_id, v_facility_id
  FROM hr_domain.staff_profiles
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF v_profile_id IS NULL OR v_facility_id IS NULL THEN
    RAISE EXCEPTION 'Akses Ditolak: Profil supervisor aktif pada fasilitas tidak ditemukan.' USING ERRCODE = '42501';
  END IF;

  -- Query obligation WITH STRICT FACILITY_ID SCOPING
  SELECT * INTO v_obligation
  FROM kernel_domain.bitemporal_obligations
  WHERE id = p_obligation_id AND facility_id = v_facility_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Akses Ditolak: Tugas tidak ditemukan atau berbeda fasilitas.' USING ERRCODE = 'P0002';
  END IF;

  IF v_obligation.status = 'closed' OR v_obligation.status = 'verified_closed' THEN
    RAISE EXCEPTION 'Tugas perawatan ini sudah ditutup sebelumnya.' USING ERRCODE = '23505';
  END IF;

  -- Query evidence WITH STRICT FACILITY_ID SCOPING
  SELECT * INTO v_evidence
  FROM kernel_domain.evidence_verifications
  WHERE obligation_id = p_obligation_id
    AND facility_id = v_facility_id
    AND verifier_status = 'pending_review'
  ORDER BY sys_created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tidak ada bukti yang menunggu tinjauan supervisor pada fasilitas ini.' USING ERRCODE = '23514';
  END IF;

  -- Create Authority Envelope
  INSERT INTO kernel_domain.authority_envelopes (
    action_type, envelope_level, requires_human_approval, approved_by, approval_status
  ) VALUES (
    'obligation_closure', 'A3', TRUE, v_profile_id, 'approved'
  ) RETURNING id INTO v_envelope_id;

  -- Update Evidence Status
  UPDATE kernel_domain.evidence_verifications
  SET verifier_status = 'approved',
      verified_at = NOW(),
      verifier_notes = 'Persetujuan A3 Supervisor diberikan via RPC'
  WHERE id = v_evidence.id AND facility_id = v_facility_id;

  -- Update Obligation Status
  UPDATE kernel_domain.bitemporal_obligations
  SET status = 'closed',
      evidence_submitted = true
  WHERE id = p_obligation_id AND facility_id = v_facility_id
  RETURNING * INTO v_obligation;

  -- Audit Trail Log
  INSERT INTO audit_domain.audit_trail(facility_id, actor_id, gateway_tag, action_name, payload)
  VALUES (
    v_facility_id,
    auth.uid(),
    '[A] P6 Authority Envelope Gate',
    'HUMAN_APPROVAL_GRANTED',
    jsonb_build_object(
      'obligation_id', p_obligation_id,
      'evidence_id', v_evidence.id,
      'authority_envelope_id', v_envelope_id,
      'facility_id', v_facility_id
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'obligation', to_jsonb(v_obligation),
    'evidence_id', v_evidence.id,
    'authority_envelope_id', v_envelope_id,
    'message', 'Persetujuan supervisor A3 berhasil dicatat dan tugas resmi ditutup.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_obligation_closure(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_obligation_closure(UUID) TO authenticated, service_role;


-- 2. HARDENED HANDOVER CONTRACT SIGNATURE RPC
DROP FUNCTION IF EXISTS public.sign_handover_contract(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.sign_handover_contract(p_contract_id UUID, p_signer_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_profile_id UUID;
  v_facility_id TEXT;
  v_contract kernel_domain.handover_contracts%ROWTYPE;
BEGIN
  IF p_signer_role NOT IN ('outgoing', 'incoming') THEN
    RAISE EXCEPTION 'Jenis penandatangan tidak valid. Gunakan outgoing atau incoming.' USING ERRCODE = '22023';
  END IF;

  -- Fetch active staff profile and facility_id
  SELECT id, facility_id INTO v_profile_id, v_facility_id
  FROM hr_domain.staff_profiles
  WHERE user_id = auth.uid() AND is_active = true;

  IF v_profile_id IS NULL OR v_facility_id IS NULL OR public.current_sj_role() NOT IN ('caregiver', 'supervisor', 'admin_hr') THEN
    RAISE EXCEPTION 'Akses Ditolak: Profil staf aktif pada fasilitas tidak ditemukan.' USING ERRCODE = '42501';
  END IF;

  -- Query handover contract WITH STRICT FACILITY_ID SCOPING
  SELECT * INTO v_contract
  FROM kernel_domain.handover_contracts
  WHERE id = p_contract_id AND facility_id = v_facility_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Akses Ditolak: Kontrak serah terima tidak ditemukan atau berbeda fasilitas.' USING ERRCODE = 'P0002';
  END IF;

  IF p_signer_role = 'outgoing' THEN
    IF v_contract.outgoing_staff_id <> v_profile_id THEN
      RAISE EXCEPTION 'Akses Ditolak: Hanya pengirim yang terdaftar dapat menandatangani sisi pengirim.' USING ERRCODE = '42501';
    END IF;
    IF v_contract.outgoing_signed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Sisi pengirim sudah ditandatangani sebelumnya.' USING ERRCODE = '23505';
    END IF;
    UPDATE kernel_domain.handover_contracts
      SET outgoing_signed_at = NOW(), contract_status = 'pending_receiver'
      WHERE id = p_contract_id AND facility_id = v_facility_id
      RETURNING * INTO v_contract;
  ELSE
    IF v_contract.incoming_staff_id <> v_profile_id THEN
      RAISE EXCEPTION 'Akses Ditolak: Hanya penerima yang terdaftar dapat menandatangani sisi penerima.' USING ERRCODE = '42501';
    END IF;
    IF v_contract.outgoing_signed_at IS NULL THEN
      RAISE EXCEPTION 'Pengirim harus menandatangani kontrak terlebih dahulu.' USING ERRCODE = '23514';
    END IF;
    IF v_contract.incoming_signed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Sisi penerima sudah ditandatangani sebelumnya.' USING ERRCODE = '23505';
    END IF;
    UPDATE kernel_domain.handover_contracts
      SET incoming_signed_at = NOW(), contract_status = 'confirmed'
      WHERE id = p_contract_id AND facility_id = v_facility_id
      RETURNING * INTO v_contract;
  END IF;

  -- Audit Trail Log
  INSERT INTO audit_domain.audit_trail(facility_id, actor_id, gateway_tag, action_name, payload)
  VALUES (
    v_facility_id,
    auth.uid(),
    '[A] Handover Contract Agent',
    'HANDOVER_SIDE_SIGNED',
    jsonb_build_object('contract_id', p_contract_id, 'signer_role', p_signer_role, 'facility_id', v_facility_id)
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'contract', to_jsonb(v_contract),
    'message', 'Tanda tangan serah terima shift berhasil dicatat.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sign_handover_contract(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sign_handover_contract(UUID, TEXT) TO authenticated, service_role;

COMMIT;
