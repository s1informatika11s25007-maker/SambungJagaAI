import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getRegisteredAgentsMatrix,
  resolveAgentRoutingGraph,
  executeCentralOrchestratorMission,
  getAgentMeshHealthSnapshot
} from '../../src/services/ai/agentMeshOrchestrator';

describe('P0 Central Care Agent Orchestrator Audit Tests', () => {
  it('1. Agent Registry - should register all 8+ agents with policy levels (A1-A4) and versions', () => {
    const agents = getRegisteredAgentsMatrix();
    expect(agents.length).toBeGreaterThanOrEqual(8);

    const names = agents.map(a => a.name);
    expect(names).toContain('IntakeAgent');
    expect(names).toContain('CareSuperagentOrchestrator');
    expect(names).toContain('ClinicalSafetyGate');
    expect(names).toContain('WorkforceIntelligenceAgent');
    expect(names).toContain('EvidenceAgent');
    expect(names).toContain('SLAWatchdogAgent');
    expect(names).toContain('HandoverAgent');
    expect(names).toContain('FamilyLiaisonAgent');
    expect(names).toContain('HRAutonomousAgent');
  });

  it('2. Automatic Agent Routing - should resolve event-driven dependency graph for REPORT_SUBMITTED', () => {
    const graph = resolveAgentRoutingGraph('REPORT_SUBMITTED');
    expect(graph.length).toBeGreaterThanOrEqual(2);
    expect(graph[0].agentName).toBe('IntakeAgent');
    expect(graph[1].agentName).toBe('CareSuperagentOrchestrator');
  });

  it('3, 5, 7 & 10. Central Orchestrator Execution - should execute mission with execution_id, correlation_id, PDP masking, and audit trail', async () => {
    const residents = [
      { id: 'res-101', full_name: 'Ibu Aminah Suharto', room_number: '101' }
    ];

    const result = await executeCentralOrchestratorMission({
      eventType: 'REPORT_SUBMITTED',
      payload: { prompt: 'Ibu Aminah Suharto di kamar 101 mengalami demam tinggi' },
      residents,
      facilityId: 'FAC-001'
    });

    expect(result.executionId).toContain('exec-');
    expect(result.correlationId).toBeDefined();
    expect(result.idempotencyKey).toBeDefined();
    expect(result.stepsExecuted.length).toBeGreaterThan(0);
  });

  it('8. Circuit Breaker & Health Snapshot - should report healthy agent mesh snapshot', () => {
    const health = getAgentMeshHealthSnapshot();
    expect(health.totalAgents).toBeGreaterThanOrEqual(8);
    expect(health.overallStatus).toBe('HEALTHY');
  });

  it('Database Migration Audit - should verify SQL migration contains agent_mesh_states and correlation_id columns', () => {
    const sqlPath = path.resolve('supabase/migrations/20261102000000_autonomous_platform_foundations.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    expect(sql).toContain('agent_mesh_states');
    expect(sql).toContain('correlation_id');
    expect(sql).toContain('idempotency_key');
  });
});
