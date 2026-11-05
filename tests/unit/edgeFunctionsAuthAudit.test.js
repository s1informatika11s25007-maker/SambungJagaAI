import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('P0-4 Edge Functions Authentication & Authorization Audit Tests', () => {
  const edgeFunctions = [
    'ai_consent_filter',
    'ai_evidence_verifier',
    'ai_failure_simulator',
    'ai_handover_contract',
    'ai_prompt_guard',
    'ai_rule_replay',
    'ai_superagent'
  ];

  it('should verify all 7 Edge Functions require Bearer JWT token and validate auth.getUser()', () => {
    for (const fnName of edgeFunctions) {
      const filePath = path.resolve(`supabase/functions/${fnName}/index.ts`);
      expect(fs.existsSync(filePath), `Edge function ${fnName} should exist`).toBe(true);

      const content = fs.readFileSync(filePath, 'utf8');
      expect(content, `${fnName} must check Authorization header`).toContain("req.headers.get('Authorization')");
      expect(content, `${fnName} must call auth.getUser()`).toContain('auth.getUser(');
      expect(content, `${fnName} must return 401 on missing or invalid auth`).toContain('401');
    }
  });

  it('should verify all 7 Edge Functions enforce role-based authorization', () => {
    for (const fnName of edgeFunctions) {
      const filePath = path.resolve(`supabase/functions/${fnName}/index.ts`);
      const content = fs.readFileSync(filePath, 'utf8');

      expect(content, `${fnName} must perform role authorization`).toContain('allowedRoles');
      expect(content, `${fnName} must return 403 on role mismatch`).toContain('403');
    }
  });

  it('should verify ai_superagent enforces tenant facility_id scoping on audit logs and strictly validates Safety Gate output', () => {
    const filePath = path.resolve('supabase/functions/ai_superagent/index.ts');
    const content = fs.readFileSync(filePath, 'utf8');

    expect(content).toContain('facilityId');
    expect(content).toContain("from('agent_execution_logs')");
    expect(content).toContain('facility_id: facilityId');

    // Strict decision validation in safety gate
    expect(content).toContain('parsedSafety.approved === true');
    expect(content).toContain('parsedSafety.safe === true');
  });

  it('should verify CORS headers dynamically restrict or scope origin instead of unvalidated wildcard', () => {
    for (const fnName of edgeFunctions) {
      const filePath = path.resolve(`supabase/functions/${fnName}/index.ts`);
      const content = fs.readFileSync(filePath, 'utf8');

      expect(content, `${fnName} must have getCorsHeaders function`).toContain("req.headers.get('origin')");
    }
  });
});
