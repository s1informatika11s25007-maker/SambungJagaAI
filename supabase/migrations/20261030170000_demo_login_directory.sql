-- SambungJaga: secure, Supabase-backed demo account picker.
-- Only profiles explicitly flagged by a trusted administrator are discoverable
-- before login. This function never exposes passwords or arbitrary staff rows.

ALTER TABLE hr_domain.staff_profiles
  ADD COLUMN IF NOT EXISTS is_demo_login BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS staff_profiles_demo_login_idx
  ON hr_domain.staff_profiles (role, full_name)
  WHERE is_demo_login = TRUE;

CREATE OR REPLACE FUNCTION public.list_demo_login_accounts()
RETURNS TABLE (
  profile_id UUID,
  full_name TEXT,
  role TEXT,
  email TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT
    p.id AS profile_id,
    p.full_name,
    p.role::TEXT AS role,
    u.email::TEXT AS email
  FROM hr_domain.staff_profiles AS p
  INNER JOIN auth.users AS u ON u.id = p.user_id
  WHERE p.is_demo_login = TRUE
    AND u.email IS NOT NULL
  ORDER BY
    CASE p.role::TEXT
      WHEN 'caregiver' THEN 1
      WHEN 'supervisor' THEN 2
      WHEN 'family' THEN 3
      WHEN 'admin_hr' THEN 4
      ELSE 5
    END,
    p.full_name;
$$;

REVOKE ALL ON FUNCTION public.list_demo_login_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_demo_login_accounts() TO anon, authenticated;

COMMENT ON COLUMN hr_domain.staff_profiles.is_demo_login IS
  'When true, the minimal account identity may appear in the public login demo picker. Does not grant login or bypass Supabase Auth.';
COMMENT ON FUNCTION public.list_demo_login_accounts() IS
  'Returns minimal identity details for explicitly designated demo-login profiles. Passwords are never returned.';
