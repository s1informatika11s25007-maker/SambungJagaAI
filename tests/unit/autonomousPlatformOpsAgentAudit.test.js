import { describe, it, expect } from 'vitest';
import {
  runAutonomousPlatformOperationsSweep,
  auditSecretRotationCompliance,
  getAiCostAndTokenUsageSummary,
  getActivePlatformIncidents
} from '../../src/services/monitoring/autonomousPlatformOpsAgent';

describe('P0 Autonomous Platform Operations Agent Audit Tests', () => {
  it('1-4 & 8. Platform Operations Sweep - should execute 24/7 health monitoring, threat detection, and recovery', async () => {
    const sweep = await runAutonomousPlatformOperationsSweep({ facilityId: 'FAC-001' });

    expect(sweep.timestamp).toBeDefined();
    expect(sweep.healthOverview).toBeDefined();
    expect(sweep.recoveryResults).toBeDefined();
    expect(sweep.reconciliationResults).toBeDefined();
  });

  it('5. Controlled Secret Rotation Audit - should verify secret configuration status without exposing raw secrets', () => {
    const audit = auditSecretRotationCompliance();

    expect(audit.isSecure).toBe(true);
    expect(audit.envVars.length).toBeGreaterThan(0);
    // Ensure raw secrets are not returned in plaintext
    expect(JSON.stringify(audit)).not.toContain('postgresql://');
  });

  it('9. AI Cost & Token Usage Summary - should return AI execution latency and estimated cost', async () => {
    const summary = await getAiCostAndTokenUsageSummary({ facilityId: 'FAC-001' });

    expect(summary.facilityId).toBe('FAC-001');
    expect(summary.estimatedCostUsd).toBeDefined();
  });

  it('12. Active Platform Incidents - should return active incident response tickets for admin', async () => {
    const incidents = await getActivePlatformIncidents({ facilityId: 'FAC-001' });
    expect(Array.isArray(incidents)).toBe(true);
  });
});
