-- ==============================================================================
-- SambungJaga AI — Automation & Distributed Worker Queue Infrastructure
-- Migration: 20261103000000_automation_distributed_queue_schema.sql
-- ==============================================================================

-- 1. AUTOMATION SCHEDULES TABLE (Cron-like schedule tracking per facility & timezone)
CREATE TABLE IF NOT EXISTS public.automation_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    schedule_name TEXT UNIQUE NOT NULL,
    cron_expression TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. AUTOMATION JOBS QUEUE TABLE
CREATE TABLE IF NOT EXISTS public.automation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    job_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    lease_owner TEXT,
    lease_expires_at TIMESTAMPTZ,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    max_retries INT NOT NULL DEFAULT 3,
    retry_count INT NOT NULL DEFAULT 0,
    idempotency_key TEXT UNIQUE,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_jobs_idempotency ON public.automation_jobs(idempotency_key);

-- 3. AUTOMATION JOB ATTEMPTS LOG TABLE
CREATE TABLE IF NOT EXISTS public.automation_job_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.automation_jobs(id) ON DELETE CASCADE,
    worker_id TEXT NOT NULL,
    attempt_number INT NOT NULL,
    status TEXT NOT NULL,
    execution_time_ms INT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. AUTOMATION WORKER HEARTBEATS TELEMETRY TABLE
CREATE TABLE IF NOT EXISTS public.automation_worker_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id TEXT UNIQUE NOT NULL,
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    worker_type TEXT NOT NULL DEFAULT 'background_worker',
    status TEXT NOT NULL DEFAULT 'active',
    active_jobs INT NOT NULL DEFAULT 0,
    jobs_processed INT NOT NULL DEFAULT 0,
    jobs_failed INT NOT NULL DEFAULT 0,
    cpu_usage_pct INT DEFAULT 0,
    memory_mb INT DEFAULT 0,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. AUTOMATION EXECUTION LOGS TABLE
CREATE TABLE IF NOT EXISTS public.automation_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID,
    worker_id TEXT NOT NULL,
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    status TEXT NOT NULL,
    logs JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. AUTOMATION DEAD LETTERS TABLE
CREATE TABLE IF NOT EXISTS public.automation_dead_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    original_job_id UUID,
    job_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    failure_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DISTRIBUTED LOCK & JOB LEASE CLAIM RPC
DROP FUNCTION IF EXISTS public.fn_claim_automation_jobs(TEXT, INT, INT);
CREATE OR REPLACE FUNCTION public.fn_claim_automation_jobs(
    p_worker_id TEXT,
    p_batch_size INT DEFAULT 10,
    p_lease_duration_seconds INT DEFAULT 300
)
RETURNS TABLE (
    id UUID,
    facility_id TEXT,
    job_type TEXT,
    payload JSONB,
    status TEXT,
    retry_count INT,
    idempotency_key TEXT,
    scheduled_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
    RETURN QUERY
    WITH pending_automation_jobs AS (
        SELECT q.id
        FROM public.automation_jobs q
        WHERE q.status IN ('pending', 'retrying')
          AND COALESCE(q.scheduled_at, q.created_at) <= NOW()
          AND (q.lease_expires_at IS NULL OR q.lease_expires_at < NOW())
        ORDER BY q.created_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.automation_jobs target
    SET status = 'processing',
        lease_owner = p_worker_id,
        lease_expires_at = NOW() + (p_lease_duration_seconds || ' seconds')::INTERVAL,
        error_message = p_worker_id
    FROM pending_automation_jobs
    WHERE target.id = pending_automation_jobs.id
    RETURNING
        target.id,
        target.facility_id,
        target.job_type,
        target.payload,
        target.status,
        target.retry_count,
        target.idempotency_key,
        target.scheduled_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_claim_automation_jobs(TEXT, INT, INT) TO service_role;
