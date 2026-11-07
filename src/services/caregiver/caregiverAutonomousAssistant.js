/**
 * SambungJaga AI — Caregiver Autonomous Assistant Workflow
 *
 * Database success is reported only when the unified pipeline receives
 * acknowledgement from Supabase.
 */

import {
  processUnifiedVoiceReport
} from './unifiedVoicePipeline';

import {
  generatePersonalCaregiverDashboard
} from './personalCaregiverAssistant';

import {
  submitEvidenceAndCloseObligationAtomic
} from './evidenceVerifier';

import {
  synthesizeAutonomousHandoverDraft
} from '../handover/handoverContractService';


/**
 * Processes an already-transcribed caregiver report.
 */

export async function processCaregiverReportAutonomous({
  audioBase64 = null,
  textPrompt = '',
  caregiverId = null,
  currentUser = null,
  residents = [],
  activeObligations = [],
  epistemicFacts = [],
  facilityId = null,
  sourceType = null
} = {}) {
  const now = new Date().toISOString();

  const transcript = String(
    textPrompt || ''
  ).trim();

  if (!transcript) {
    return {
      success: false,
      status: 'TRANSCRIPTION_REQUIRED',

      error:
        'Transkrip teks belum tersedia. Audio tidak boleh dianggap sudah ditranskripsi.'
    };
  }

  const resolvedFacilityId =
    facilityId ||
    currentUser?.facility_id ||
    residents.find(
      resident => resident?.facility_id
    )?.facility_id ||
    null;

  const pipeline = await processUnifiedVoiceReport({
    audioBase64,
    textPrompt: transcript,
    residents,
    activeObligations,
    epistemicFacts,
    currentUser,
    caregiverId,
    facilityId: resolvedFacilityId,

    sourceType:
      sourceType ||
      (audioBase64 ? 'voice_stt' : 'text_input')
  });

  if (pipeline?.success !== true) {
    return {
      success: false,

      status:
        pipeline?.status || 'PIPELINE_FAILED',

      error:
        pipeline?.error ||
        'Laporan belum berhasil diproses dan disimpan.',

      processedAt:
        pipeline?.processedAt || now,

      residentMatch:
        pipeline?.residentMatch || null,

      residentCandidates:
        pipeline?.residentCandidates || [],

      requiresHumanConfirm:
        pipeline?.requiresHumanConfirm === true ||
        pipeline?.needsResidentConfirmation === true,

      superagentResult:
        pipeline?.superagentResult || null,

      isDuplicate:
        pipeline?.isDuplicate === true
    };
  }

  return {
    success: true,

    status: pipeline.status,

    processedAt: now,

    residentMatch:
      pipeline.residentMatch,

    residentCandidates:
      pipeline.residentCandidates || [],

    requiresHumanConfirm: false,

    superagentResult:
      pipeline.superagentResult,

    persisted:
      pipeline.persisted,

    auditLogged:
      pipeline.auditLogged,

    message:
      pipeline.message
  };
}


/**
 * Personal caregiver dashboard.
 */

export function getPrioritizedCaregiverTasks({
  caregiverId,
  obligations = [],
  residents = [],
  staff = []
}) {
  return generatePersonalCaregiverDashboard({
    caregiverId,
    obligations,
    residents,
    staff
  });
}


/**
 * Evidence submission.
 */

export async function submitCaregiverTaskEvidence({
  obligationId,
  evidenceGrade = 'E1',
  evidencePayload = {},
  imageDataUrl = null,
  facilityId = null
} = {}) {
  return submitEvidenceAndCloseObligationAtomic({
    obligationId,
    evidenceGrade,
    evidencePayload,
    imageDataUrl,
    facilityId
  });
}


/**
 * Shift recap.
 */

export async function generateCaregiverShiftRecap({
  caregiverId,
  caregiverName,
  obligations = [],
  shiftName = 'Pagi'
}) {
  const myClosed = obligations.filter(
    item =>
      item.assigned_caregiver_id === caregiverId &&
      item.status === 'verified_closed'
  );

  const myPending = obligations.filter(
    item =>
      item.assigned_caregiver_id === caregiverId &&
      item.status !== 'verified_closed'
  );

  const handover = await synthesizeAutonomousHandoverDraft({
    outgoingStaffId: caregiverId,
    shiftName,
    obligations
  });

  return {
    caregiverId,
    caregiverName,
    shiftName,

    recapTimestamp:
      new Date().toISOString(),

    closedTaskCount:
      myClosed.length,

    pendingTaskCount:
      myPending.length,

    handoverSummary:
      handover?.handoverContract?.open_obligations_summary ||
      `Shift ${shiftName}: ${myClosed.length} tugas berstatus selesai dan ${myPending.length} tugas masih terbuka.`
  };
}