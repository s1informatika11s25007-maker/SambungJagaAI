import { describe, it, expect } from 'vitest';
import {
  confirmDisclosureReceipt,
  updateFamilyNotificationPreferences,
  getFamilyNotificationPreferences,
  updateComplaintStatus,
  updateConsentState,
  getConsentState,
  scheduleDailyFamilyDigests,
  runFamilyResponseReminderSweep,
  submitFamilyVisitRequest,
  submitFamilyComplaint
} from '../../src/services/ai/familyLiaisonAgent';

describe('P0 Family Engagement Platform Audit Tests (Items 36 - 44)', () => {
  it('36 & 38. Bi-directional Family Interaction & Visit Submissions - should submit visit request with familyUserId', async () => {
    const res = await submitFamilyVisitRequest({
      familyUserId: 'fam-user-123',
      residentId: 'res-456',
      residentName: 'Ibu Aminah',
      proposedDate: '2026-11-05',
      proposedTime: '10:00',
      visitorCount: 2
    });

    expect(res.success).toBe(true);
    expect(res.request.resident_name).toBe('Ibu Aminah');
    expect(res.message).toContain('Tersimpan');
  });

  it('37. Information Acknowledgment - should record disclosure receipt confirmation', async () => {
    const res = await confirmDisclosureReceipt({
      digestId: 'digest-1',
      familyUserId: 'fam-1',
      residentId: 'res-1'
    });

    expect(res.success).toBe(true);
    expect(res.confirmationRecord.confirmedAt).toBeDefined();
  });

  it('39. Family Notification Preferences - should save and retrieve quiet hours & channel preferences', () => {
    updateFamilyNotificationPreferences('fam-pref-1', {
      whatsapp: true,
      quietHoursStart: '21:30'
    });

    const pref = getFamilyNotificationPreferences('fam-pref-1');
    expect(pref.whatsapp).toBe(true);
    expect(pref.quietHoursStart).toBe('21:30');
  });

  it('40 & 41. Family Complaint Tracking - should submit complaint and update lifecycle status to resolved', async () => {
    const submitRes = await submitFamilyComplaint({
      familyUserId: 'fam-1',
      residentId: 'res-1',
      residentName: 'Oma Aminah',
      category: 'clinical',
      complaintText: 'Lansia mengeluh pusing dan demam'
    });

    expect(submitRes.success).toBe(true);
    expect(submitRes.complaint.severity).toBe('critical');

    const updateRes = await updateComplaintStatus({
      complaintId: submitRes.complaint.id,
      status: 'resolved',
      resolutionNotes: 'Sudah diperiksa dokter dan diberikan parasetamol'
    });

    expect(updateRes.success).toBe(true);
    expect(updateRes.status).toBe('resolved');
  });

  it('42. Full Consent Lifecycle - should manage consent state transitions', () => {
    updateConsentState({ residentId: 'res-1', consentType: 'MEDICAL_DISCLOSURE', consentStatus: 'GRANTED', grantedBy: 'fam-1' });
    const state = getConsentState('res-1', 'MEDICAL_DISCLOSURE');

    expect(state.consentStatus).toBe('GRANTED');
  });

  it('43 & 44. Scheduled Family Digests & Response Reminders - should generate scheduled digests and sweep reminders', async () => {
    const digests = await scheduleDailyFamilyDigests({
      residents: [{ id: 'res-1', full_name: 'Ibu Aminah' }],
      obligations: []
    });

    expect(digests.scheduledCount).toBe(1);

    const reminderSweep = await runFamilyResponseReminderSweep({});
    expect(reminderSweep.status).toBe('COMPLETED');
  });
});
