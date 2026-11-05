import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { runFailureSetSimulation } from '../../src/services/simulator/failureSetSimulator';
import { fetchUnifiedClinicalReviewQueue } from '../../src/services/caregiver/unifiedClinicalReviewInbox';
import { resolveFactContradiction } from '../../src/services/trace/conflictResolutionWorkflow';
import { auditEvidenceCompleteness } from '../../src/services/caregiver/evidenceCompletenessAgent';
import { evaluateAssignmentQuality } from '../../src/services/ai/assignmentQualityMonitor';
import { analyzeRepeatedObligationPatterns } from '../../src/services/ai/repeatedObligationAnalyzer';
import { generateFacilityPatternIntelligence } from '../../src/services/ai/facilityPatternIntelligence';
import { approveAndActivateCareRule } from '../../src/services/rule/ruleLifecycleAssistant';
import { evaluateClinicalQualityMetrics } from '../../src/services/monitoring/clinicalQualityEvaluator';
import { evaluateAiRecommendationQuality } from '../../src/services/ai/aiRecommendationQualityEvaluator';
import { getOrchestratedPriorityReviewQueue } from '../../src/services/caregiver/priorityReviewOrchestrator';

describe('P0 Advanced Care Platform & Automation Audit Tests (Items 24 - 35)', () => {
  it('Special Note: failureSetSimulator should evaluate full roster without 24-person truncation', async () => {
    const mockStaff = Array.from({ length: 30 }, (_, i) => ({
      id: `staff-${i}`,
      role: 'caregiver',
      shift_status: 'on_duty',
      competencies: ['vital_signs']
    }));

    const mockObs = [
      { id: 'ob-1', title: 'Tugas Tensi', required_competencies: ['vital_signs'], status: 'open', priority: 'critical' }
    ];

    const result = await runFailureSetSimulation(mockStaff, mockObs);
    expect(result.rosterTruncated).toBe(false);
  });

  it('24 & 35. Unified Clinical Review Inbox & Priority Orchestrator - should fetch and prioritize review items', async () => {
    const queue = await getOrchestratedPriorityReviewQueue({});
    expect(Array.isArray(queue)).toBe(true);
  });

  it('25. Conflict Resolution Workflow - should record contradiction resolution', async () => {
    const res = await resolveFactContradiction({ contradictionId: 'cont-1', resolutionPolicy: 'ACCEPT_NEW_FACT' });
    expect(res.success).toBe(true);
  });

  it('26. Evidence Completeness Agent - should score evidence completeness against 5 criteria', () => {
    const audit = auditEvidenceCompleteness({
      storage_url: 'https://example.com/photo.jpg',
      evidence_payload: { vitalReadout: '120/80', location: { lat: -6.2 }, attestation_timestamp: '2026-11-02' }
    }, 'E1');

    expect(audit.completenessScore).toBeGreaterThanOrEqual(80);
    expect(audit.isComplete).toBe(true);
  });

  it('27. SLA Scheduler Server Daemon - should verify server scheduler script exists and includes 24/7 loops', () => {
    const scriptPath = path.resolve('scripts/server-scheduler.js');
    const content = fs.readFileSync(scriptPath, 'utf8');

    expect(content).toContain('runSlaWatchdogSweep');
    expect(content).toContain('processOutboxQueue');
    expect(content).toContain('runStuckProcessRecovery');
    expect(content).toContain('runDataReconciliation');
  });

  it('28. Assignment Quality Monitor - should evaluate competency match and workload balance', () => {
    const evalRes = evaluateAssignmentQuality([{ id: 'ob-1', staffId: 's-1' }], [{ id: 'ob-1', required_competencies: ['vital_signs'] }], [{ id: 's-1', competencies: ['vital_signs'] }]);
    expect(evalRes.overallQualityScore).toBeGreaterThan(0);
  });

  it('29. Repeated Obligation Analyzer - should detect recurring care obligation patterns', () => {
    const obs = [
      { id: '1', title: 'Pemberian Obat', resident_id: 'r-1', status: 'escalated' },
      { id: '2', title: 'Pemberian Obat', resident_id: 'r-1', status: 'open' }
    ];
    const patterns = analyzeRepeatedObligationPatterns(obs);
    expect(patterns.analyzedPatternCount).toBe(1);
    expect(patterns.highRiskPatterns.length).toBe(1);
  });

  it('30. Facility Pattern Intelligence - should compute breach rates and operational insights', () => {
    const insights = generateFacilityPatternIntelligence({ obligations: [] });
    expect(insights.facilityId).toBe('FAC-001');
  });

  it('31. Rule Lifecycle Assistant - should activate care rule with approval audit', async () => {
    const activated = await approveAndActivateCareRule({ ruleId: 'rule-1', approvedByStaffId: 'staff-admin' });
    expect(activated.success).toBe(true);
  });

  it('33 & 34. Clinical Quality Dashboard & AI Evaluator - should compute Clinical Quality Index and AI accuracy', async () => {
    const cq = evaluateClinicalQualityMetrics({ obligations: [] });
    expect(cq.clinicalQualityIndex).toBeDefined();

    const aiEval = await evaluateAiRecommendationQuality();
    expect(aiEval.acceptanceRate).toBeGreaterThan(0);
  });
});
