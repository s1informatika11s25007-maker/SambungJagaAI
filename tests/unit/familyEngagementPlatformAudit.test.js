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

describe('Family portal fail-closed safeguards', () => {
  it('rejects visit requests without authenticated UUIDs and facility scope', async () => {
    const result = await submitFamilyVisitRequest({
      familyUserId: 'not-a-uuid', residentId: 'resident-1', residentName: 'Ibu Aminah',
      proposedDate: '2026-11-10', proposedTime: '10:00', visitorCount: 2
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/terverifikasi/i);
  });

  it('does not claim disclosure receipts were stored without verified identities', async () => {
    const result = await confirmDisclosureReceipt({ digestId: 'digest-1', familyUserId: 'fam-1', residentId: 'res-1' });
    expect(result.success).toBe(false);
  });

  it('does not claim notification preferences were stored without account and facility scope', async () => {
    const result = await updateFamilyNotificationPreferences('fam-pref-1', { whatsapp: true });
    expect(result.success).toBe(false);
    expect(getFamilyNotificationPreferences('fam-pref-1').whatsapp).toBe(false);
  });

  it('rejects complaint submission and status updates without verified records', async () => {
    const submit = await submitFamilyComplaint({
      familyUserId: 'fam-1', residentId: 'res-1', residentName: 'Ibu Aminah',
      category: 'clinical', complaintText: 'Lansia mengeluh demam dan nyeri.'
    });
    expect(submit.success).toBe(false);

    const update = await updateComplaintStatus({ complaintId: 'cmp-1', status: 'resolved' });
    expect(update.success).toBe(false);
  });

  it('keeps consent pending until a persistent, authorized consent workflow exists', () => {
    const updated = updateConsentState({ residentId: 'res-1', consentType: 'MEDICAL_DISCLOSURE' });
    const state = getConsentState('res-1', 'MEDICAL_DISCLOSURE');
    expect(updated.success).toBe(false);
    expect(updated.consentStatus).toBe('PENDING');
    expect(state.consentStatus).toBe('PENDING');
    expect(state.persisted).toBe(false);
  });

  it('does not schedule a family digest without a database-derived facility', async () => {
    const result = await scheduleDailyFamilyDigests({
      residents: [{ id: 'resident-1', full_name: 'Ibu Aminah' }], obligations: []
    });
    expect(result.scheduledCount).toBe(1);
    expect(result.digests[0].success).toBe(false);
    expect(result.digests[0].outboxSaved).toBe(false);
  });

  it('requires a facility for reminder sweep', async () => {
    const result = await runFamilyResponseReminderSweep({});
    expect(result.success).toBe(false);
    expect(result.status).toBe('CONFIGURATION_ERROR');
  });
});
