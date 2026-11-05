-- SambungJaga AI Migration: Hardened Atomic Evidence RPC & Caregiver Assignment Verification
-- Resolves P0 Vulnerability: Client-supplied lifecycle_status override, assignment verification, & PUBLIC revocation.

BEGIN;

-- Advisory lock to prevent concurrent migration collisions
SELECT pg_advisory_xact_lock(20261103240000);

-- Revoke execution from PUBLIC
REVOKE ALL ON FUNCTION public.fn_submit_evidence_and_close_obligation(UUID, TEXT, JSONB, TEXT) FROM PUBLIC;

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
    v_submitter_role TEXT;
    v_assigned_caregiver_id UUID;
    v_lifecycle_status TEXT;
    v_requires_human BOOLEAN;
BEGIN
    -- 1. Verify staff profile of caller
    SELECT id, facility_id, role INTO v_submitter_id, v_facility_id, v_submitter_role
    FROM hr_domain.staff_profiles
    WHERE user_id = auth.uid() AND is_active = true;

    IF v_submitter_id IS NULL THEN
        RAISE EXCEPTION 'Akses Ditolak: Pengguna tidak memiliki profil staf aktif yang terverifikasi.';
    END IF;

    -- 2. Verify obligation exists and belongs to submitter facility
    SELECT facility_id, assigned_caregiver_id, requires_human_review
    INTO v_facility_id, v_assigned_caregiver_id, v_requires_human
    FROM kernel_domain.bitemporal_obligations
    WHERE id = p_obligation_id AND facility_id = v_facility_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Akses Ditolak: Kewajiban perawatan tidak ditemukan atau berbeda fasilitas.';
    END IF;

    -- 3. Verify Caregiver Task Assignment (Caregivers can only submit evidence for assigned tasks)
    IF v_submitter_role = 'caregiver' AND v_assigned_caregiver_id IS NOT NULL AND v_assigned_caregiver_id != v_submitter_id THEN
        RAISE EXCEPTION 'Akses Ditolak: Caregiver tidak dialokasikan pada kewajiban perawatan ini.';
    END IF;

    -- 4. HARDENED LIFE CYCLE STATUS: ALWAYS FORCE 'pending_review' (Ignore any client-supplied status!)
    v_lifecycle_status := 'pending_review';

    -- 5. Insert evidence verification record
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

    -- 6. Update obligation status: Set evidence_submitted and route to pending review queue
    UPDATE kernel_domain.bitemporal_obligations
    SET status = 'evidence_submitted',
        evidence_submitted = true
    WHERE id = p_obligation_id;

    -- 7. Record immutable audit trail entry
    INSERT INTO audit_domain.audit_trail (
        facility_id,
        actor_id,
        gateway_tag,
        action_name,
        payload
    ) VALUES (
        v_facility_id,
        auth.uid(),
        '[RPC] Hardened Atomic Evidence Verification',
        'EVIDENCE_SUBMITTED_PENDING_SUPERVISOR_REVIEW',
        jsonb_build_object(
            'evidence_id', v_evidence_id,
            'obligation_id', p_obligation_id,
            'submitter_id', v_submitter_id,
            'lifecycle_status', v_lifecycle_status
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'evidence_id', v_evidence_id,
        'lifecycle_status', v_lifecycle_status,
        'message', 'Bukti berhasil diunggah dan diteruskan ke Supervisor Review Queue.'
    );
END;
$$;

-- Grant execution strictly to authenticated staff and service role
REVOKE ALL ON FUNCTION public.fn_submit_evidence_and_close_obligation(UUID, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_submit_evidence_and_close_obligation(UUID, TEXT, JSONB, TEXT) TO authenticated, service_role;

COMMIT;
