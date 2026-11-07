-- ==============================================================================
-- SambungJaga AI — Durable Workflow Execution Ledger & Real-Time Metrics
-- Migration: 20261106120000_durable_workflow_execution_ledger.sql
-- ==============================================================================

BEGIN;

SELECT pg_advisory_xact_lock(20261106120000);

-- 1. DURABLE WORKFLOW EXECUTION LEDGER TABLE
CREATE TABLE IF NOT EXISTS public.automation_workflow_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    workflow_type TEXT NOT NULL,
    workflow_instance_id TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    trigger_type TEXT NOT NULL DEFAULT 'SYSTEM_EVENT',
    eligible_for_automation BOOLEAN NOT NULL DEFAULT true,
    eligibility_reason TEXT,
    status TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'processing' | 'completed' | 'failed' | 'retrying' | 'requires_review' | 'cancelled'
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    human_intervention_required BOOLEAN NOT NULL DEFAULT false,
    human_intervention_performed BOOLEAN NOT NULL DEFAULT false,
    persisted_record_type TEXT,
    persisted_record_id TEXT,
    persistence_verified BOOLEAN NOT NULL DEFAULT false,
    execution_attempt INT NOT NULL DEFAULT 1,
    retry_count INT NOT NULL DEFAULT 0,
    failure_reason TEXT,
    correlation_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_ledger_facility ON public.automation_workflow_ledger(facility_id);
CREATE INDEX IF NOT EXISTS idx_workflow_ledger_status ON public.automation_workflow_ledger(status);
CREATE INDEX IF NOT EXISTS idx_workflow_ledger_idempotency ON public.automation_workflow_ledger(idempotency_key);

-- 2. AUTOMATION RATE AGGREGATE FUNCTION
CREATE OR REPLACE FUNCTION public.fn_get_facility_automation_metrics(p_facility_id TEXT DEFAULT 'FAC-001')
RETURNS TABLE (
    facility_id TEXT,
    total_eligible INT,
    completed_verified INT,
    failed_count INT,
    pending_retrying INT,
    human_gated INT,
    automation_rate_pct NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_total INT := 0;
    v_completed INT := 0;
    v_failed INT := 0;
    v_pending INT := 0;
    v_human INT := 0;
    v_rate NUMERIC := 0.0;
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM public.automation_workflow_ledger
    WHERE facility_id = p_facility_id AND eligible_for_automation = true;

    SELECT COUNT(*) INTO v_completed
    FROM public.automation_workflow_ledger
    WHERE facility_id = p_facility_id
      AND eligible_for_automation = true
      AND status = 'completed'
      AND persistence_verified = true
      AND human_intervention_performed = false;

    SELECT COUNT(*) INTO v_failed
    FROM public.automation_workflow_ledger
    WHERE facility_id = p_facility_id
      AND eligible_for_automation = true
      AND status = 'failed';

    SELECT COUNT(*) INTO v_pending
    FROM public.automation_workflow_ledger
    WHERE facility_id = p_facility_id
      AND eligible_for_automation = true
      AND status IN ('queued', 'processing', 'retrying');

    SELECT COUNT(*) INTO v_human
    FROM public.automation_workflow_ledger
    WHERE facility_id = p_facility_id
      AND (eligible_for_automation = false OR human_intervention_required = true);

    IF v_total > 0 THEN
        v_rate := ROUND((v_completed::NUMERIC / v_total::NUMERIC) * 100.0, 2);
    ELSE
        v_rate := 0.0;
    END IF;

    RETURN QUERY SELECT
        p_facility_id,
        v_total,
        v_completed,
        v_failed,
        v_pending,
        v_human,
        v_rate;
END;
$$;

GRANT ALL ON public.automation_workflow_ledger TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_get_facility_automation_metrics(TEXT) TO authenticated, service_role;

COMMIT;
