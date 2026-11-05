-- ==============================================================================
-- SambungJaga AI — Unified Messaging & Notification Gateway Schema
-- Migration: 20261103160000_unified_messaging_gateway_schema.sql
-- ==============================================================================

-- 1. NOTIFICATION OUTBOX TABLE
CREATE TABLE IF NOT EXISTS public.notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID,
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    channel TEXT NOT NULL DEFAULT 'in_app', -- 'whatsapp' | 'email' | 'sms' | 'in_app' | 'push' | 'family_portal'
    template_id TEXT NOT NULL DEFAULT 'DEFAULT_TEMPLATE',
    idempotency_key TEXT UNIQUE,
    provider_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    delivery_timestamp TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_outbox_idempotency ON public.notification_outbox(idempotency_key);

-- 2. NOTIFICATION DELIVERIES LOG TABLE
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES public.notification_outbox(id) ON DELETE CASCADE,
    recipient_user_id UUID,
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    channel TEXT NOT NULL,
    provider_name TEXT NOT NULL DEFAULT 'unified_gateway',
    provider_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'sent', -- 'sent' | 'delivered' | 'read' | 'failed'
    response_payload JSONB DEFAULT '{}'::jsonb,
    delivered_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. NOTIFICATION PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id UUID PRIMARY KEY,
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

-- 4. NOTIFICATION TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS public.notification_templates (
    template_id TEXT PRIMARY KEY,
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    template_name TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'in_app',
    subject_template TEXT,
    body_template TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PROVIDER WEBHOOK EVENTS TABLE (Official Provider Webhooks / BSP Callbacks)
CREATE TABLE IF NOT EXISTS public.provider_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id TEXT NOT NULL DEFAULT 'FAC-001',
    provider_name TEXT NOT NULL,
    provider_message_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'DELIVERED' | 'READ' | 'FAILED' | 'SENT'
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed BOOLEAN NOT NULL DEFAULT false,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PERMISSIONS
GRANT SELECT, INSERT, UPDATE ON public.notification_outbox TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notification_deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT SELECT ON public.notification_templates TO authenticated;
GRANT SELECT, INSERT ON public.provider_webhook_events TO authenticated;
