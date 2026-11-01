-- ==============================================================================
-- SambungJaga AI — Care Superagent Architecture (Obligation Kernel)
-- Supabase PostgreSQL Schema & Row-Level Security (RLS) Policies
-- Versi Final: 2026
-- ==============================================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- SCHEMAS (Pemisahan skema Resident dan HR demi keamanan & UU PDP)
CREATE SCHEMA IF NOT EXISTS resident_domain;
CREATE SCHEMA IF NOT EXISTS hr_domain;
CREATE SCHEMA IF NOT EXISTS kernel_domain;
CREATE SCHEMA IF NOT EXISTS audit_domain;

-- ------------------------------------------------------------------------------
-- 1. AKTOR & PROFIL (Identity, RBAC)
-- ------------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('caregiver', 'supervisor', 'family', 'admin_hr');

CREATE TABLE hr_domain.staff_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'caregiver',
    shift_status TEXT DEFAULT 'off_duty', -- on_duty, off_duty, handover_pending
    competencies TEXT[] DEFAULT '{}', -- ['insulin_injection', 'wound_dressing', 'dementia_care']
    phone_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE resident_domain.residents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    room_number TEXT NOT NULL,
    medical_condition_summary TEXT,
    allergies TEXT[] DEFAULT '{}',
    consent_family_level TEXT DEFAULT 'filtered_summary', -- full, filtered_summary, emergency_only
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. P3 · EPISTEMIC FACT LEDGER (Persepsi & Pengetahuan)
-- Epistemic State: observed (diamati), reported (dilaporkan), inferred (disimpulkan), contradicted (dikontradiksi), stale (basi)
-- ------------------------------------------------------------------------------
CREATE TYPE epistemic_status AS ENUM ('observed', 'reported', 'inferred', 'contradicted', 'stale');

CREATE TABLE kernel_domain.epistemic_facts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resident_id UUID NOT NULL REFERENCES resident_domain.residents(id) ON DELETE CASCADE,
    fact_key TEXT NOT NULL, -- e.g. "blood_pressure", "breakfast_intake", "pain_level"
    fact_value JSONB NOT NULL,
    status epistemic_status NOT NULL DEFAULT 'reported',
    confidence_score NUMERIC(3,2) DEFAULT 1.00,
    source_type TEXT NOT NULL, -- "voice_stt", "text_input", "sensor_iot", "human_report"
    source_actor_id UUID REFERENCES hr_domain.staff_profiles(id),
    provenance_chain JSONB DEFAULT '[]', -- jejak asal-usul data
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. P1 · BITEMPORAL OBLIGATION LEDGER & CARE OBLIGATION GRAPH
-- Bitemporal: Valid Time (waktu berlaku klinis) vs Transaction Time (waktu dicatat di DB)
-- ------------------------------------------------------------------------------
CREATE TYPE obligation_status AS ENUM ('open', 'in_progress', 'verified_closed', 'escalated', 'canceled', 'breached');
CREATE TYPE obligation_priority AS ENUM ('routine', 'important', 'critical', 'emergency');

CREATE TABLE kernel_domain.bitemporal_obligations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID NOT NULL, -- Care Mission Orchestrator Mission ID
    resident_id UUID NOT NULL REFERENCES resident_domain.residents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assigned_caregiver_id UUID REFERENCES hr_domain.staff_profiles(id),
    priority obligation_priority NOT NULL DEFAULT 'routine',
    status obligation_status NOT NULL DEFAULT 'open',

    -- Valid Time (Bitemporal Period 1)
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,

    -- Transaction Time (Bitemporal Period 2)
    sys_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sys_superseded_at TIMESTAMPTZ, -- null jika versi aktif

    rule_version_id TEXT NOT NULL DEFAULT 'v1.0.0',
    required_evidence_grade TEXT NOT NULL DEFAULT 'E1', -- E0, E1, E2, E3
    required_competencies TEXT[] DEFAULT '{}',
    is_negative_obligation BOOLEAN DEFAULT FALSE, -- larangan (misal: "Jangan beri air minum setelah jam 8 malam")

    preconditions JSONB DEFAULT '{}',
    postconditions JSONB DEFAULT '{}',

    parent_obligation_id UUID REFERENCES kernel_domain.bitemporal_obligations(id)
);

-- ------------------------------------------------------------------------------
-- 4. P2 · EVIDENCE-GRADE VERIFICATION & SPOT CHALLENGES
-- Evidence Grade: E0 (Claim), E1 (Artifact/Photo/QR), E2 (2nd Person Confirmation), E3 (IoT/Sensor System)
-- ------------------------------------------------------------------------------
CREATE TABLE kernel_domain.evidence_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obligation_id UUID NOT NULL REFERENCES kernel_domain.bitemporal_obligations(id) ON DELETE CASCADE,
    submitter_id UUID NOT NULL REFERENCES hr_domain.staff_profiles(id),
    evidence_grade TEXT NOT NULL, -- E0, E1, E2, E3
    evidence_payload JSONB NOT NULL, -- { photo_hash, qr_code, second_person_id, sensor_timestamp }
    storage_url TEXT,
    verifier_status TEXT NOT NULL DEFAULT 'verified', -- verified, spot_challenged, rejected
    is_spot_challenged BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kernel_domain.spot_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evidence_id UUID NOT NULL REFERENCES kernel_domain.evidence_verifications(id) ON DELETE CASCADE,
    challenge_reason TEXT NOT NULL, -- "Random 5% audit", "Expired artifact detected"
    verifier_supervisor_id UUID REFERENCES hr_domain.staff_profiles(id),
    status TEXT DEFAULT 'pending', -- pending, passed, failed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. P5 · TAMPER-EVIDENT OFFLINE HASH-CHAIN LEDGER
-- Atestasi perangkat & pencegahan backdate
-- ------------------------------------------------------------------------------
CREATE TABLE kernel_domain.offline_hash_chains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id TEXT NOT NULL,
    sequence_number BIGINT NOT NULL,
    payload_hash TEXT NOT NULL,
    previous_hash TEXT NOT NULL,
    signature TEXT NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_device_seq UNIQUE(device_id, sequence_number)
);

-- ------------------------------------------------------------------------------
-- 6. P6 · AUTHORITY ENVELOPE & ACTION CONTRACTS
-- Envelopes: A0 (Read), A1 (Reversible Action), A2 (Notification), A3 (Clinical/Irreversible -> Human Review)
-- ------------------------------------------------------------------------------
CREATE TABLE kernel_domain.authority_envelopes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type TEXT NOT NULL, -- e.g. "update_medication", "notify_family", "reassign_task"
    envelope_level TEXT NOT NULL, -- A0, A1, A2, A3
    requires_human_approval BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES hr_domain.staff_profiles(id),
    approval_status TEXT DEFAULT 'auto_approved', -- auto_approved, pending_human, approved, rejected
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. TWO-SIDED HANDOVER CONTRACTS
-- ------------------------------------------------------------------------------
CREATE TABLE kernel_domain.handover_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outgoing_staff_id UUID NOT NULL REFERENCES hr_domain.staff_profiles(id),
    incoming_staff_id UUID REFERENCES hr_domain.staff_profiles(id),
    shift_name TEXT NOT NULL, -- "Pagi ke Siang", "Siang ke Malam"
    open_obligations_summary JSONB NOT NULL,
    competency_gaps_identified JSONB DEFAULT '[]',
    outgoing_signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    incoming_signed_at TIMESTAMPTZ,
    contract_status TEXT NOT NULL DEFAULT 'pending_receiver', -- pending_receiver, confirmed, escalated
    hash_signature TEXT NOT NULL
);

-- ------------------------------------------------------------------------------
-- 8. PLATFORM: APPEND-ONLY HASH-CHAINED AUDIT TRAIL [A]
-- ------------------------------------------------------------------------------
CREATE TABLE audit_domain.audit_trail (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_id BIGSERIAL UNIQUE,
    actor_id UUID REFERENCES hr_domain.staff_profiles(id),
    gateway_tag TEXT NOT NULL, -- [A] Identity, [A] Tool Execution, [A] Verifier, [A] Audit
    action_name TEXT NOT NULL,
    payload JSONB NOT NULL,
    prev_entry_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger Function for Append-Only Audit Trail Hash-Chaining
CREATE OR REPLACE FUNCTION audit_domain.hash_audit_entry()
RETURNS TRIGGER AS $$
DECLARE
    last_hash TEXT;
BEGIN
    SELECT entry_hash INTO last_hash
    FROM audit_domain.audit_trail
    ORDER BY sequence_id DESC LIMIT 1;

    IF last_hash IS NULL THEN
        last_hash := 'GENESIS_HASH_SAMBUNGJAGA_00000000000000000000000000000000';
    END IF;

    NEW.prev_entry_hash := last_hash;
    NEW.entry_hash := encode(digest(
        concat(NEW.sequence_id::text, NEW.gateway_tag, NEW.action_name, NEW.payload::text, last_hash, NEW.created_at::text),
        'sha256'
    ), 'hex');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_trail_hash
BEFORE INSERT ON audit_domain.audit_trail
FOR EACH ROW
EXECUTE FUNCTION audit_domain.hash_audit_entry();

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE hr_domain.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident_domain.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel_domain.epistemic_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel_domain.bitemporal_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kernel_domain.evidence_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_domain.audit_trail ENABLE ROW LEVEL SECURITY;

-- Realtime Publication Setup
ALTER PUBLICATION supabase_realtime ADD TABLE kernel_domain.bitemporal_obligations;
ALTER PUBLICATION supabase_realtime ADD TABLE kernel_domain.epistemic_facts;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_domain.audit_trail;

-- ------------------------------------------------------------------------------
-- 9. ROLE-TARGETED NOTIFICATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_role TEXT NOT NULL,
    sender_name TEXT DEFAULT 'Sistem SambungJaga',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    is_shown BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- No demo records are inserted. Real user profiles are created by Supabase Auth.
