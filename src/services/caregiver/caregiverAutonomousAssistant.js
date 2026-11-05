/**
 * SambungJaga AI — Caregiver Autonomous Assistant (End-to-End Workflow)
 *
 * Automates the 10-step caregiver operational workflow:
 * 1. Voice Report Ingestion & Offline-First Persistence (IndexedDB)
 * 2. STT Transcription & Text Structuring
 * 3. Multi-Factor Resident Identity Resolution (<0.85 flags human verification)
 * 4. Fact Extraction & Bitemporal Obligation Proposal
 * 5. Workforce Competency & Workload Assignment
 * 6. Prioritized Personal Task Dashboard & Countdown
 * 7. Physical Care Execution
 * 8. Photo Evidence Capture, SHA-256 Attestation & Private Storage Upload
 * 9. Atomic Obligation Closure & Status Update
 * 10. Automated Shift Work Recap Synthesis
 */

import { saveVoiceRecordToOfflineOutbox } from '../offline/offlineVoiceOutbox';
import { processUnifiedVoiceReport } from './unifiedVoicePipeline';
import { generatePersonalCaregiverDashboard } from './personalCaregiverAssistant';
import { submitEvidenceAndCloseObligationAtomic } from './evidenceVerifier';
import { synthesizeAutonomousHandoverDraft } from '../handover/handoverContractService';

/**
 * 1-4. Processes a caregiver voice or text report end-to-end autonomously.
 */
export async function processCaregiverReportAutonomous({
  audioBase64 = null,
  textPrompt = '',
  caregiverId = null,
  residents = [],
  activeObligations = [],
  facilityId = 'FAC-001'
}) {
  const now = new Date().toISOString();

  // 1. Save locally to IndexedDB first (True Offline-First)
  await saveVoiceRecordToOfflineOutbox({
    audioBase64,
    transcript: textPrompt,
    recordedAt: now
  });

  // 2-4. Execute Unified Voice-to-Ledger Pipeline
  const pipeline = await processUnifiedVoiceReport({
    audioBase64,
    textPrompt,
    residents,
    activeObligations,
    facilityId
  });

  const requiresHumanConfirm = pipeline.residentMatch?.requiresHumanVerification === true;

  return {
    success: true,
    processedAt: now,
    residentMatch: pipeline.residentMatch,
    requiresHumanConfirm,
    superagentResult: pipeline.superagentResult,
    status: requiresHumanConfirm ? 'HUMAN_CONFIRMATION_REQUIRED' : 'AUTOMATED'
  };
}

/**
 * 6. Fetches prioritized personal caregiver work list.
 */
export function getPrioritizedCaregiverTasks({ caregiverId, obligations = [], residents = [], staff = [] }) {
  return generatePersonalCaregiverDashboard({ caregiverId, obligations, residents, staff });
}

/**
 * 8 & 9. Submits evidence and closes task atomically in database.
 */
export async function submitCaregiverTaskEvidence({
  obligationId,
  evidenceGrade = 'E1',
  evidencePayload = {},
  imageDataUrl = null,
  facilityId = 'FAC-001'
}) {
  return submitEvidenceAndCloseObligationAtomic({
    obligationId,
    evidenceGrade,
    evidencePayload,
    imageDataUrl,
    facilityId
  });
}

/**
 * 10. Generates automated daily/shift work recap for caregiver.
 */
export async function generateCaregiverShiftRecap({ caregiverId, caregiverName, obligations = [], shiftName = 'Pagi' }) {
  const myClosed = obligations.filter(o => o.assigned_caregiver_id === caregiverId && o.status === 'verified_closed');
  const myPending = obligations.filter(o => o.assigned_caregiver_id === caregiverId && o.status !== 'verified_closed');

  const handover = await synthesizeAutonomousHandoverDraft({
    outgoingStaffId: caregiverId,
    shiftName,
    obligations
  });

  return {
    caregiverId,
    caregiverName,
    shiftName,
    recapTimestamp: new Date().toISOString(),
    closedTaskCount: myClosed.length,
    pendingTaskCount: myPending.length,
    handoverSummary: handover.handoverContract?.open_obligations_summary || `Shift ${shiftName}: ${myClosed.length} tugas selesai, ${myPending.length} tugas terbuka.`
  };
}
