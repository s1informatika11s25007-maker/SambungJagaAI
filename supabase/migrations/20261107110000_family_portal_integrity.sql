-- Family portal integrity: persist disclosure acknowledgements and tighten tenant links.
BEGIN;
SELECT pg_advisory_xact_lock(20261107110000);

CREATE TABLE IF NOT EXISTS public.family_disclosure_receipts (
  family_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_id TEXT NOT NULL,
  resident_id UUID NOT NULL REFERENCES resident_domain.residents(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (family_user_id, digest_id)
);
ALTER TABLE public.family_disclosure_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_disclosure_receipts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.family_disclosure_receipts TO authenticated;

DROP POLICY IF EXISTS family_disclosure_receipts_select_own ON public.family_disclosure_receipts;
CREATE POLICY family_disclosure_receipts_select_own
ON public.family_disclosure_receipts FOR SELECT TO authenticated
USING (
  family_user_id = auth.uid()
  AND facility_id = public.current_sj_facility_id()
  AND EXISTS (
    SELECT 1 FROM resident_domain.family_resident_access a
    WHERE a.user_id = auth.uid() AND a.resident_id = family_disclosure_receipts.resident_id
  )
);

DROP POLICY IF EXISTS family_disclosure_receipts_insert_own ON public.family_disclosure_receipts;
CREATE POLICY family_disclosure_receipts_insert_own
ON public.family_disclosure_receipts FOR INSERT TO authenticated
WITH CHECK (
  family_user_id = auth.uid()
  AND facility_id = public.current_sj_facility_id()
  AND EXISTS (
    SELECT 1 FROM resident_domain.residents r
    JOIN resident_domain.family_resident_access a ON a.resident_id = r.id
    WHERE r.id = family_disclosure_receipts.resident_id
      AND r.facility_id = family_disclosure_receipts.facility_id
      AND a.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS family_disclosure_receipts_update_own ON public.family_disclosure_receipts;
CREATE POLICY family_disclosure_receipts_update_own
ON public.family_disclosure_receipts FOR UPDATE TO authenticated
USING (
  family_user_id = auth.uid()
  AND facility_id = public.current_sj_facility_id()
  AND EXISTS (
    SELECT 1 FROM resident_domain.family_resident_access a
    WHERE a.user_id = auth.uid() AND a.resident_id = family_disclosure_receipts.resident_id
  )
)
WITH CHECK (
  family_user_id = auth.uid()
  AND facility_id = public.current_sj_facility_id()
  AND EXISTS (
    SELECT 1 FROM resident_domain.residents r
    JOIN resident_domain.family_resident_access a ON a.resident_id = r.id
    WHERE r.id = family_disclosure_receipts.resident_id
      AND r.facility_id = family_disclosure_receipts.facility_id
      AND a.user_id = auth.uid()
  )
);

-- A family account may submit only for a resident explicitly linked by facility staff.
DROP POLICY IF EXISTS "Tenant strict policy for family_visit_requests_insert" ON public.family_visit_requests;
CREATE POLICY "Tenant strict policy for family_visit_requests_insert"
ON public.family_visit_requests FOR INSERT TO authenticated
WITH CHECK (
  family_user_id = auth.uid()
  AND resident_id IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND EXISTS (
    SELECT 1 FROM resident_domain.residents r
    JOIN resident_domain.family_resident_access a ON a.resident_id = r.id
    WHERE r.id = family_visit_requests.resident_id
      AND r.facility_id = family_visit_requests.facility_id
      AND a.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Tenant strict policy for family_complaints_insert" ON public.family_complaints;
CREATE POLICY "Tenant strict policy for family_complaints_insert"
ON public.family_complaints FOR INSERT TO authenticated
WITH CHECK (
  family_user_id = auth.uid()
  AND resident_id IS NOT NULL
  AND facility_id = public.current_sj_facility_id()
  AND EXISTS (
    SELECT 1 FROM resident_domain.residents r
    JOIN resident_domain.family_resident_access a ON a.resident_id = r.id
    WHERE r.id = family_complaints.resident_id
      AND r.facility_id = family_complaints.facility_id
      AND a.user_id = auth.uid()
  )
);

-- Upsert requires INSERT permission on first save as well as UPDATE on later saves.
DROP POLICY IF EXISTS notification_preferences_insert_own ON public.notification_preferences;
CREATE POLICY notification_preferences_insert_own
ON public.notification_preferences FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND facility_id = public.current_sj_facility_id()
);

DROP POLICY IF EXISTS "Tenant strict policy for notification_preferences_update" ON public.notification_preferences;
CREATE POLICY "Tenant strict policy for notification_preferences_update"
ON public.notification_preferences FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND facility_id = public.current_sj_facility_id())
WITH CHECK (user_id = auth.uid() AND facility_id = public.current_sj_facility_id());

-- Reassert the family-specific views after the broad platform views were introduced.
-- Keep these views minimal and filter by the authenticated family link at the database layer.
CREATE OR REPLACE VIEW public.family_residents WITH (security_invoker = true) AS
SELECT
  r.id,
  r.full_name,
  r.room_number,
  r.facility_id,
  a.disclosure_level
FROM resident_domain.residents AS r
JOIN resident_domain.family_resident_access AS a ON a.resident_id = r.id
WHERE a.user_id = auth.uid()
  AND r.facility_id = public.current_sj_facility_id();

CREATE OR REPLACE VIEW public.family_obligation_summaries WITH (security_invoker = true) AS
SELECT
  o.id,
  o.resident_id,
  o.status,
  o.valid_from,
  o.valid_until,
  o.sys_created_at
FROM kernel_domain.bitemporal_obligations AS o
JOIN resident_domain.residents AS r ON r.id = o.resident_id
JOIN resident_domain.family_resident_access AS a ON a.resident_id = r.id
WHERE a.user_id = auth.uid()
  AND a.disclosure_level = 'filtered_summary'
  AND r.facility_id = o.facility_id
  AND r.facility_id = public.current_sj_facility_id();

GRANT SELECT ON public.family_residents, public.family_obligation_summaries TO authenticated;

COMMIT;
