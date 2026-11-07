-- ==============================================================================
-- SambungJaga AI — Database Cleanup, Unused Objects Removal & Index Optimization
-- Migration: 20261106130000_database_cleanup_and_performance_optimization.sql
-- ==============================================================================

BEGIN;

SELECT pg_advisory_xact_lock(20261106130000);

-- 1. DROP DEPRECATED UNUSED LEGACY TABLES & VIEWS
DROP TABLE IF EXISTS public.worker_heartbeats CASCADE;
DROP TABLE IF EXISTS public.outbox_events CASCADE;
DROP VIEW IF EXISTS public.v_legacy_worker_stats CASCADE;

-- 2. PERFORMANCE INDEXING FOR MULTI-TENANT QUERIES & SCHEDULER SWEEPS
CREATE INDEX IF NOT EXISTS idx_obligations_facility_status ON public.bitemporal_obligations(facility_id, status);
CREATE INDEX IF NOT EXISTS idx_obligations_resident_id ON public.bitemporal_obligations(resident_id);
CREATE INDEX IF NOT EXISTS idx_obligations_caregiver_id ON public.bitemporal_obligations(assigned_caregiver_id);
CREATE INDEX IF NOT EXISTS idx_obligations_valid_until ON public.bitemporal_obligations(valid_until) WHERE valid_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_epistemic_facts_facility ON public.epistemic_facts(facility_id, fact_key);
CREATE INDEX IF NOT EXISTS idx_epistemic_facts_resident ON public.epistemic_facts(resident_id);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user ON public.notifications(recipient_user_id) WHERE recipient_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_facility_role ON public.notifications(facility_id, recipient_role);

CREATE INDEX IF NOT EXISTS idx_handover_contracts_facility ON public.handover_contracts(facility_id, contract_status);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_facility_status ON public.staff_profiles(facility_id, shift_status, is_active);

CREATE INDEX IF NOT EXISTS idx_system_outbox_scheduled ON public.system_outbox_queue(scheduled_at, status) WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_automation_jobs_scheduled ON public.automation_jobs(scheduled_at, status) WHERE status IN ('pending', 'retrying');

COMMIT;
