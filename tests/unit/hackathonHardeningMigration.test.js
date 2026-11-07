import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Hackathon hardening migrations', () => {
  it('creates server-derived two-party handover drafts without default signatures', () => {
    const sql = fs.readFileSync(path.resolve('supabase/migrations/20261107100000_hackathon_pilot_hardening.sql'), 'utf8');
    expect(sql).toContain('ALTER COLUMN outgoing_signed_at DROP DEFAULT');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_handover_contract');
    expect(sql).toContain('p.user_id = auth.uid()');
    expect(sql).toContain('v_incoming.id = v_actor_id');
    expect(sql).toContain("'draft', NULL, NULL");
  });

  it('uses idempotent, facility- and resident-scoped offline report synchronization', () => {
    const sql = fs.readFileSync(path.resolve('supabase/migrations/20261107100000_hackathon_pilot_hardening.sql'), 'utf8');
    expect(sql).toContain('PRIMARY KEY (facility_id, client_submission_id)');
    expect(sql).toContain('public.sync_offline_care_report');
    expect(sql).toContain('v_resident_facility IS DISTINCT FROM v_facility_id');
    expect(sql).toContain('ON CONFLICT (facility_id, client_submission_id) DO NOTHING');
  });

  it('restricts family disclosures and visits to an explicitly linked resident', () => {
    const sql = fs.readFileSync(path.resolve('supabase/migrations/20261107110000_family_portal_integrity.sql'), 'utf8');
    expect(sql).toContain('family_disclosure_receipts');
    expect(sql).toContain('family_user_id = auth.uid()');
    expect(sql).toContain('resident_domain.family_resident_access');
    expect(sql).toContain("status");
  });
});
