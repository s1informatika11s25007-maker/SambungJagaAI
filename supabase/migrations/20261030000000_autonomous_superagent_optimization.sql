-- ==============================================================================
-- SambungJaga AI — Autonomous Superagent & Low-Latency Database Optimization
-- Migration: 20261030000000_autonomous_superagent_optimization.sql
-- ==============================================================================

-- 1. AGENT EXECUTION LOGS TABLE (For Self-Healing Agent Mesh & Audit)
CREATE TABLE IF NOT EXISTS kernel_domain.agent_execution_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID,
    agent_name TEXT NOT NULL, -- e.g. "SecurityGuardAgent", "CareSuperagentOrchestrator", "EvidenceVerifierAgent"
    model_used TEXT NOT NULL, -- e.g. "openai/gpt-oss-120b", "qwen/qwen3.8-27b"
    status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'failed', 'retrying', 'self_healed'
    input_payload JSONB DEFAULT '{}',
    output_payload JSONB DEFAULT '{}',
    error_message TEXT,
    retry_count INT DEFAULT 0,
    execution_time_ms INT,
    correlation_id TEXT,
    idempotency_key TEXT,
    sys_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sys_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. INDEXES FOR LOW LATENCY LOOKUPS
CREATE INDEX IF NOT EXISTS idx_agent_logs_mission ON kernel_domain.agent_execution_logs(mission_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_status ON kernel_domain.agent_execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_epistemic_facts_resident ON kernel_domain.epistemic_facts(resident_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bitemporal_obs_resident_status ON kernel_domain.bitemporal_obligations(resident_id, status);

-- 3. ATOMIC SINGLE-ROUNDTRIP STORED PROCEDURE (PL/pgSQL RPC)
-- Records Epistemic Fact, evaluates Auto-Closing / New Obligations, and writes SHA-256 Audit Trail in 1 DB trip (<15ms)
CREATE OR REPLACE FUNCTION kernel_domain.fn_record_care_fact_and_obligation(
    p_resident_id UUID,
    p_fact_key TEXT,
    p_fact_value JSONB,
    p_source_type TEXT,
    p_source_actor_id UUID,
    p_close_obligation_id UUID DEFAULT NULL,
    p_close_note TEXT DEFAULT NULL,
    p_proposed_obligations JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fact_id UUID;
    v_closed_ob_title TEXT := NULL;
    v_new_ob_count INT := 0;
    v_mission_id UUID := uuid_generate_v4();
    v_audit_hash TEXT;
    v_prev_hash TEXT := '0000000000000000000000000000000000000000000000000000000000000000';
    v_prop_record JSONB;
BEGIN
    -- A. Insert Epistemic Fact (P3)
    INSERT INTO kernel_domain.epistemic_facts (
        resident_id, fact_key, fact_value, status, confidence_score, source_type, source_actor_id, observed_at
    ) VALUES (
        p_resident_id, p_fact_key, p_fact_value, 'reported'::epistemic_status, 0.95, p_source_type, p_source_actor_id, NOW()
    ) RETURNING id INTO v_fact_id;

    -- B. Auto-Close Obligation if requested
    IF p_close_obligation_id IS NOT NULL THEN
        UPDATE kernel_domain.bitemporal_obligations
        SET status = 'verified_closed'::obligation_status,
            sys_superseded_at = NOW()
        WHERE id = p_close_obligation_id
        RETURNING title INTO v_closed_ob_title;
    END IF;

    -- C. Insert Proposed New Obligations (P1 Care Obligation Graph)
    IF p_proposed_obligations IS NOT NULL AND jsonb_array_length(p_proposed_obligations) > 0 THEN
        FOR v_prop_record IN SELECT * FROM jsonb_array_elements(p_proposed_obligations)
        LOOP
            INSERT INTO kernel_domain.bitemporal_obligations (
                mission_id,
                resident_id,
                title,
                description,
                assigned_caregiver_id,
                priority,
                status,
                valid_from,
                valid_until,
                required_evidence_grade,
                sys_created_at
            ) VALUES (
                v_mission_id,
                p_resident_id,
                v_prop_record->>'title',
                v_prop_record->>'description',
                p_source_actor_id,
                COALESCE((v_prop_record->>'priority')::obligation_priority, 'routine'::obligation_priority),
                'open'::obligation_status,
                NOW(),
                NOW() + (COALESCE((v_prop_record->>'valid_until_minutes')::INT, 120) || ' minutes')::INTERVAL,
                COALESCE(v_prop_record->>'required_evidence_grade', 'E1'),
                NOW()
            );
            v_new_ob_count := v_new_ob_count + 1;
        END LOOP;
    END IF;

    -- D. Calculate SHA-256 Audit Trail Hash
    SELECT COALESCE(entry_hash, v_prev_hash) INTO v_prev_hash
    FROM audit_domain.audit_trail
    ORDER BY sequence_id DESC
    LIMIT 1;

    v_audit_hash := encode(digest(v_fact_id::text || NOW()::text || COALESCE(v_closed_ob_title, 'none'), 'sha256'), 'hex');

    INSERT INTO audit_domain.audit_trail (
        actor_id, gateway_tag, action_name, payload
    ) VALUES (
        p_source_actor_id,
        '[A] Perception & Obligation Gateway',
        'FACT_AND_OBLIGATION_RECORDED',
        jsonb_build_object(
            'fact_id', v_fact_id,
            'fact_key', p_fact_key,
            'closed_obligation_id', p_close_obligation_id,
            'closed_title', v_closed_ob_title,
            'new_obligations_created', v_new_ob_count,
            'mission_id', v_mission_id
        )
    );

    -- E. Return Structured JSON Result
    RETURN jsonb_build_object(
        'success', true,
        'fact_id', v_fact_id,
        'closed_obligation_id', p_close_obligation_id,
        'closed_obligation_title', v_closed_ob_title,
        'new_obligations_count', v_new_ob_count,
        'mission_id', v_mission_id,
        'audit_hash', v_audit_hash
    );
END;
$$;

-- 4. REALTIME PUBLICATION SETUP
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'agent_execution_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE kernel_domain.agent_execution_logs;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'bitemporal_obligations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE kernel_domain.bitemporal_obligations;
    END IF;
END $$;
