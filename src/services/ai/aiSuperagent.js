/**
 * SambungJaga AI — Care Superagent Orchestrator
 *
 * Tier 1: Chrome Built-in Gemini Nano On-Device AI Engine (0 ms network latency, 100% offline)
 * Tier 2: Multi-Model Pipeline via Supabase Edge Function (llama-prompt-guard, qwen3.8-27b, gpt-oss-120b, gpt-oss-safeguard-20b)
 * Tier 3: Local Rule-Based Fallback Engine
 */
import { supabase } from '../../supabase/client/client';
import { runGeminiNanoSuperagent } from './geminiNanoService';

const superagentCache = new Map();
const cacheSet = (k, v) => {
  if (superagentCache.size >= 50) superagentCache.delete(superagentCache.keys().next().value);
  superagentCache.set(k, v);
};
const genId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mission-${Date.now()}`);
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

const CLINICAL_ACTION_PATTERN = /\b(obat|medikasi|parasetamol|paracetamol|amlodipine|insulin|suntik|injeksi|dosis|mg\b|ml\b|resep|beri(?:kan)?|hentikan|naikkan|turunkan)\b/i;
const ALLOWED_PRIORITIES = new Set(['routine', 'important', 'critical', 'emergency']);

function normalizeAgentResult(raw, context, source) {
  const residents = context?.residents || [];
  const matched = residents.find((resident) => resident.id === raw?.detectedResidentId) || null;
  const suggestions = Array.isArray(raw?.proposedObligations) ? raw.proposedObligations.slice(0, 3).map((item) => {
    const title = String(item?.title || 'Tinjau laporan bersama supervisor').slice(0, 180);
    const requiresGenericReview = CLINICAL_ACTION_PATTERN.test(`${title} ${item?.description || ''}`);
    return {
      title: requiresGenericReview ? 'Tinjau laporan observasi bersama supervisor' : title,
      description: 'Tinjauan oleh petugas berwenang diperlukan. AI tidak menetapkan diagnosis, dosis, tindakan klinis, atau penutupan tugas.',
      priority: ALLOWED_PRIORITIES.has(item?.priority) ? item.priority : 'important',
      required_evidence_grade: ['E0', 'E1', 'E2', 'E3'].includes(item?.required_evidence_grade) ? item.required_evidence_grade : 'E1',
      valid_until_minutes: Math.max(5, Math.min(Number(item?.valid_until_minutes) || 120, 1440)),
      resident_id: matched?.id || context?.resident?.id || null,
      requires_human_review: true
    };
  }) : [];
  return {
    source,
    result: String(raw?.result || 'Laporan dianalisis dan menunggu tindak lanjut petugas.'),
    detectedResidentId: matched?.id || context?.resident?.id || null,
    detectedResidentName: matched?.full_name || context?.resident?.full_name || null,
    autoCloseObligation: null,
    proposedObligations: suggestions,
    modelsChainUsed: Array.isArray(raw?.modelsChainUsed) ? raw.modelsChainUsed : []
  };
}

/**
 * Executes Atomic Database Persistence via Single-Roundtrip PL/pgSQL RPC
 */
export async function recordFactAndObligationAtomic({
  residentId,
  factKey = 'caregiver_voice_report',
  factValue,
  sourceType = 'voice_stt',
  sourceActorId = null,
  closeObligationId = null,
  closeNote = null,
  proposedObligations = []
}) {
  try {
    const { data, error } = await supabase.rpc('fn_record_care_fact_and_obligation', {
      p_resident_id: residentId,
      p_fact_key: factKey,
      p_fact_value: typeof factValue === 'object' ? factValue : { note: factValue },
      p_source_type: sourceType,
      p_source_actor_id: sourceActorId,
      p_close_obligation_id: closeObligationId,
      p_close_note: closeNote,
      p_proposed_obligations: proposedObligations
    });

    if (!error && data) {
      return { success: true, data };
    }
  } catch (rpcErr) {
    console.warn("Atomic RPC execution bypass:", rpcErr);
  }
  return { success: false };
}

/**
 * Executes the Care Superagent orchestrator on speech or text input.
 * @param {string} prompt - Raw voice STT or text report from caregiver
 * @param {Object} context - Resident list, active obligations, current resident
 * @returns {Promise<Object>} Structured response containing analysis text, detected entity, auto-close obligation, and proposed obligations.
 */
export async function runCareSuperagent(prompt, context) {
  const cacheKey = `${prompt.trim()}_${context?.resident?.id || 'r'}_${(context?.activeObligations || []).length}`;

  if (superagentCache.has(cacheKey)) {
    return superagentCache.get(cacheKey);
  }

  // Tier 1: Try Chrome Built-in Gemini Nano On-Device AI Engine first
  try {
    const nanoResult = await runGeminiNanoSuperagent(prompt, context);
    if (nanoResult) {
      const safeResult = normalizeAgentResult(nanoResult, context, 'on_device_ai');
      cacheSet(cacheKey, safeResult);
      return safeResult;
    }
  } catch (nanoErr) {
    console.warn("Gemini Nano Tier 1 bypass, moving to Cloud Edge Function:", nanoErr);
  }

  // Tier 2: Supabase Edge Function (Multi-Model Pipeline)
  try {
    const { data, error } = await withTimeout(supabase.functions.invoke('ai_superagent', {
      body: { prompt, context, missionId: genId() }
    }), 8000);

    if (!error && data) {
      if (typeof data === 'object') {
        const structured = normalizeAgentResult(data, context, 'groq_cloud_edge_function');

        // Persistence is performed once by the calling care workflow. A narrative never closes work.
        cacheSet(cacheKey, structured);
        return structured;
      }
    }
  } catch (err) {
    console.warn("Care Superagent Edge Function unavailable, running local smart fallback engine:", err);
  }

  // Tier 3: Local Rule-Based Fallback Engine (Zero-Friction & Autonomous Task Generation)
  const lowerPrompt = prompt.toLowerCase();
  const residents = context?.residents || [];

  // Resolve a resident only with a full registered name or room number; ambiguity is rejected.
  const residentMatches = residents.filter((resident) => {
    const fullName = String(resident.full_name || '').trim().toLowerCase();
    const room = String(resident.room_number || '').trim().toLowerCase();
    return (fullName.length > 3 && lowerPrompt.includes(fullName)) || (room.length > 1 && lowerPrompt.includes(room));
  });
  const detectedResident = residentMatches.length === 1 ? residentMatches[0] : null;

  // Narratives are never evidence of completion. The engine can create review work only.
  const proposedObligations = [];
  const targetResident = detectedResident || context?.resident || null;
  const needsReview = /38|demam|suhu tinggi|muntah|mual|gula darah|insulin|jatuh|terjatuh|terpeleset|tidak mau makan|menolak makan|nafsu makan|sesak|nyeri dada|pingsan|tidak sadar/i.test(lowerPrompt);
  const urgentSignal = /sesak|nyeri dada|pingsan|tidak sadar|jatuh|terjatuh|terpeleset/i.test(lowerPrompt);
  if (needsReview && targetResident) {
    proposedObligations.push({
      title: urgentSignal ? 'Tinjau laporan segera bersama petugas berwenang' : 'Tinjau laporan observasi bersama supervisor',
      description: 'Laporan memerlukan penilaian petugas berwenang. AI tidak memberikan instruksi klinis dan tidak menutup kewajiban.',
      priority: urgentSignal ? 'critical' : 'important',
      required_evidence_grade: 'E1',
      valid_until_minutes: urgentSignal ? 15 : 120,
      resident_id: targetResident.id,
      requires_human_review: true
    });
  }

  const resultObj = normalizeAgentResult({
    result: `Laporan dianalisis. ${targetResident ? `Penghuni teridentifikasi: ${targetResident.full_name}.` : 'Penghuni perlu dipilih atau disebutkan secara jelas.'} ${proposedObligations.length ? 'Tugas tinjauan dibuat dan menunggu verifikasi petugas.' : 'Tidak ada tugas otomatis yang dibuat dari laporan ini.'}`,
    detectedResidentId: targetResident?.id || null,
    proposedObligations
  }, context, 'local_rule_fallback');

  cacheSet(cacheKey, resultObj);
  return resultObj;
}
