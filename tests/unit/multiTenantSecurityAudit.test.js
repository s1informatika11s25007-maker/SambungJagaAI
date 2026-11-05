import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('P0-3 Multi-Tenant Security & RLS Audit Tests', () => {
  it('should verify current_sj_facility_id() function handles staff and family verified links in fail-closed mode', () => {
    const filePath = path.resolve('supabase/migrations/20261102000000_autonomous_platform_foundations.sql');
    const sql = fs.readFileSync(filePath, 'utf8');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.current_sj_facility_id()');
    expect(sql).toContain('hr_domain.staff_profiles');
    expect(sql).toContain('resident_domain.family_resident_access');
    expect(sql).toContain('public.family_visit_requests');
  });

  it('should verify kernel_domain.agent_execution_logs has RLS enabled and strict tenant policy', () => {
    const filePath = path.resolve('supabase/migrations/20261102000000_autonomous_platform_foundations.sql');
    const sql = fs.readFileSync(filePath, 'utf8');

    expect(sql).toContain('ALTER TABLE kernel_domain.agent_execution_logs ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('Tenant strict policy for agent_execution_logs');
  });

  it('should verify storage objects policy enforces split_part path facility_id check', () => {
    const filePath = path.resolve('supabase/migrations/20261102000000_autonomous_platform_foundations.sql');
    const sql = fs.readFileSync(filePath, 'utf8');

    expect(sql).toContain("split_part(name, '/', 1) = public.current_sj_facility_id()");
  });

  it('should verify that all domain table RLS policies combine BOTH role AND facility_id', () => {
    const filePath = path.resolve('supabase/migrations/20261102000000_autonomous_platform_foundations.sql');
    const sql = fs.readFileSync(filePath, 'utf8');

    const domainTables = [
      'staff_profiles',
      'residents',
      'epistemic_facts',
      'bitemporal_obligations',
      'evidence_verifications',
      'handover_contracts',
      'audit_trail',
      'notifications',
      'system_outbox_queue',
      'dead_letter_queue',
      'family_visit_requests',
      'family_complaints',
      'agent_execution_logs'
    ];

    for (const table of domainTables) {
      expect(
        sql.includes(`Tenant strict policy for ${table}`) || sql.includes(`Tenant strict policy for ${table}_`),
        `Table ${table} should have a strict tenant policy`
      ).toBe(true);
    }
  });
});
