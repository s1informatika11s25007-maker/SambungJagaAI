/**
 * SambungJaga AI — Real-time Agent Execution Progress Step Tracker
 *
 * Tracks step-by-step progress of the Care Superagent Pipeline:
 * Step 1: Voice STT Ingestion -> Step 2: Prompt Guard -> Step 3: Entity Resolution -> Step 4: Worker Extraction -> Step 5: Clinical Safety Gate
 */

const progressSubscribers = new Set();

export const PIPELINE_STEPS = [
  { id: 'stt', label: 'Voice STT Ingestion (Whisper Large V3 Turbo)', model: 'whisper-large-v3-turbo' },
  { id: 'guard', label: 'Security & Prompt Guardrail (Llama Prompt Guard 22M)', model: 'llama-prompt-guard-2-22m' },
  { id: 'entity', label: 'Multi-Factor Entity Resolution', model: 'rule-fuzzy-match' },
  { id: 'worker', label: 'Structured Fact & Obligation Extraction (Qwen 3.8 27B)', model: 'qwen/qwen3.8-27b' },
  { id: 'orchestrator', label: 'Care Mission Orchestration (GPT OSS 120B)', model: 'openai/gpt-oss-120b' },
  { id: 'safety', label: 'Clinical Safety & Authority Gate (GPT OSS Safeguard 20B)', model: 'openai/gpt-oss-safeguard-20b' }
];

export function subscribeAgentProgress(callback) {
  progressSubscribers.add(callback);
  return () => progressSubscribers.delete(callback);
}

export function notifyAgentStepProgress(stepId, status = 'running', detail = '') {
  const payload = {
    stepId,
    status, // 'running' | 'success' | 'failed' | 'skipped'
    detail,
    timestamp: new Date().toISOString()
  };

  progressSubscribers.forEach(fn => {
    try { fn(payload); } catch (_) {}
  });
}
