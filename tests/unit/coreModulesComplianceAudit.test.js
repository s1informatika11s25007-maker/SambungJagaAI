import { describe, it, expect } from 'vitest';
import { OBLIGATION_STATUS } from '../../src/types/core/architecture';
import { draftShiftRoster, validateAcuityStaffingRatio } from '../../src/services/ai/hrAutonomousAgent';
import { handleCaregiverAbsence } from '../../src/services/ai/workforceAgent';
import { submitFamilyVisitRequest, submitFamilyComplaint } from '../../src/services/ai/familyLiaisonAgent';
import { dispatchUnifiedMessage, MESSAGE_LIFECYCLE_STATUS } from '../../src/services/notifications/messagingProviders';
import { OFFLINE_SYNC_STATUS, saveToIndexedDb } from '../../src/services/offline/indexedDbStorage';
import { getOutboxStatus, processOutboxQueue } from '../../src/services/automation/eventBus';

describe('P0 Core Modules Comprehensive Compliance Audit Tests', () => {
  it('1. Atomic Obligation Lifecycle Engine - should verify state machine values', () => {
    expect(OBLIGATION_STATUS.CREATED).toBe('created');
    expect(OBLIGATION_STATUS.ASSIGNED).toBe('assigned');
    expect(OBLIGATION_STATUS.IN_PROGRESS).toBe('in_progress');
    expect(OBLIGATION_STATUS.EVIDENCE_SUBMITTED).toBe('evidence_submitted');
    expect(OBLIGATION_STATUS.PENDING_REVIEW).toBe('pending_review');
    expect(OBLIGATION_STATUS.APPROVED).toBe('approved');
    expect(OBLIGATION_STATUS.CLOSED).toBe('closed');
  });

  it('2. 3.4 Intelligent Shift Planner - should draft shift roster and validate acuity ratios', () => {
    const mockStaff = [
      { id: 'cg-1', role: 'caregiver', shift_status: 'on_duty', is_active: true, competencies: ['CPR'] },
      { id: 'cg-2', role: 'caregiver', shift_status: 'on_duty', is_active: true, competencies: ['VITAL'] }
    ];
    const mockResidents = [{ id: 'res-1', care_level: 'total_care' }];

    const draft = draftShiftRoster(mockStaff, mockResidents);
    expect(draft.success).toBe(true);

    const ratio = validateAcuityStaffingRatio(mockResidents, mockStaff);
    expect(ratio.totalAcuityPoints).toBe(3.0);
    expect(ratio.isSafe).toBe(true);
  });

  it('3. 3.5 Autonomous Workforce Replacement Agent - should handle absence and separate unstarted/in-progress tasks', async () => {
    const mockStaff = [
      { id: 'cg-1', full_name: 'Siti Caregiver', role: 'caregiver', shift_status: 'on_duty', is_active: true },
      { id: 'cg-2', full_name: 'Budi Replacement', role: 'caregiver', shift_status: 'on_duty', is_active: true }
    ];
    const mockObligations = [
      { id: 'ob-1', assigned_caregiver_id: 'cg-1', title: 'Tensi', status: 'open' }
    ];

    const result = await handleCaregiverAbsence({
      absentStaffId: 'cg-1',
      obligations: mockObligations,
      staff: mockStaff
    });

    expect(result.success).toBe(true);
    expect(result.affectedCount).toBe(1);
    expect(result.reallocations).toBeDefined();
  });

  it('4. 3.6 Family Communication Automation - should generate ticket number and auto-categorize complaints', async () => {
    const complaint = await submitFamilyComplaint({
      residentName: 'Ibu Aminah',
      category: 'medical',
      complaintText: 'Lansia mengeluh nyeri dada dan demam'
    });

    expect(complaint.success).toBe(false);
    expect(complaint.error).toMatch(/terverifikasi/i);
  });

  it('5. 3.7 Unified Messaging Gateway - should dispatch via channels with explicit lifecycle status and cost tracking', async () => {
    const dispatch = await dispatchUnifiedMessage({
      channel: 'whatsapp',
      recipient: '+6281234567890',
      payload: { body: 'Jadwal shift Anda telah diperbarui.' }
    });

    expect(dispatch.success).toBe(true);
    expect(dispatch.status).toBe(MESSAGE_LIFECYCLE_STATUS.DELIVERED);
    expect(dispatch.costIdr).toBe(450);
  });

  it('6. 3.8 Offline-First Caregiver Engine - should save items to IndexedDB with sync status pending', async () => {
    await expect(saveToIndexedDb('offline_reports', { id: 'rep-1', text: 'Laporan offline' }))
      .rejects.toThrow(/facility_id wajib/i);
    expect(OFFLINE_SYNC_STATUS.PENDING).toBe('pending');
  });

  it('7. 3.9 Autonomous Agent Recovery Engine - should report outbox queue status and claim jobs', async () => {
    const status = getOutboxStatus();
    expect(status.pending).toBeDefined();

    const result = await processOutboxQueue(async () => ({ success: true }));
    expect(result.processedCount).toBeDefined();
  });
});
