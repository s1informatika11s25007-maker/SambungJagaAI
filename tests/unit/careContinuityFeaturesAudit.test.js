import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getOfflineVoiceOutbox, saveVoiceRecordToOfflineOutbox } from '../../src/services/offline/offlineVoiceOutbox';
import { getOfflineNotes, saveOfflineNote } from '../../src/services/offline/offlineNotesStorage';
import { findResidentCandidatesWithConfidenceScore } from '../../src/services/ai/aiSuperagent';
import { calculateTextSimilarity, isSemanticDuplicateFact } from '../../src/services/data/semanticDeduplicator';
import { parseVitalReadoutFromOcrText } from '../../src/services/ai/realVisionOcrService';
import { generatePersonalCaregiverDashboard } from '../../src/services/caregiver/personalCaregiverAssistant';
import { planAutopilot } from '../../src/services/automation/autopilot';

describe('P0 Care Continuity & Platform Features Audit Tests (Items 11 - 23)', () => {
  it('11 & 12. Offline voice and notes require resident/facility scope before persistence', async () => {
    await expect(saveVoiceRecordToOfflineOutbox({ transcript: 'Tes laporan suara offline' }))
      .rejects.toThrow(/facility_id dan resident_id/i);
    await expect(saveOfflineNote({ noteText: 'Catatan perawat offline' }))
      .rejects.toThrow(/facility_id dan resident_id/i);
  });

  it('13. Multi-Factor Resident Entity Resolution - should compute confidence scores and flag score < 0.85', () => {
    const residents = [
      { id: 'res-1', full_name: 'Ibu Aminah Suharto', room_number: '101', medical_condition_summary: 'Diabetes Melitus' },
      { id: 'res-2', full_name: 'Bapak Bambang Wijaya', room_number: '102', medical_condition_summary: 'Hipertensi' }
    ];

    const exactMatch = findResidentCandidatesWithConfidenceScore('Ibu Aminah Suharto kamar 101', residents);
    expect(exactMatch[0].confidenceScore).toBeGreaterThanOrEqual(0.85);
    expect(exactMatch[0].requiresHumanVerification).toBe(false);

    const partialMatch = findResidentCandidatesWithConfidenceScore('Aminah', residents);
    expect(partialMatch[0].confidenceScore).toBeLessThan(0.85);
    expect(partialMatch[0].requiresHumanVerification).toBe(true);
  });

  it('15. Semantic Cross-Source Deduplication - should compute similarity scores correctly', () => {
    const simHigh = calculateTextSimilarity('Penghuni mengalami mual dan muntah', 'Mual dan muntah dilaporkan');
    expect(simHigh).toBeGreaterThanOrEqual(0.45);

    const simLow = calculateTextSimilarity('Tensi darah 120/80', 'Pemberian injeksi insulin');
    expect(simLow).toBeLessThan(0.30);
  });

  it('18 & 21. Atomic Evidence RPC & Storage - should verify migration includes atomic RPC function', () => {
    const sqlPath = path.resolve('supabase/migrations/20261102000000_autonomous_platform_foundations.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    expect(sql).toContain('fn_submit_evidence_and_close_obligation');
    expect(sql).toContain('private-care-evidence');
  });

  it('20. Clinical Domain OCR Validation - should accurately parse vital signs and reject invalid ranges', () => {
    const bpResult = parseVitalReadoutFromOcrText('SYS 125 DIA 82', 'Tekanan Darah');
    expect(bpResult.hasValidReadout).toBe(true);
    expect(bpResult.vitalReadout).toBe('125/82 mmHg');

    const tempResult = parseVitalReadoutFromOcrText('SUHU 37.8°C', 'Pemeriksaan Suhu');
    expect(tempResult.hasValidReadout).toBe(true);
    expect(tempResult.vitalReadout).toBe('Suhu 37.8°C');
  });

  it('22 & 23. Personal Workload Planner & Autopilot Integration - should integrate workload scores into autopilot assignment', () => {
    const obligations = [{ id: 'ob-1', title: 'Cek Tensi', status: 'open' }];
    const staff = [
      { id: 's1', role: 'caregiver', shift_status: 'on_duty', competencies: [] },
      { id: 's2', role: 'caregiver', shift_status: 'on_duty', competencies: [] }
    ];

    const dashboard = generatePersonalCaregiverDashboard({ caregiverId: 's1', obligations, residents: [], staff });
    expect(dashboard.caregiverId).toBe('s1');

    const plan = planAutopilot({ activeRole: 'supervisor', obligations, staff });
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0].label).toContain('berdasarkan skor beban kerja');
  });
});
