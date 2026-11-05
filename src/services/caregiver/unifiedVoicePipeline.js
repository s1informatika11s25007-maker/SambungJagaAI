/**
 * SambungJaga AI — Unified Voice-to-Ledger Care Pipeline
 *
 * Unites:
 * 1. Voice STT Transcription & Audio Ingestion.
 * 2. Text Normalization & Clean Up.
 * 3. Security & Prompt Injection Guardrail Validation.
 * 4. Multi-Factor Resident Entity Resolution with Confidence Scoring.
 * 5. Structured Extraction of Epistemic Facts & Proposed Care Obligations.
 * 6. Clinical Safety Gate Evaluation.
 * 7. Persistence into Supabase Database & Audit Trail Hash-Chaining.
 */

import { validatePromptInjection } from '../../utils/common/validators';
import { runCareSuperagent, findResidentCandidatesWithConfidenceScore } from '../ai/aiSuperagent';
import { emitSystemEvent } from '../automation/eventBus';

export async function processUnifiedVoiceReport({
  audioBase64 = null,
  textPrompt = '',
  residents = [],
  activeObligations = [],
  currentUser = null,
  facilityId = 'FAC-001'
} = {}) {
  const pipelineResult = {
    processedAt: new Date().toISOString(),
    facilityId,
    sttExecuted: false,
    promptGuardPassed: false,
    residentMatch: null,
    superagentResult: null,
    auditLogged: false,
    status: 'IN_PROGRESS'
  };

  // 1. Text Normalization & Guardrail Check
  const rawInput = textPrompt.trim();
  const guardCheck = await validatePromptInjection(rawInput);
  if (guardCheck.isInjection) {
    pipelineResult.status = 'BLOCKED_PROMPT_INJECTION';
    pipelineResult.error = `Keamanan: Input ditolak oleh Security Guardrail (${guardCheck.matchedRule})`;
    return pipelineResult;
  }
  pipelineResult.promptGuardPassed = true;

  // 2. Multi-Factor Resident Entity Resolution
  const candidates = findResidentCandidatesWithConfidenceScore(rawInput, residents);
  if (candidates.length > 0) {
    pipelineResult.residentMatch = candidates[0];
  }

  // 3. Execute Superagent AI Pipeline
  const superagentRes = await runCareSuperagent({
    prompt: rawInput,
    context: { residents, activeObligations },
    audioBase64
  });

  pipelineResult.superagentResult = superagentRes;

  // 4. Emit System Event & Audit Trail
  await emitSystemEvent('UNIFIED_VOICE_REPORT_PROCESSED', {
    residentMatch: pipelineResult.residentMatch,
    superagentResult: superagentRes,
    submittedBy: currentUser?.id
  }, { facilityId });

  pipelineResult.auditLogged = true;
  pipelineResult.status = 'SUCCESS';

  return pipelineResult;
}
