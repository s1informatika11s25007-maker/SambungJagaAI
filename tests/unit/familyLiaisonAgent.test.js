import { describe, it, expect } from 'vitest';
import { generateFamilyProgressSummary, submitFamilyVisitRequest, submitFamilyComplaint } from '../../src/services/ai/familyLiaisonAgent';

describe('Family Liaison Superagent Unit Tests', () => {
  const resident = { id: 'res-1', full_name: 'Oma Aminah' };
  const obligations = [
    { id: 'o-1', resident_id: 'res-1', title: 'Makan Pagi', status: 'verified_closed' },
    { id: 'o-2', resident_id: 'res-1', title: 'Minum Obat', status: 'open' }
  ];

  it('should generate accurate progress summary text', async () => {
    const summary = await generateFamilyProgressSummary(resident, obligations);
    expect(summary.residentName).toBe('Oma Aminah');
    expect(summary.completedCount).toBe(1);
    expect(summary.totalCount).toBe(2);
    expect(summary.summaryText).toContain('1 dari 2');
  });

  it('should submit visit request and evaluate visiting rules', async () => {
    const res = await submitFamilyVisitRequest({
      familyUserId: 'fam-1',
      residentId: 'res-1',
      residentName: 'Oma Aminah',
      proposedDate: '2026-11-10',
      proposedTime: '10:00',
      visitorCount: 2
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/terverifikasi/i);
  });

  it('should submit and auto-categorize family complaint', async () => {
    const res = await submitFamilyComplaint({
      familyUserId: 'fam-1',
      residentId: 'res-1',
      residentName: 'Oma Aminah',
      category: 'clinical',
      complaintText: 'Ibu Aminah mengeluh demam dan pusing setelah makan.'
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/terverifikasi/i);
  });
});
