-- ==============================================================================
-- SAMBUNGJAGA AI — COMPLETE ENTITY RELATIONSHIP DIAGRAM (ERD) SCHEMA
-- Database Engine: PostgreSQL 15+ / Supabase
-- Target Schema: public / multi-domain kernel
-- Complete 100% Schema, Foreign Keys, Indexes & Mermaid Visual ERD Representation
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. EXTENSIONS & ENUM TYPES
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('caregiver', 'supervisor', 'family', 'admin_hr', 'platform_admin');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'epistemic_status') THEN
        CREATE TYPE epistemic_status AS ENUM ('observed', 'reported', 'inferred', 'contradicted', 'stale');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'obligation_status') THEN
        CREATE TYPE obligation_status AS ENUM ('open', 'in_progress', 'verified_closed', 'escalated', 'canceled', 'breached', 'created', 'assigned', 'evidence_submitted', 'pending_review', 'approved', 'closed');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'obligation_priority') THEN
        CREATE TYPE obligation_priority AS ENUM ('routine', 'important', 'critical', 'emergency');
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. IDENTITY, USER & HR DOMAIN
-- ------------------------------------------------------------------------------

-- HR Employees / Staff Profiles
CREATE TABLE IF NOT EXISTS hr_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE, -- Foreign Key to auth.users(id)
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'caregiver',
    shift_status TEXT DEFAULT 'off_duty', -- on_duty, off_duty, handover_pending
    attendance_status TEXT DEFAULT 'logged_out',
    competencies TEXT[] DEFAULT '{}',
    certifications JSONB DEFAULT '[]'::jsonb,
    shift_start TEXT,
    shift_end TEXT,
    is_active BOOLEAN DEFAULT true,
    is_demo_login BOOLEAN DEFAULT false,
    phone_number TEXT,
    sys_created_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alias view/table for backwards compatibility
CREATE TABLE IF NOT EXISTS staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE,
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'caregiver',
    shift_status TEXT DEFAULT 'off_duty',
    attendance_status TEXT DEFAULT 'logged_out',
    competencies TEXT[] DEFAULT '{}',
    certifications JSONB DEFAULT '[]'::jsonb,
    shift_start TEXT,
    shift_end TEXT,
    is_active BOOLEAN DEFAULT true,
    is_demo_login BOOLEAN DEFAULT false,
    phone_number TEXT,
    sys_created_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shift Roster Management
CREATE TABLE IF NOT EXISTS shift_rosters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id VARCHAR NOT NULL DEFAULT 'FAC-001',
    roster_date DATE NOT NULL,
    pagi JSONB DEFAULT '[]'::jsonb,
    siang JSONB DEFAULT '[]'::jsonb,
    malam JSONB DEFAULT '[]'::jsonb,
    status VARCHAR DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shift Assignments
CREATE TABLE IF NOT EXISTS shift_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    roster_id UUID REFERENCES shift_rosters(id) ON DELETE CASCADE,
    staff_id TEXT REFERENCES hr_employees(id) ON DELETE CASCADE,
    staff_name TEXT NOT NULL,
    shift_name TEXT NOT NULL,
    assigned_date DATE NOT NULL,
    status TEXT DEFAULT 'scheduled',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff Attendance Logs
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id VARCHAR NOT NULL DEFAULT 'FAC-001',
    staff_id VARCHAR NOT NULL,
    staff_name VARCHAR NOT NULL,
    clock_in_at TIMESTAMPTZ,
    clock_out_at TIMESTAMPTZ,
    location JSONB DEFAULT '{}'::jsonb,
    status VARCHAR DEFAULT 'present',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id VARCHAR NOT NULL DEFAULT 'FAC-001',
    staff_id VARCHAR NOT NULL,
    staff_name VARCHAR NOT NULL,
    leave_type VARCHAR NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status VARCHAR DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employee Documents
CREATE TABLE IF NOT EXISTS employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    staff_id TEXT REFERENCES hr_employees(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    document_name TEXT NOT NULL,
    storage_url TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employee HR Lifecycle Events
CREATE TABLE IF NOT EXISTS employee_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    staff_id TEXT REFERENCES hr_employees(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff Credentials & Licenses
CREATE TABLE IF NOT EXISTS staff_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    staff_id TEXT REFERENCES hr_employees(id) ON DELETE CASCADE,
    credential_name TEXT NOT NULL,
    issued_by TEXT,
    issued_date DATE,
    expiration_date DATE,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Caregiver Training Records
CREATE TABLE IF NOT EXISTS training_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    staff_id TEXT REFERENCES hr_employees(id) ON DELETE CASCADE,
    course_name TEXT NOT NULL,
    provider TEXT,
    completion_date DATE,
    score INTEGER,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Staffing Demand Forecasts
CREATE TABLE IF NOT EXISTS staffing_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    forecast_date DATE NOT NULL,
    projected_resident_count INTEGER NOT NULL,
    required_caregivers INTEGER NOT NULL,
    available_caregivers INTEGER NOT NULL,
    shortage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------------------------
-- 2. RESIDENT & CLINICAL OBLIGATION KERNEL DOMAIN
-- ------------------------------------------------------------------------------

-- Residents (Patients / Care Recipients)
CREATE TABLE IF NOT EXISTS residents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    full_name TEXT NOT NULL,
    room_number TEXT NOT NULL,
    medical_condition_summary TEXT,
    allergies TEXT[] DEFAULT '{}',
    consent_family_level TEXT DEFAULT 'filtered_summary',
    care_level TEXT DEFAULT 'level_1',
    status TEXT DEFAULT 'active',
    sys_created_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bitemporal Obligation Ledger (Care Obligations Graph)
CREATE TABLE IF NOT EXISTS bitemporal_obligations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    mission_id UUID NOT NULL,
    resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assigned_caregiver_id UUID REFERENCES hr_employees(id) ON DELETE SET NULL,
    priority obligation_priority NOT NULL DEFAULT 'routine',
    status obligation_status NOT NULL DEFAULT 'open',
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    sys_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sys_superseded_at TIMESTAMPTZ,
    rule_version_id TEXT NOT NULL DEFAULT 'v1.0.0',
    required_evidence_grade TEXT NOT NULL DEFAULT 'E1',
    estimated_duration_minutes INTEGER DEFAULT 15,
    evidence_submitted BOOLEAN DEFAULT false,
    required_competencies TEXT[] DEFAULT '{}',
    requires_human_review BOOLEAN DEFAULT false,
    is_negative_obligation BOOLEAN DEFAULT false,
    preconditions JSONB DEFAULT '{}'::jsonb,
    postconditions JSONB DEFAULT '{}'::jsonb,
    parent_obligation_id UUID REFERENCES bitemporal_obligations(id) ON DELETE SET NULL
);

-- Epistemic Fact Ledger (Knowledge & Observations)
CREATE TABLE IF NOT EXISTS epistemic_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
    fact_key TEXT NOT NULL,
    fact_value JSONB NOT NULL,
    status epistemic_status NOT NULL DEFAULT 'reported',
    confidence_score NUMERIC(3,2) DEFAULT 1.00,
    source_type TEXT NOT NULL,
    source_actor_id UUID REFERENCES hr_employees(id) ON DELETE SET NULL,
    provenance_chain JSONB DEFAULT '[]'::jsonb,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sys_created_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evidence Verifications Ledger
CREATE TABLE IF NOT EXISTS evidence_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    obligation_id UUID NOT NULL REFERENCES bitemporal_obligations(id) ON DELETE CASCADE,
    submitter_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE RESTRICT,
    evidence_grade TEXT NOT NULL,
    evidence_payload JSONB NOT NULL,
    storage_url TEXT,
    verifier_status TEXT NOT NULL DEFAULT 'verified',
    is_spot_challenged BOOLEAN DEFAULT false,
    verifier_notes TEXT,
    rejection_reason TEXT,
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    sys_created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spot Challenge Audits
CREATE TABLE IF NOT EXISTS spot_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id UUID NOT NULL REFERENCES evidence_verifications(id) ON DELETE CASCADE,
    challenge_reason TEXT NOT NULL,
    verifier_supervisor_id UUID REFERENCES hr_employees(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clinical Care Rules Library
CREATE TABLE IF NOT EXISTS care_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    code TEXT NOT NULL,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    expression TEXT NOT NULL,
    priority obligation_priority NOT NULL DEFAULT 'routine',
    evidence_grade TEXT DEFAULT 'E1',
    description TEXT,
    status TEXT DEFAULT 'active',
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    approved_by TEXT,
    created_by UUID REFERENCES hr_employees(id) ON DELETE SET NULL,
    supersedes_id UUID REFERENCES care_rules(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shift Handover Contracts
CREATE TABLE IF NOT EXISTS handover_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    outgoing_staff_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE RESTRICT,
    incoming_staff_id UUID REFERENCES hr_employees(id) ON DELETE RESTRICT,
    shift_name TEXT NOT NULL,
    open_obligations_summary JSONB NOT NULL,
    competency_gaps_identified JSONB DEFAULT '[]'::jsonb,
    outgoing_signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    incoming_signed_at TIMESTAMPTZ,
    contract_status TEXT NOT NULL DEFAULT 'pending_receiver',
    escalated_at TIMESTAMPTZ,
    escalated_reason TEXT,
    hash_signature TEXT NOT NULL,
    sys_created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Authority Envelopes
CREATE TABLE IF NOT EXISTS authority_envelopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL,
    envelope_level TEXT NOT NULL,
    requires_human_approval BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES hr_employees(id) ON DELETE SET NULL,
    approval_status TEXT DEFAULT 'auto_approved',
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------------------------
-- 3. FAMILY PORTAL & VISIBILITY DOMAIN
-- ------------------------------------------------------------------------------

-- Family Member - Resident Authorization Link
CREATE TABLE IF NOT EXISTS family_residents (
    user_id UUID NOT NULL, -- auth.users(id)
    resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    disclosure_level TEXT DEFAULT 'filtered_summary',
    resident_name TEXT,
    room_number TEXT,
    PRIMARY KEY (user_id, resident_id)
);

-- Family Visit Scheduling Requests
CREATE TABLE IF NOT EXISTS family_visit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    family_user_id UUID, -- auth.users(id)
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    resident_name TEXT NOT NULL,
    proposed_date DATE NOT NULL,
    proposed_time TEXT NOT NULL,
    visitor_count INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review',
    ticket_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Family Complaints & Inquiry Escalations
CREATE TABLE IF NOT EXISTS family_complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    family_user_id UUID, -- auth.users(id)
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    resident_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    complaint_text TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'routine',
    target_role TEXT NOT NULL DEFAULT 'supervisor',
    status TEXT NOT NULL DEFAULT 'received',
    acknowledged_by_family BOOLEAN NOT NULL DEFAULT true,
    ticket_number TEXT,
    resolution_notes TEXT,
    resolved_by UUID REFERENCES hr_employees(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Family Obligations Summary View / Table
CREATE TABLE IF NOT EXISTS family_obligation_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    title TEXT NOT NULL,
    status obligation_status NOT NULL,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ
);


-- ------------------------------------------------------------------------------
-- 4. UNIFIED MESSAGING & NOTIFICATION GATEWAY
-- ------------------------------------------------------------------------------

-- Notification Templates
CREATE TABLE IF NOT EXISTS notification_templates (
    template_id TEXT PRIMARY KEY,
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    template_name TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'in_app',
    subject_template TEXT,
    body_template TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification User Preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id UUID PRIMARY KEY, -- auth.users(id)
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    allow_in_app BOOLEAN NOT NULL DEFAULT true,
    allow_whatsapp BOOLEAN NOT NULL DEFAULT true,
    allow_email BOOLEAN NOT NULL DEFAULT true,
    allow_sms BOOLEAN NOT NULL DEFAULT false,
    allow_push BOOLEAN NOT NULL DEFAULT true,
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
    quiet_hours_start TEXT DEFAULT '22:00',
    quiet_hours_end TEXT DEFAULT '06:00',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System Notifications Log
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    recipient_role TEXT NOT NULL,
    recipient_user_id UUID, -- auth.users(id)
    sender_name TEXT DEFAULT 'Sistem SambungJaga',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    is_shown BOOLEAN DEFAULT false,
    delivery_status TEXT NOT NULL DEFAULT 'delivered',
    delivered_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification Outbox Queue
CREATE TABLE IF NOT EXISTS notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    recipient_user_id UUID,
    channel TEXT NOT NULL DEFAULT 'in_app',
    template_id TEXT NOT NULL DEFAULT 'DEFAULT_TEMPLATE' REFERENCES notification_templates(template_id),
    idempotency_key TEXT,
    provider_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    delivery_timestamp TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification Delivery Log
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    notification_id UUID REFERENCES notification_outbox(id) ON DELETE CASCADE,
    recipient_user_id UUID,
    channel TEXT NOT NULL,
    provider_name TEXT NOT NULL DEFAULT 'unified_gateway',
    provider_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'sent',
    response_payload JSONB DEFAULT '{}'::jsonb,
    delivered_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Provider Inbound Webhook Events
CREATE TABLE IF NOT EXISTS provider_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    provider_name TEXT NOT NULL,
    provider_message_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed BOOLEAN NOT NULL DEFAULT false,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ------------------------------------------------------------------------------
-- 5. AUTONOMOUS AI SUPERAGENT MESH & DISTRIBUTED AUTOMATION
-- ------------------------------------------------------------------------------

-- Agent Mesh State Center
CREATE TABLE IF NOT EXISTS agent_mesh_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    agent_name TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0.0',
    policy_level TEXT NOT NULL DEFAULT 'A1',
    status TEXT NOT NULL DEFAULT 'idle',
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    total_executions INTEGER NOT NULL DEFAULT 0,
    successful_executions INTEGER NOT NULL DEFAULT 0,
    last_execution_time_ms INTEGER DEFAULT 0,
    circuit_open BOOLEAN NOT NULL DEFAULT false,
    last_executed_at TIMESTAMPTZ,
    last_error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Superagent Execution Tracing & Telemetry
CREATE TABLE IF NOT EXISTS agent_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT DEFAULT 'FAC-001',
    mission_id UUID,
    agent_name TEXT,
    model_used TEXT,
    status TEXT,
    input_payload JSONB,
    output_payload JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    correlation_id TEXT,
    idempotency_key TEXT,
    sys_created_at TIMESTAMPTZ DEFAULT NOW(),
    sys_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Distributed Jobs Queue
CREATE TABLE IF NOT EXISTS automation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    job_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    lease_owner TEXT,
    lease_expires_at TIMESTAMPTZ,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    max_retries INTEGER NOT NULL DEFAULT 3,
    retry_count INTEGER NOT NULL DEFAULT 0,
    idempotency_key TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Job Execution Attempts
CREATE TABLE IF NOT EXISTS automation_job_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES automation_jobs(id) ON DELETE CASCADE,
    worker_id TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    status TEXT NOT NULL,
    execution_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automation Worker Logs
CREATE TABLE IF NOT EXISTS automation_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    job_id UUID REFERENCES automation_jobs(id) ON DELETE SET NULL,
    worker_id TEXT NOT NULL,
    status TEXT NOT NULL,
    logs JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dead Letter Queue for Automation Jobs
CREATE TABLE IF NOT EXISTS automation_dead_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    original_job_id UUID,
    job_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    failure_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automation Schedules (Cron Jobs)
CREATE TABLE IF NOT EXISTS automation_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    schedule_name TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    last_run_status TEXT,
    last_error_message TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cron Schedule Execution Runs
CREATE TABLE IF NOT EXISTS automation_schedule_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    schedule_id UUID REFERENCES automation_schedules(id) ON DELETE CASCADE,
    schedule_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'RUNNING',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    execution_time_ms INTEGER
);

-- Worker Heartbeats & Node Status
CREATE TABLE IF NOT EXISTS automation_worker_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    worker_id TEXT NOT NULL,
    worker_type TEXT NOT NULL DEFAULT 'background_worker',
    status TEXT NOT NULL DEFAULT 'active',
    active_jobs INTEGER NOT NULL DEFAULT 0,
    jobs_processed INTEGER NOT NULL DEFAULT 0,
    jobs_failed INTEGER NOT NULL DEFAULT 0,
    cpu_usage_pct INTEGER DEFAULT 0,
    memory_mb INTEGER DEFAULT 0,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS worker_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    worker_id TEXT NOT NULL,
    worker_type TEXT NOT NULL DEFAULT 'background_worker',
    status TEXT NOT NULL DEFAULT 'active',
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    jobs_processed INTEGER NOT NULL DEFAULT 0,
    jobs_failed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System Outbox Queue Event Bus
CREATE TABLE IF NOT EXISTS system_outbox_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    idempotency_key TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event Bus Dead Letter Queue
CREATE TABLE IF NOT EXISTS dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    original_event_id UUID,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    failure_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ------------------------------------------------------------------------------
-- 6. SECURITY, AUDIT TRAIL & OFFLINE LEDGER
-- ------------------------------------------------------------------------------

-- Cryptographic Append-Only Audit Trail
CREATE TABLE IF NOT EXISTS audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id BIGSERIAL UNIQUE,
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    actor_id UUID REFERENCES hr_employees(id) ON DELETE SET NULL,
    gateway_tag TEXT NOT NULL, -- [A] Identity, [A] Tool Execution, [A] Verifier, [A] Audit
    action_name TEXT NOT NULL,
    payload JSONB NOT NULL,
    prev_entry_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    sys_created_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tamper-Evident Offline Hash Chains
CREATE TABLE IF NOT EXISTS offline_hash_chains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    sequence_number BIGINT NOT NULL,
    payload_hash TEXT NOT NULL,
    previous_hash TEXT NOT NULL,
    signature TEXT NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_device_seq UNIQUE(device_id, sequence_number)
);

-- Schema Migration History
CREATE TABLE IF NOT EXISTS _schema_migrations (
    version TEXT PRIMARY KEY,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);


-- ------------------------------------------------------------------------------
-- 7. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_bitemporal_resident ON bitemporal_obligations(resident_id);
CREATE INDEX IF NOT EXISTS idx_bitemporal_caregiver ON bitemporal_obligations(assigned_caregiver_id);
CREATE INDEX IF NOT EXISTS idx_bitemporal_status ON bitemporal_obligations(status);
CREATE INDEX IF NOT EXISTS idx_bitemporal_valid_range ON bitemporal_obligations(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_epistemic_resident ON epistemic_facts(resident_id);
CREATE INDEX IF NOT EXISTS idx_evidence_obligation ON evidence_verifications(obligation_id);
CREATE INDEX IF NOT EXISTS idx_evidence_submitter ON evidence_verifications(submitter_id);
CREATE INDEX IF NOT EXISTS idx_audit_sequence ON audit_trail(sequence_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_trail(actor_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status_scheduled ON automation_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_outbox_status_scheduled ON system_outbox_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_role, is_read);


-- ------------------------------------------------------------------------------
-- 8. MERMAID DIAGRAM REPRESENTATION (VISUAL ERD)
-- ------------------------------------------------------------------------------
/*
```mermaid
erDiagram
    hr_employees ||--o{ bitemporal_obligations : "assigned_to"
    hr_employees ||--o{ epistemic_facts : "reported_by"
    hr_employees ||--o{ evidence_verifications : "submitted_by"
    hr_employees ||--o{ spot_challenges : "verified_by"
    hr_employees ||--o{ care_rules : "created_by"
    hr_employees ||--o{ handover_contracts : "outgoing_by"
    hr_employees ||--o{ handover_contracts : "incoming_by"
    hr_employees ||--o{ audit_trail : "acted_by"
    hr_employees ||--o{ shift_assignments : "assigned_to"

    residents ||--o{ bitemporal_obligations : "has_obligations"
    residents ||--o{ epistemic_facts : "has_facts"
    residents ||--o{ family_residents : "authorized_family"
    residents ||--o{ family_visit_requests : "receives_visits"
    residents ||--o{ family_complaints : "subject_of_complaint"

    bitemporal_obligations ||--o{ evidence_verifications : "verified_by"
    bitemporal_obligations ||--o| bitemporal_obligations : "parent_obligation"

    evidence_verifications ||--o{ spot_challenges : "challenged_by"

    shift_rosters ||--o{ shift_assignments : "contains_assignments"

    notification_templates ||--o{ notification_outbox : "uses_template"
    notification_outbox ||--o{ notification_deliveries : "dispatches_to"

    automation_jobs ||--o{ automation_job_attempts : "has_attempts"
    automation_jobs ||--o{ automation_execution_logs : "logs_execution"
    automation_schedules ||--o{ automation_schedule_runs : "runs_schedule"
```
*/
