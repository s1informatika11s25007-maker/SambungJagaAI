-- Fix PostgreSQL digest trigger error by providing schema-safe native SHA-256 hash functions.
-- This resolves "function digest(text, unknown) does not exist" across all environment DBs.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Native SHA-256 digest helpers in public, audit_domain, and kernel_domain
CREATE OR REPLACE FUNCTION public.digest(msg TEXT, type TEXT) RETURNS BYTEA LANGUAGE SQL IMMUTABLE AS $$ SELECT sha256(msg::bytea); $$;
CREATE OR REPLACE FUNCTION public.digest(msg TEXT, type ANYELEMENT) RETURNS BYTEA LANGUAGE SQL IMMUTABLE AS $$ SELECT sha256(msg::bytea); $$;

CREATE OR REPLACE FUNCTION audit_domain.digest(msg TEXT, type TEXT) RETURNS BYTEA LANGUAGE SQL IMMUTABLE AS $$ SELECT sha256(msg::bytea); $$;
CREATE OR REPLACE FUNCTION audit_domain.digest(msg TEXT, type ANYELEMENT) RETURNS BYTEA LANGUAGE SQL IMMUTABLE AS $$ SELECT sha256(msg::bytea); $$;

CREATE OR REPLACE FUNCTION kernel_domain.digest(msg TEXT, type TEXT) RETURNS BYTEA LANGUAGE SQL IMMUTABLE AS $$ SELECT sha256(msg::bytea); $$;
CREATE OR REPLACE FUNCTION kernel_domain.digest(msg TEXT, type ANYELEMENT) RETURNS BYTEA LANGUAGE SQL IMMUTABLE AS $$ SELECT sha256(msg::bytea); $$;

-- Update audit_domain.hash_audit_entry to use native PostgreSQL sha256
CREATE OR REPLACE FUNCTION audit_domain.hash_audit_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
    NEW.entry_hash := encode(
        sha256(
            concat(NEW.sequence_id::text, NEW.gateway_tag, NEW.action_name, NEW.payload::text, last_hash, NEW.created_at::text)::bytea
        ),
        'hex'
    );

    RETURN NEW;
END;
$$;

-- Update handover integrity trigger to use native PostgreSQL sha256
CREATE OR REPLACE FUNCTION kernel_domain.refresh_handover_integrity_digest()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.hash_signature := encode(
        sha256(
            concat(NEW.id::text, NEW.facility_id, NEW.outgoing_staff_id::text, NEW.incoming_staff_id::text, NEW.shift_type, NEW.handover_notes, NEW.created_at::text)::bytea
        ),
        'hex'
    );
    RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.digest(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.digest(TEXT, ANYELEMENT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION audit_domain.digest(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION audit_domain.digest(TEXT, ANYELEMENT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION kernel_domain.digest(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION kernel_domain.digest(TEXT, ANYELEMENT) TO anon, authenticated, service_role;
