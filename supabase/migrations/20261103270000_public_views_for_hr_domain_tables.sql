-- SambungJaga AI Migration: Create Public Schema Views for hr_domain Tables
-- Provides public schema access to shift_rosters, staff_attendance, and leave_requests with security_invoker.

BEGIN;

SELECT pg_advisory_xact_lock(20261103270000);

-- 1. Create Public Views pointing to hr_domain tables
CREATE OR REPLACE VIEW public.shift_rosters WITH (security_invoker = true) AS
SELECT * FROM hr_domain.shift_rosters;

CREATE OR REPLACE VIEW public.staff_attendance WITH (security_invoker = true) AS
SELECT * FROM hr_domain.staff_attendance;

CREATE OR REPLACE VIEW public.leave_requests WITH (security_invoker = true) AS
SELECT * FROM hr_domain.leave_requests;

-- 2. Grant explicit SELECT, INSERT, UPDATE, DELETE permissions to authenticated & service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_rosters TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_attendance TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated, service_role;

GRANT USAGE ON SCHEMA hr_domain TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA hr_domain TO service_role;

COMMIT;
