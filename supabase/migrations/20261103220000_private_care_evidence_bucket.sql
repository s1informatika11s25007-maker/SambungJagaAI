-- ==============================================================================
-- SAMBUNGJAGA AI — MIGRATION 20261103220000: PRIVATE STORAGE BUCKET & RLS
-- Creates the `private-care-evidence` storage bucket with strict RLS policies.
-- ==============================================================================

-- 1. Create Private Storage Bucket for Care Evidence
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'private-care-evidence',
    'private-care-evidence',
    false,
    10485760, -- 10MB Max File Size
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Storage RLS Policies
DROP POLICY IF EXISTS "Authenticated users can upload care evidence" ON storage.objects;
CREATE POLICY "Authenticated users can upload care evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'private-care-evidence'
    AND public.current_sj_facility_id() IS NOT NULL
    AND (storage.foldername(name))[1] = public.current_sj_facility_id()
);

DROP POLICY IF EXISTS "Facility users can read care evidence" ON storage.objects;
CREATE POLICY "Facility users can read care evidence"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'private-care-evidence'
    AND public.current_sj_facility_id() IS NOT NULL
    AND (storage.foldername(name))[1] = public.current_sj_facility_id()
);

DROP POLICY IF EXISTS "Supervisors and HR can delete care evidence" ON storage.objects;
CREATE POLICY "Supervisors and HR can delete care evidence"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'private-care-evidence'
    AND public.current_sj_facility_id() IS NOT NULL
    AND (storage.foldername(name))[1] = public.current_sj_facility_id()
    AND public.current_sj_role() IN ('supervisor', 'admin_hr')
);
