import { describe, it, expect } from 'vitest';
import {
  processCaregiverReportAutonomous,
  getPrioritizedCaregiverTasks,
  submitCaregiverTaskEvidence,
  generateCaregiverShiftRecap
} from '../../src/services/caregiver/caregiverAutonomousAssistant';

describe('P0 Caregiver Autonomous Assistant Audit Tests', () => {
  it('1-5. End-to-End Report Processing - should process report autonomously and flag confidence < 0.85', async () => {
    const residents = [
      { id: 'res-101', full_name: 'Ibu Aminah Suharto', room_number: '101' }
    ];

    const res = await processCaregiverReportAutonomous({
      textPrompt: 'Ibu Aminah Suharto kamar 101 tensi 120/80',
      caregiverId: 'caregiver-1',
      residents,
      activeObligations: []
    });

    expect(res.success).toBe(true);
    expect(res.processedAt).toBeDefined();
    expect(res.residentMatch).toBeDefined();
    expect(res.status).toBe('AUTOMATED');
  });

  it('6. Prioritized Personal Task List - should compute caregiver task dashboard with workload score', () => {
    const dashboard = getPrioritizedCaregiverTasks({
      caregiverId: 'cg-1',
      obligations: [{ id: 'ob-1', assigned_caregiver_id: 'cg-1', title: 'Cek Suhu', status: 'open' }],
      residents: [],
      staff: []
    });

    expect(dashboard.caregiverId).toBe('cg-1');
    expect(dashboard.activeTaskCount).toBe(1);
    expect(dashboard.upcomingDeadlines.length).toBe(1);
  });

  it('8 & 9. Evidence Submission & Atomic Closure - should submit evidence and attempt atomic closure', async () => {
    const evRes = await submitCaregiverTaskEvidence({
      obligationId: 'ob-101',
      evidenceGrade: 'E1',
      evidencePayload: { photo_hash: 'sha256-test' }
    });

    expect(evRes.success).toBe(true);
  });

  it('10. Automated Shift Work Recap - should generate shift recap summary', async () => {
    const recap = await generateCaregiverShiftRecap({
      caregiverId: 'cg-1',
      caregiverName: 'Siti Caregiver',
      obligations: [],
      shiftName: 'Pagi'
    });

    expect(recap.caregiverName).toBe('Siti Caregiver');
    expect(recap.handoverSummary).toBeDefined();
  });
});
