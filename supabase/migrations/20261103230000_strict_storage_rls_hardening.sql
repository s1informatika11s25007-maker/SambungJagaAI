-- ==============================================================================
-- SAMBUNGJAGA AI — MIGRATION 20261103230000: STRICT STORAGE RLS HARDENING
-- Drops all permissive storage policies and enforces strict role-based, multi-tenant
-- isolation on storage.objects. Family accounts are strictly PROHIBITED from direct
-- bucket object reads/uploads.
-- ==============================================================================

-- DROP ALL CONFLICTING PERMISSIVE STORAGE POLICIES
DROP POLICY IF EXISTS "Authenticated users can upload care evidence" ON storage.objects;
DROP POLICY IF EXISTS "Facility users can read care evidence" ON storage.objects;
DROP POLICY IF EXISTS "Supervisors and HR can delete care evidence" ON storage.objects;
DROP POLICY IF EXISTS "Strict staff upload policy for care evidence" ON storage.objects;
DROP POLICY IF EXISTS "Strict staff select policy for care evidence" ON storage.objects;
DROP POLICY IF EXISTS "Strict supervisor delete policy for care evidence" ON storage.objects;

-- REVOKE DIRECT ANON & FAMILY ACCESS TO CARE EVIDENCE BUCKET
REVOKE ALL ON storage.objects FROM anon;

-- 1. UPLOAD POLICY (INSERT) — RESTRICTED TO CAREGIVER, SUPERVISOR, ADMIN_HR IN SAME FACILITY
CREATE POLICY "Strict staff upload policy for care evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'private-care-evidence'
    AND public.current_sj_facility_id() IS NOT NULL
    AND (storage.foldername(name))[1] = public.current_sj_facility_id()
    AND public.current_sj_role() IN ('caregiver', 'supervisor', 'admin_hr')
);

-- 2. READ POLICY (SELECT) — RESTRICTED TO CAREGIVER, SUPERVISOR, ADMIN_HR IN SAME FACILITY
-- FAMILY ACCOUNTS ARE STRICTLY EXCLUDED FROM DIRECT BUCKET ACCESS (ROLE != 'family')
CREATE POLICY "Strict staff select policy for care evidence"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'private-care-evidence'
    AND public.current_sj_facility_id() IS NOT NULL
    AND (storage.foldername(name))[1] = public.current_sj_facility_id()
    AND public.current_sj_role() IN ('caregiver', 'supervisor', 'admin_hr')
);

-- 3. DELETE POLICY (DELETE) — RESTRICTED TO SUPERVISOR OR ADMIN_HR IN SAME FACILITY
CREATE POLICY "Strict supervisor delete policy for care evidence"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'private-care-evidence'
    AND public.current_sj_facility_id() IS NOT NULL
    AND (storage.foldername(name))[1] = public.current_sj_facility_id()
    AND public.current_sj_role() IN ('supervisor', 'admin_hr')
);
