import { describe, it, expect } from 'vitest';
import {
  fetchSupervisorIntelligenceDashboard,
  executeSupervisorDecision
} from '../../src/services/caregiver/supervisorIntelligenceCenter';

describe('P0 Autonomous Supervisor Intelligence Center Audit Tests', () => {
  it('1. Dashboard Fetch - should fetch unified review queue and clinical quality metrics', async () => {
    const dashboard = await fetchSupervisorIntelligenceDashboard({
      obligations: [{ id: 'ob-1', title: 'Tugas Tensi', status: 'verified_closed' }],
      residents: [],
      staff: []
    });

    expect(dashboard.facilityId).toBe('FAC-001');
    expect(dashboard.clinicalQuality.clinicalQualityIndex).toBeDefined();
    expect(dashboard.assignmentQuality.overallQualityScore).toBeDefined();
    expect(Array.isArray(dashboard.reviewQueue)).toBe(true);
  });

  it('2. 1-Tap Supervisor Decision Execution - should execute decision and trigger administrative consequences', async () => {
    const reviewItem = {
      id: 'review-ev-1',
      type: 'EVIDENCE_VERIFICATION',
      payload: { id: 'ev-1', obligation_id: 'ob-1', evidence_grade: 'E1' }
    };

    const res = await executeSupervisorDecision({
      reviewItem,
      decision: 'APPROVED',
      supervisorNotes: 'Bukti foto telah sesuai standar klinis.'
    });

    expect(res.success).toBe(true);
    expect(res.decision).toBe('APPROVED');
    expect(res.consequencesExecuted.length).toBeGreaterThan(0);
  });
});
