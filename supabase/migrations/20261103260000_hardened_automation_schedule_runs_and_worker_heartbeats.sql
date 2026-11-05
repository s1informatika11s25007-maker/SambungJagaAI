-- SambungJaga AI Migration: Hardened Automation Schedule Runs & Worker Heartbeat Tables
-- Provides persistent execution tracking (RUNNING -> COMPLETED/FAILED) and 24/7 worker telemetry.

BEGIN;

-- Advisory lock to prevent concurrent migration collisions
SELECT pg_advisory_xact_lock(20261103260000);

CREATE TABLE IF NOT EXISTS public.automation_schedule_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    schedule_id UUID REFERENCES public.automation_schedules(id) ON DELETE CASCADE,
    schedule_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'RUNNING', -- 'RUNNING' | 'COMPLETED' | 'FAILED'
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    execution_time_ms INT
);

CREATE TABLE IF NOT EXISTS public.automation_worker_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    worker_id TEXT UNIQUE NOT NULL,
    worker_type TEXT NOT NULL, -- 'server_worker' | 'server_scheduler'
    status TEXT NOT NULL DEFAULT 'HEALTHY',
    pid INT,
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alter automation_schedules to add status & error tracking
ALTER TABLE public.automation_schedules
  ADD COLUMN IF NOT EXISTS last_run_status TEXT,
  ADD COLUMN IF NOT EXISTS last_error_message TEXT;

-- Grant permissions to authenticated and service_role
GRANT ALL ON public.automation_schedule_runs TO authenticated, service_role;
GRANT ALL ON public.automation_worker_heartbeats TO authenticated, service_role;

COMMIT;
