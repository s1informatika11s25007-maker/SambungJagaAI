-- Dedicated technical platform administrator role.
-- This role is intentionally NOT assignable through public self-registration.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'platform_admin';

COMMENT ON TYPE public.user_role IS
  'SambungJaga roles: caregiver, supervisor, family, admin_hr, platform_admin. platform_admin must be provisioned by a trusted operator.';
