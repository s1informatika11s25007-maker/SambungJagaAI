-- SambungJaga: secure, Supabase-backed demo account picker.
-- Only profiles explicitly flagged by a trusted administrator are discoverable
-- before login. Credentials (email & password) are fetched dynamically from DB.

ALTER TABLE hr_domain.staff_profiles
  ADD COLUMN IF NOT EXISTS is_demo_login BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE hr_domain.staff_profiles
  ADD COLUMN IF NOT EXISTS demo_password TEXT DEFAULT 'Demo12345!';

CREATE INDEX IF NOT EXISTS staff_profiles_demo_login_idx
  ON hr_domain.staff_profiles (role, full_name)
  WHERE is_demo_login = TRUE;

DROP FUNCTION IF EXISTS public.list_demo_login_accounts();

CREATE OR REPLACE FUNCTION public.list_demo_login_accounts()
RETURNS TABLE (
  profile_id UUID,
  full_name TEXT,
  role TEXT,
  email TEXT,
  password TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  WITH ranked_demo_accounts AS (
    SELECT
      p.id AS profile_id,
      p.full_name,
      p.role::TEXT AS role,
      u.email::TEXT AS email,
      COALESCE(p.demo_password, 'Demo12345!')::TEXT AS password,
      ROW_NUMBER() OVER (
        PARTITION BY p.role::TEXT
        ORDER BY p.full_name, p.id
      ) AS rn
    FROM hr_domain.staff_profiles AS p
    INNER JOIN auth.users AS u ON u.id = p.user_id
    WHERE p.is_demo_login = TRUE
      AND u.email IS NOT NULL
  )
  SELECT
    profile_id,
    full_name,
    role,
    email,
    password
  FROM ranked_demo_accounts
  WHERE rn = 1
  ORDER BY
    CASE role
      WHEN 'admin_hr' THEN 1
      WHEN 'supervisor' THEN 2
      WHEN 'caregiver' THEN 3
      WHEN 'family' THEN 4
      ELSE 5
    END;
$$;

REVOKE ALL ON FUNCTION public.list_demo_login_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_demo_login_accounts() TO anon, authenticated;

COMMENT ON COLUMN hr_domain.staff_profiles.is_demo_login IS
  'When true, the minimal account identity may appear in the public login demo picker.';
COMMENT ON FUNCTION public.list_demo_login_accounts() IS
  'Returns exactly 1 demo account per role dynamically fetched from database.';
