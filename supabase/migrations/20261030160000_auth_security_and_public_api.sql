-- SambungJaga security + PostgREST API bridge.
-- Apply after the two existing migrations. Seed profiles do not authenticate by themselves.

CREATE TABLE IF NOT EXISTS resident_domain.family_resident_access (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES resident_domain.residents(id) ON DELETE CASCADE,
  disclosure_level TEXT NOT NULL DEFAULT 'filtered_summary'
    CHECK (disclosure_level IN ('filtered_summary', 'emergency_only')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES hr_domain.staff_profiles(id),
  PRIMARY KEY (user_id, resident_id)
);
ALTER TABLE resident_domain.family_resident_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS family_access_self_read ON resident_domain.family_resident_access;
CREATE POLICY family_access_self_read ON resident_domain.family_resident_access
  FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT ON resident_domain.family_resident_access TO authenticated;

CREATE OR REPLACE FUNCTION public.link_family_resident(
  p_user_id UUID, p_resident_id UUID, p_disclosure_level TEXT DEFAULT 'filtered_summary'
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE v_actor UUID;
BEGIN
  IF public.current_sj_role() NOT IN ('supervisor','admin_hr') THEN
    RAISE EXCEPTION 'Hanya supervisor/admin yang dapat menghubungkan akun keluarga.' USING ERRCODE = '42501';
  END IF;
  IF p_disclosure_level NOT IN ('filtered_summary','emergency_only') THEN
    RAISE EXCEPTION 'Level berbagi tidak valid.';
  END IF;
  SELECT id INTO v_actor FROM hr_domain.staff_profiles WHERE user_id = auth.uid();
  INSERT INTO resident_domain.family_resident_access(user_id, resident_id, disclosure_level, created_by)
  VALUES (p_user_id, p_resident_id, p_disclosure_level, v_actor)
  ON CONFLICT (user_id, resident_id) DO UPDATE SET disclosure_level = EXCLUDED.disclosure_level;
END;
$$;
REVOKE ALL ON FUNCTION public.link_family_resident(UUID,UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_family_resident(UUID,UUID,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.current_sj_role()
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT p.role::text
  FROM hr_domain.staff_profiles AS p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.current_sj_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_sj_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.sj_can_access_resident(p_resident_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT
    public.current_sj_role() IN ('caregiver', 'supervisor', 'admin_hr')
    OR EXISTS (
      SELECT 1 FROM resident_domain.family_resident_access AS a
      WHERE a.user_id = auth.uid() AND a.resident_id = p_resident_id
    );
$$;
REVOKE ALL ON FUNCTION public.sj_can_access_resident(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sj_can_access_resident(UUID) TO authenticated;

-- Auth sign-up can create only caregiver/family profiles. Elevated roles are assigned by an admin.
CREATE OR REPLACE FUNCTION public.handle_sambungjaga_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  v_role := CASE
    WHEN NEW.raw_user_meta_data ->> 'role' = 'family' THEN 'family'::public.user_role
    ELSE 'caregiver'::public.user_role
  END;

  INSERT INTO hr_domain.staff_profiles (user_id, full_name, role, shift_status, phone_number)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), ''), 'Pengguna SambungJaga'),
    v_role,
    'off_duty',
    NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'phone_number'), '')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_sambungjaga_auth_user_created ON auth.users;
CREATE TRIGGER on_sambungjaga_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_sambungjaga_auth_user();

-- Public, automatically-updatable views make the internal domain schemas accessible to PostgREST.
GRANT USAGE ON SCHEMA hr_domain, resident_domain, kernel_domain, audit_domain TO authenticated;

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

CREATE OR REPLACE VIEW public.staff_profiles WITH (security_invoker = true) AS
  SELECT * FROM hr_domain.staff_profiles;

CREATE OR REPLACE VIEW public.residents WITH (security_invoker = true) AS
  SELECT * FROM resident_domain.residents;

CREATE OR REPLACE VIEW public.bitemporal_obligations WITH (security_invoker = true) AS
  SELECT * FROM kernel_domain.bitemporal_obligations;

CREATE OR REPLACE VIEW public.epistemic_facts WITH (security_invoker = true) AS
  SELECT * FROM kernel_domain.epistemic_facts;

CREATE OR REPLACE VIEW public.handover_contracts WITH (security_invoker = true) AS
  SELECT * FROM kernel_domain.handover_contracts;

CREATE OR REPLACE VIEW public.evidence_verifications WITH (security_invoker = true) AS
  SELECT * FROM kernel_domain.evidence_verifications;

CREATE OR REPLACE VIEW public.spot_challenges WITH (security_invoker = true) AS
  SELECT * FROM kernel_domain.spot_challenges;

CREATE OR REPLACE VIEW public.offline_hash_chains WITH (security_invoker = true) AS
  SELECT * FROM kernel_domain.offline_hash_chains;

CREATE OR REPLACE VIEW public.authority_envelopes WITH (security_invoker = true) AS
  SELECT * FROM kernel_domain.authority_envelopes;

CREATE OR REPLACE VIEW public.audit_trail WITH (security_invoker = true) AS
  SELECT * FROM audit_domain.audit_trail;

-- Family-facing views expose only minimal identifying and activity fields.
CREATE OR REPLACE VIEW public.family_residents WITH (security_invoker = true) AS
  SELECT r.id, r.full_name, r.room_number
  FROM resident_domain.residents AS r
  JOIN resident_domain.family_resident_access AS a ON a.resident_id = r.id
  WHERE a.user_id = auth.uid();
CREATE OR REPLACE VIEW public.family_obligation_summaries WITH (security_invoker = true) AS
  SELECT o.id, o.resident_id, o.status, o.valid_from, o.valid_until, o.sys_created_at
  FROM kernel_domain.bitemporal_obligations AS o
  JOIN resident_domain.family_resident_access AS a ON a.resident_id = o.resident_id
  WHERE a.user_id = auth.uid() AND a.disclosure_level = 'filtered_summary';

GRANT SELECT ON hr_domain.staff_profiles, resident_domain.residents, kernel_domain.bitemporal_obligations,
  kernel_domain.epistemic_facts, kernel_domain.handover_contracts, kernel_domain.evidence_verifications,
  kernel_domain.spot_challenges, kernel_domain.offline_hash_chains, kernel_domain.authority_envelopes,
  audit_domain.audit_trail TO authenticated;
GRANT SELECT, UPDATE ON public.staff_profiles TO authenticated;
GRANT UPDATE ON hr_domain.staff_profiles TO authenticated;
GRANT SELECT ON public.staff_profiles, public.residents, public.bitemporal_obligations,
  public.epistemic_facts, public.handover_contracts, public.evidence_verifications,
  public.spot_challenges, public.offline_hash_chains, public.authority_envelopes,
  public.audit_trail, public.family_residents, public.family_obligation_summaries TO authenticated;
GRANT INSERT, UPDATE ON kernel_domain.bitemporal_obligations, kernel_domain.epistemic_facts,
  kernel_domain.spot_challenges TO authenticated;
GRANT INSERT ON kernel_domain.handover_contracts, kernel_domain.evidence_verifications TO authenticated;
GRANT INSERT ON audit_domain.audit_trail TO authenticated;
GRANT INSERT, UPDATE ON public.bitemporal_obligations, public.epistemic_facts TO authenticated;
GRANT INSERT ON public.handover_contracts, public.evidence_verifications, public.spot_challenges TO authenticated;
GRANT INSERT ON public.audit_trail TO authenticated;
GRANT INSERT ON public.notifications TO authenticated;
GRANT UPDATE, DELETE ON public.notifications TO authenticated;

-- Replace permissive development policies with role- and relationship-based access.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE (schemaname, tablename) IN (
      ('hr_domain','staff_profiles'), ('resident_domain','residents'),
      ('kernel_domain','epistemic_facts'), ('kernel_domain','bitemporal_obligations'),
      ('kernel_domain','evidence_verifications'), ('audit_domain','audit_trail'),
      ('public','notifications')
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

DROP POLICY IF EXISTS staff_profiles_read ON hr_domain.staff_profiles;
CREATE POLICY staff_profiles_read ON hr_domain.staff_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_sj_role() IN ('caregiver','supervisor','admin_hr'));

DROP POLICY IF EXISTS staff_profiles_admin_update ON hr_domain.staff_profiles;
CREATE POLICY staff_profiles_admin_update ON hr_domain.staff_profiles FOR UPDATE TO authenticated
  USING (public.current_sj_role() IN ('supervisor','admin_hr'))
  WITH CHECK (public.current_sj_role() IN ('supervisor','admin_hr'));

DROP POLICY IF EXISTS residents_authorized_read ON resident_domain.residents;
CREATE POLICY residents_authorized_read ON resident_domain.residents FOR SELECT TO authenticated
  USING (public.sj_can_access_resident(id));

DROP POLICY IF EXISTS residents_admin_insert ON resident_domain.residents;
CREATE POLICY residents_admin_insert ON resident_domain.residents FOR INSERT TO authenticated
  WITH CHECK (public.current_sj_role() IN ('supervisor','admin_hr'));

DROP POLICY IF EXISTS residents_admin_update ON resident_domain.residents;
CREATE POLICY residents_admin_update ON resident_domain.residents FOR UPDATE TO authenticated
  USING (public.current_sj_role() IN ('supervisor','admin_hr'))
  WITH CHECK (public.current_sj_role() IN ('supervisor','admin_hr'));

DROP POLICY IF EXISTS obligations_staff_family_read ON kernel_domain.bitemporal_obligations;
CREATE POLICY obligations_staff_family_read ON kernel_domain.bitemporal_obligations FOR SELECT TO authenticated
  USING (public.sj_can_access_resident(resident_id));

DROP POLICY IF EXISTS obligations_staff_insert ON kernel_domain.bitemporal_obligations;
CREATE POLICY obligations_staff_insert ON kernel_domain.bitemporal_obligations FOR INSERT TO authenticated
  WITH CHECK (public.current_sj_role() IN ('caregiver','supervisor','admin_hr'));

DROP POLICY IF EXISTS obligations_supervisor_update ON kernel_domain.bitemporal_obligations;
CREATE POLICY obligations_supervisor_update ON kernel_domain.bitemporal_obligations FOR UPDATE TO authenticated
  USING (public.current_sj_role() IN ('supervisor','admin_hr') OR assigned_caregiver_id = (
    SELECT p.id FROM hr_domain.staff_profiles p WHERE p.user_id = auth.uid()
  ))
  WITH CHECK (public.current_sj_role() IN ('caregiver','supervisor','admin_hr'));

DROP POLICY IF EXISTS facts_staff_read ON kernel_domain.epistemic_facts;
CREATE POLICY facts_staff_read ON kernel_domain.epistemic_facts FOR SELECT TO authenticated
  USING (public.current_sj_role() IN ('caregiver','supervisor','admin_hr'));

DROP POLICY IF EXISTS facts_staff_insert ON kernel_domain.epistemic_facts;
CREATE POLICY facts_staff_insert ON kernel_domain.epistemic_facts FOR INSERT TO authenticated
  WITH CHECK (public.current_sj_role() IN ('caregiver','supervisor','admin_hr'));

DROP POLICY IF EXISTS evidence_staff_read ON kernel_domain.evidence_verifications;
CREATE POLICY evidence_staff_read ON kernel_domain.evidence_verifications FOR SELECT TO authenticated
  USING (public.current_sj_role() IN ('caregiver','supervisor','admin_hr'));

DROP POLICY IF EXISTS evidence_submit_own ON kernel_domain.evidence_verifications;
CREATE POLICY evidence_submit_own ON kernel_domain.evidence_verifications FOR INSERT TO authenticated
  WITH CHECK (submitter_id = (SELECT p.id FROM hr_domain.staff_profiles p WHERE p.user_id = auth.uid())
    AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr'));

DROP POLICY IF EXISTS evidence_supervisor_update ON kernel_domain.evidence_verifications;
CREATE POLICY evidence_supervisor_update ON kernel_domain.evidence_verifications FOR UPDATE TO authenticated
  USING (public.current_sj_role() IN ('supervisor','admin_hr'))
  WITH CHECK (public.current_sj_role() IN ('supervisor','admin_hr'));

DROP POLICY IF EXISTS challenges_supervisor_all ON kernel_domain.spot_challenges;
CREATE POLICY challenges_supervisor_all ON kernel_domain.spot_challenges FOR ALL TO authenticated
  USING (public.current_sj_role() IN ('supervisor','admin_hr'))
  WITH CHECK (public.current_sj_role() IN ('supervisor','admin_hr'));

ALTER TABLE kernel_domain.handover_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel_domain.spot_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel_domain.offline_hash_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel_domain.authority_envelopes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS handover_staff_read ON kernel_domain.handover_contracts;
CREATE POLICY handover_staff_read ON kernel_domain.handover_contracts FOR SELECT TO authenticated
  USING (public.current_sj_role() IN ('caregiver','supervisor','admin_hr'));

DROP POLICY IF EXISTS handover_create_as_sender ON kernel_domain.handover_contracts;
CREATE POLICY handover_create_as_sender ON kernel_domain.handover_contracts FOR INSERT TO authenticated
  WITH CHECK (outgoing_staff_id = (SELECT p.id FROM hr_domain.staff_profiles p WHERE p.user_id = auth.uid())
    AND public.current_sj_role() IN ('caregiver','supervisor','admin_hr')
    AND EXISTS (SELECT 1 FROM hr_domain.staff_profiles receiver WHERE receiver.id = incoming_staff_id
      AND receiver.role = 'caregiver' AND receiver.shift_status = 'on_duty'));

DROP POLICY IF EXISTS authority_staff_read ON kernel_domain.authority_envelopes;
CREATE POLICY authority_staff_read ON kernel_domain.authority_envelopes FOR SELECT TO authenticated
  USING (public.current_sj_role() IN ('caregiver','supervisor','admin_hr'));

DROP POLICY IF EXISTS audit_staff_read ON audit_domain.audit_trail;
CREATE POLICY audit_staff_read ON audit_domain.audit_trail FOR SELECT TO authenticated
  USING (public.current_sj_role() IN ('caregiver','supervisor','admin_hr'));

DROP POLICY IF EXISTS audit_staff_insert ON audit_domain.audit_trail;
CREATE POLICY audit_staff_insert ON audit_domain.audit_trail FOR INSERT TO authenticated
  WITH CHECK (public.current_sj_role() IN ('caregiver','supervisor','admin_hr'));

DROP POLICY IF EXISTS notifications_own_role_read ON public.notifications;
CREATE POLICY notifications_own_role_read ON public.notifications FOR SELECT TO authenticated
  USING (recipient_role = public.current_sj_role());

DROP POLICY IF EXISTS notifications_own_role_insert ON public.notifications;
CREATE POLICY notifications_own_role_insert ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (recipient_role = public.current_sj_role() OR (public.current_sj_role() = 'caregiver' AND recipient_role = 'supervisor') OR public.current_sj_role() IN ('supervisor','admin_hr'));

DROP POLICY IF EXISTS notifications_role_update ON public.notifications;
CREATE POLICY notifications_role_update ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_role = public.current_sj_role() OR public.current_sj_role() IN ('supervisor','admin_hr'))
  WITH CHECK (recipient_role = public.current_sj_role() OR (public.current_sj_role() = 'caregiver' AND recipient_role = 'supervisor') OR public.current_sj_role() IN ('supervisor','admin_hr'));

DROP POLICY IF EXISTS notifications_role_delete ON public.notifications;
CREATE POLICY notifications_role_delete ON public.notifications FOR DELETE TO authenticated
  USING (recipient_role = public.current_sj_role() OR public.current_sj_role() IN ('supervisor','admin_hr'));


ALTER TABLE kernel_domain.handover_contracts ALTER COLUMN outgoing_signed_at DROP NOT NULL;

CREATE OR REPLACE FUNCTION kernel_domain.refresh_handover_integrity_digest()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.hash_signature := encode(public.digest(
    concat_ws('|',
      NEW.id::text,
      NEW.outgoing_staff_id::text,
      COALESCE(NEW.incoming_staff_id::text, ''),
      NEW.shift_name,
      COALESCE(NEW.open_obligations_summary::text, '[]'),
      COALESCE(NEW.outgoing_signed_at::text, ''),
      COALESCE(NEW.incoming_signed_at::text, ''),
      NEW.contract_status
    ), 'sha256'
  ), 'hex');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_handover_integrity_digest ON kernel_domain.handover_contracts;
CREATE TRIGGER trg_handover_integrity_digest
  BEFORE INSERT OR UPDATE ON kernel_domain.handover_contracts
  FOR EACH ROW EXECUTE FUNCTION kernel_domain.refresh_handover_integrity_digest();

CREATE OR REPLACE FUNCTION public.sign_handover_contract(p_contract_id UUID, p_signer_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_profile_id UUID;
  v_contract kernel_domain.handover_contracts%ROWTYPE;
BEGIN
  IF p_signer_role NOT IN ('outgoing','incoming') THEN
    RAISE EXCEPTION 'Jenis penandatangan tidak valid.' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_profile_id FROM hr_domain.staff_profiles WHERE user_id = auth.uid();
  IF v_profile_id IS NULL OR public.current_sj_role() NOT IN ('caregiver','supervisor','admin_hr') THEN
    RAISE EXCEPTION 'Akun tidak memiliki profil staf yang sah.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_contract FROM kernel_domain.handover_contracts WHERE id = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kontrak tidak ditemukan.' USING ERRCODE = 'P0002'; END IF;

  IF p_signer_role = 'outgoing' THEN
    IF v_contract.outgoing_staff_id <> v_profile_id THEN
      RAISE EXCEPTION 'Hanya pengirim yang terdaftar dapat menandatangani sisi pengirim.' USING ERRCODE = '42501';
    END IF;
    IF v_contract.outgoing_signed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Sisi pengirim sudah ditandatangani.' USING ERRCODE = '23505';
    END IF;
    UPDATE kernel_domain.handover_contracts
      SET outgoing_signed_at = NOW(), contract_status = 'pending_receiver'
      WHERE id = p_contract_id RETURNING * INTO v_contract;
  ELSE
    IF v_contract.incoming_staff_id <> v_profile_id THEN
      RAISE EXCEPTION 'Hanya penerima yang terdaftar dapat menandatangani sisi penerima.' USING ERRCODE = '42501';
    END IF;
    IF v_contract.outgoing_signed_at IS NULL THEN
      RAISE EXCEPTION 'Pengirim harus menandatangani kontrak terlebih dahulu.' USING ERRCODE = '23514';
    END IF;
    IF v_contract.incoming_signed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Sisi penerima sudah ditandatangani.' USING ERRCODE = '23505';
    END IF;
    UPDATE kernel_domain.handover_contracts
      SET incoming_signed_at = NOW(), contract_status = 'confirmed'
      WHERE id = p_contract_id RETURNING * INTO v_contract;
  END IF;

  INSERT INTO audit_domain.audit_trail(actor_id, gateway_tag, action_name, payload)
  VALUES (v_profile_id, '[A] Handover Contract Agent', 'HANDOVER_SIDE_SIGNED',
    jsonb_build_object('contract_id', p_contract_id, 'signer_role', p_signer_role));
  RETURN jsonb_build_object('success', TRUE, 'contract', to_jsonb(v_contract));
END;
$$;
REVOKE ALL ON FUNCTION public.sign_handover_contract(UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sign_handover_contract(UUID,TEXT) TO authenticated;

-- Rule library records are persisted in the database; only supervisors/admins govern rules.
CREATE TABLE IF NOT EXISTS kernel_domain.care_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1.0.0',
  title TEXT NOT NULL,
  expression TEXT NOT NULL,
  priority obligation_priority NOT NULL DEFAULT 'important',
  evidence_grade TEXT NOT NULL DEFAULT 'E1' CHECK (evidence_grade IN ('E0','E1','E2','E3')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by TEXT,
  created_by UUID REFERENCES hr_domain.staff_profiles(id),
  supersedes_id UUID REFERENCES kernel_domain.care_rules(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE kernel_domain.care_rules ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA kernel_domain TO authenticated;
CREATE INDEX IF NOT EXISTS idx_care_rules_status_created ON kernel_domain.care_rules(status, created_at DESC);

DROP POLICY IF EXISTS care_rules_staff_read ON kernel_domain.care_rules;
CREATE POLICY care_rules_staff_read ON kernel_domain.care_rules FOR SELECT TO authenticated
  USING (public.current_sj_role() IN ('caregiver','supervisor','admin_hr'));

DROP POLICY IF EXISTS care_rules_supervisor_insert ON kernel_domain.care_rules;
CREATE POLICY care_rules_supervisor_insert ON kernel_domain.care_rules FOR INSERT TO authenticated
  WITH CHECK (public.current_sj_role() IN ('supervisor','admin_hr'));

DROP POLICY IF EXISTS care_rules_supervisor_update ON kernel_domain.care_rules;
CREATE POLICY care_rules_supervisor_update ON kernel_domain.care_rules FOR UPDATE TO authenticated
  USING (public.current_sj_role() IN ('supervisor','admin_hr'))
  WITH CHECK (public.current_sj_role() IN ('supervisor','admin_hr'));
CREATE OR REPLACE VIEW public.care_rules WITH (security_invoker = true) AS
  SELECT * FROM kernel_domain.care_rules;
GRANT SELECT, INSERT, UPDATE ON kernel_domain.care_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.care_rules TO authenticated;

-- An AI-generated narrative cannot close an obligation. Closure remains in the evidence workflow.
ALTER TABLE kernel_domain.bitemporal_obligations
  ADD COLUMN IF NOT EXISTS requires_human_review BOOLEAN NOT NULL DEFAULT TRUE;

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
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_fact_id UUID;
  v_new_ob_count INTEGER := 0;
  v_mission_id UUID := gen_random_uuid();
  v_prop JSONB;
  v_priority public.obligation_priority;
BEGIN
  INSERT INTO kernel_domain.epistemic_facts (
    resident_id, fact_key, fact_value, status, confidence_score, source_type, source_actor_id, observed_at
  ) VALUES (
    p_resident_id, p_fact_key, COALESCE(p_fact_value, '{}'::jsonb), 'reported', 0.70,
    COALESCE(NULLIF(p_source_type,''), 'human_report'), p_source_actor_id, NOW()
  ) RETURNING id INTO v_fact_id;

  IF jsonb_typeof(COALESCE(p_proposed_obligations, '[]'::jsonb)) = 'array' THEN
    FOR v_prop IN SELECT value FROM jsonb_array_elements(COALESCE(p_proposed_obligations, '[]'::jsonb))
    LOOP
      v_priority := CASE
        WHEN v_prop->>'priority' IN ('emergency','critical','important','routine')
          THEN (v_prop->>'priority')::public.obligation_priority
        WHEN v_prop->>'priority' = 'urgent' THEN 'important'::public.obligation_priority
        ELSE 'routine'::public.obligation_priority
      END;
      IF NULLIF(BTRIM(v_prop->>'title'), '') IS NULL THEN CONTINUE; END IF;
      INSERT INTO kernel_domain.bitemporal_obligations (
        mission_id, resident_id, title, description, assigned_caregiver_id, priority, status,
        valid_from, valid_until, required_evidence_grade, requires_human_review
      ) VALUES (
        v_mission_id, p_resident_id, LEFT(BTRIM(v_prop->>'title'), 180),
        LEFT(COALESCE(v_prop->>'description','Menunggu tinjauan petugas berwenang.'), 1200),
        p_source_actor_id, v_priority, 'open', NOW(),
        NOW() + make_interval(mins => GREATEST(5, LEAST(CASE
          WHEN COALESCE(v_prop->>'valid_until_minutes','') ~ '^[0-9]{1,4}$'
            THEN (v_prop->>'valid_until_minutes')::INTEGER
          ELSE 120 END, 1440))),
        CASE WHEN v_prop->>'required_evidence_grade' IN ('E0','E1','E2','E3') THEN v_prop->>'required_evidence_grade' ELSE 'E1' END,
        TRUE
      );
      v_new_ob_count := v_new_ob_count + 1;
    END LOOP;
  END IF;

  INSERT INTO audit_domain.audit_trail (actor_id, gateway_tag, action_name, payload)
  VALUES (
    p_source_actor_id, '[A] Perception & Obligation Gateway', 'FACT_AND_OBLIGATION_RECORDED',
    jsonb_build_object('fact_id', v_fact_id, 'fact_key', p_fact_key,
      'new_obligations_created', v_new_ob_count, 'mission_id', v_mission_id,
      'closure_requested_but_not_performed', p_close_obligation_id IS NOT NULL)
  );

  RETURN jsonb_build_object(
    'success', TRUE, 'fact_id', v_fact_id, 'closed_obligation_id', NULL,
    'closed_obligation_title', NULL, 'new_obligations_count', v_new_ob_count,
    'mission_id', v_mission_id, 'requires_human_review', TRUE
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
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_actor UUID;
BEGIN
  IF public.current_sj_role() NOT IN ('caregiver','supervisor','admin_hr') THEN
    RAISE EXCEPTION 'Akses tidak diizinkan untuk mencatat observasi.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.sj_can_access_resident(p_resident_id) THEN
    RAISE EXCEPTION 'Akses ke profil penghuni tidak diizinkan.' USING ERRCODE = '42501';
  END IF;
  SELECT p.id INTO v_actor FROM hr_domain.staff_profiles p WHERE p.user_id = auth.uid();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Profil pengguna belum tersedia.'; END IF;

  RETURN kernel_domain.fn_record_care_fact_and_obligation(
    p_resident_id, p_fact_key, p_fact_value, p_source_type, v_actor,
    NULL, NULL, p_proposed_obligations
  );
END;
$$;
REVOKE ALL ON FUNCTION kernel_domain.fn_record_care_fact_and_obligation(UUID,TEXT,JSONB,TEXT,UUID,UUID,TEXT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_record_care_fact_and_obligation(UUID,TEXT,JSONB,TEXT,UUID,UUID,TEXT,JSONB) TO authenticated;

-- Realtime subscriptions must refer to their actual schema/table, not views.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='kernel_domain' AND tablename='handover_contracts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE kernel_domain.handover_contracts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;


-- Atomic supervisor review: do not expose direct client writes to authority envelopes.
CREATE OR REPLACE FUNCTION public.approve_obligation_closure(p_obligation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_profile_id UUID;
  v_obligation kernel_domain.bitemporal_obligations%ROWTYPE;
  v_evidence kernel_domain.evidence_verifications%ROWTYPE;
  v_envelope_id UUID;
BEGIN
  IF public.current_sj_role() NOT IN ('supervisor','admin_hr') THEN
    RAISE EXCEPTION 'Hanya supervisor/admin yang dapat meninjau bukti.' USING ERRCODE = '42501';
  END IF;

  SELECT p.id INTO v_profile_id
  FROM hr_domain.staff_profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profil supervisor tidak ditemukan.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_obligation
  FROM kernel_domain.bitemporal_obligations
  WHERE id = p_obligation_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tugas tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;
  IF v_obligation.status = 'verified_closed' THEN
    RAISE EXCEPTION 'Tugas sudah ditutup.' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_evidence
  FROM kernel_domain.evidence_verifications
  WHERE obligation_id = p_obligation_id
    AND verifier_status = 'pending_review'
  ORDER BY verified_at DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tidak ada bukti yang menunggu tinjauan.' USING ERRCODE = '23514';
  END IF;
  IF v_evidence.evidence_grade = 'E1'
     AND NULLIF(v_evidence.evidence_payload->>'photo_hash','') IS NULL THEN
    RAISE EXCEPTION 'Bukti E1 tidak memiliki sidik-jari foto.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO kernel_domain.authority_envelopes (
    action_type, envelope_level, requires_human_approval, approved_by, approval_status
  ) VALUES (
    'obligation_closure', 'A3', TRUE, v_profile_id, 'approved'
  ) RETURNING id INTO v_envelope_id;

  UPDATE kernel_domain.evidence_verifications
  SET verifier_status = 'verified'
  WHERE id = v_evidence.id;

  UPDATE kernel_domain.bitemporal_obligations
  SET status = 'verified_closed'
  WHERE id = p_obligation_id
  RETURNING * INTO v_obligation;

  INSERT INTO audit_domain.audit_trail(actor_id, gateway_tag, action_name, payload)
  VALUES (
    v_profile_id,
    '[A] P6 Authority Envelope Gate',
    'HUMAN_APPROVAL_GRANTED',
    jsonb_build_object(
      'obligation_id', p_obligation_id,
      'evidence_id', v_evidence.id,
      'authority_envelope_id', v_envelope_id
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'obligation', to_jsonb(v_obligation),
    'evidence_id', v_evidence.id,
    'authority_envelope_id', v_envelope_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.approve_obligation_closure(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_obligation_closure(UUID) TO authenticated;
