-- SambungJaga AI — Hackathon pilot hardening
-- Safe draft creation for two-sided handover and idempotent offline care-report sync.
BEGIN;
SELECT pg_advisory_xact_lock(20261107100000);

-- A handover draft must not be considered signed until the outgoing caregiver signs.
ALTER TABLE kernel_domain.handover_contracts
  ALTER COLUMN outgoing_signed_at DROP DEFAULT,
  ALTER COLUMN outgoing_signed_at DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.create_handover_contract(
  p_incoming_staff_id UUID,
  p_shift_name TEXT
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
  v_incoming hr_domain.staff_profiles%ROWTYPE;
  v_summary JSONB;
  v_contract kernel_domain.handover_contracts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan.' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(BTRIM(p_shift_name), '') IS NULL OR LENGTH(BTRIM(p_shift_name)) > 80 THEN
    RAISE EXCEPTION 'Nama shift wajib diisi (maksimal 80 karakter).' USING ERRCODE = '22023';
  END IF;

  SELECT p.id, p.facility_id, p.role::text
    INTO v_actor_id, v_facility_id, v_role
  FROM hr_domain.staff_profiles p
  WHERE p.user_id = auth.uid() AND p.is_active = TRUE
  LIMIT 1;

  IF v_actor_id IS NULL OR v_facility_id IS NULL OR v_role NOT IN ('caregiver', 'supervisor') THEN
    RAISE EXCEPTION 'Hanya caregiver/supervisor aktif dengan fasilitas terverifikasi yang dapat membuat serah terima.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_incoming
  FROM hr_domain.staff_profiles p
  WHERE p.id = p_incoming_staff_id
    AND p.facility_id = v_facility_id
    AND p.is_active = TRUE
    AND p.role::text = 'caregiver'
    AND p.shift_status = 'on_duty'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Petugas penerima tidak aktif, bukan caregiver, tidak sedang bertugas, atau berbeda fasilitas.' USING ERRCODE = '22023';
  END IF;
  IF v_incoming.id = v_actor_id THEN
    RAISE EXCEPTION 'Petugas pengirim dan penerima harus berbeda.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'resident_id', o.resident_id,
    'title', o.title,
    'status', o.status,
    'priority', o.priority,
    'valid_until', o.valid_until,
    'required_evidence_grade', o.required_evidence_grade
  ) ORDER BY o.valid_until ASC NULLS LAST), '[]'::jsonb)
  INTO v_summary
  FROM kernel_domain.bitemporal_obligations o
  WHERE o.facility_id = v_facility_id
    AND o.assigned_caregiver_id = v_actor_id
    AND o.status NOT IN ('closed', 'verified_closed');

  INSERT INTO kernel_domain.handover_contracts (
    facility_id, outgoing_staff_id, incoming_staff_id, shift_name,
    open_obligations_summary, contract_status, outgoing_signed_at, incoming_signed_at
  ) VALUES (
    v_facility_id, v_actor_id, v_incoming.id, BTRIM(p_shift_name),
    v_summary, 'draft', NULL, NULL
  ) RETURNING * INTO v_contract;

  INSERT INTO audit_domain.audit_trail (
    facility_id, actor_id, gateway_tag, action_name, payload
  ) VALUES (
    v_facility_id, v_actor_id, '[A] Handover Contract Agent', 'HANDOVER_DRAFT_CREATED',
    jsonb_build_object('contract_id', v_contract.id, 'incoming_staff_id', v_incoming.id, 'open_obligations_count', jsonb_array_length(v_summary))
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'contract', to_jsonb(v_contract),
    'message', 'Draf serah terima tersimpan. Pengirim dan penerima masih harus menandatangani secara terpisah.'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.create_handover_contract(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_handover_contract(UUID, TEXT) TO authenticated;

-- Private receipt ledger prevents duplicate fact creation when a device retries after a timeout.
CREATE TABLE IF NOT EXISTS kernel_domain.offline_sync_receipts (
  facility_id TEXT NOT NULL,
  client_submission_id UUID NOT NULL,
  resident_id UUID NOT NULL REFERENCES resident_domain.residents(id) ON DELETE CASCADE,
  fact_id UUID,
  mission_id UUID,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (facility_id, client_submission_id)
);
ALTER TABLE kernel_domain.offline_sync_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON kernel_domain.offline_sync_receipts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_offline_care_report(
  p_client_submission_id UUID,
  p_resident_id UUID,
  p_fact_value JSONB
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
  v_receipt kernel_domain.offline_sync_receipts%ROWTYPE;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NULL OR p_client_submission_id IS NULL OR p_resident_id IS NULL THEN
    RAISE EXCEPTION 'Autentikasi, client_submission_id dan resident_id wajib tersedia.' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(COALESCE(p_fact_value->>'text', '')), '') IS NULL THEN
    RAISE EXCEPTION 'Isi laporan offline tidak boleh kosong.' USING ERRCODE = '22023';
  END IF;

  SELECT p.id, p.facility_id, p.role::text
    INTO v_actor_id, v_facility_id, v_role
  FROM hr_domain.staff_profiles p
  WHERE p.user_id = auth.uid() AND p.is_active = TRUE
  LIMIT 1;
  IF v_actor_id IS NULL OR v_facility_id IS NULL OR v_role NOT IN ('caregiver', 'supervisor', 'admin_hr') THEN
    RAISE EXCEPTION 'Profil staf aktif dan fasilitas terverifikasi tidak ditemukan.' USING ERRCODE = '42501';
  END IF;

  SELECT r.facility_id INTO v_resident_facility
  FROM resident_domain.residents r
  WHERE r.id = p_resident_id;
  IF NOT FOUND OR v_resident_facility IS DISTINCT FROM v_facility_id THEN
    RAISE EXCEPTION 'Penghuni tidak ditemukan atau berbeda fasilitas.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO kernel_domain.offline_sync_receipts (facility_id, client_submission_id, resident_id)
  VALUES (v_facility_id, p_client_submission_id, p_resident_id)
  ON CONFLICT (facility_id, client_submission_id) DO NOTHING;

  SELECT * INTO v_receipt
  FROM kernel_domain.offline_sync_receipts
  WHERE facility_id = v_facility_id AND client_submission_id = p_client_submission_id
  FOR UPDATE;

  IF v_receipt.resident_id IS DISTINCT FROM p_resident_id THEN
    RAISE EXCEPTION 'Idempotency key sudah digunakan untuk penghuni yang berbeda.' USING ERRCODE = '23505';
  END IF;
  IF v_receipt.acknowledged_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', TRUE, 'acknowledged', TRUE, 'fact_id', v_receipt.fact_id, 'mission_id', v_receipt.mission_id, 'duplicate', TRUE);
  END IF;

  v_result := public.fn_record_care_fact_and_obligation(
    p_resident_id,
    'offline_caregiver_report',
    jsonb_build_object(
      'text', LEFT(p_fact_value->>'text', 4000),
      'source_type', COALESCE(NULLIF(p_fact_value->>'source_type', ''), 'text'),
      'client_created_at', p_fact_value->>'client_created_at',
      'offline_submission_id', p_client_submission_id
    ),
    'offline_sync',
    v_actor_id,
    NULL,
    NULL,
    '[]'::jsonb
  );

  UPDATE kernel_domain.offline_sync_receipts
  SET fact_id = (v_result->>'fact_id')::UUID,
      mission_id = (v_result->>'mission_id')::UUID,
      acknowledged_at = NOW()
  WHERE facility_id = v_facility_id AND client_submission_id = p_client_submission_id
  RETURNING * INTO v_receipt;

  RETURN jsonb_build_object(
    'success', TRUE,
    'acknowledged', TRUE,
    'fact_id', v_receipt.fact_id,
    'mission_id', v_receipt.mission_id,
    'duplicate', FALSE
  );
END;
$$;
REVOKE ALL ON FUNCTION public.sync_offline_care_report(UUID, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_offline_care_report(UUID, UUID, JSONB) TO authenticated;

COMMIT;
