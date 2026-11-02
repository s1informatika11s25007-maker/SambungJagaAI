/**
 * SambungJaga AI — Care Intake Superagent Orchestrator
 *
 * Tier 1: Chrome Built-in Gemini Nano On-Device AI Engine (0 ms network latency, 100% offline)
 * Tier 2: Multi-Model Pipeline via Supabase Edge Function
 * Tier 3: Local Smart Rule-Based Engine
 */
import { supabase } from '../../supabase/client/client';
import { runGeminiNanoSuperagent } from './geminiNanoService';
import { detectFactContradiction } from '../trace/epistemicLedger';

const superagentCache = new Map();
const cacheSet = (k, v) => {
  if (superagentCache.size >= 50) superagentCache.delete(superagentCache.keys().next().value);
  superagentCache.set(k, v);
};
const genId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mission-${Date.now()}`);
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

const CLINICAL_ACTION_PATTERN = /\b(obat|medikasi|parasetamol|paracetamol|amlodipine|insulin|suntik|injeksi|dosis|mg\b|ml\b|resep|beri(?:kan)?|hentikan|naikkan|turunkan)\b/i;
const ALLOWED_PRIORITIES = new Set(['routine', 'important', 'critical', 'emergency']);

/**
 * Cleans filler words and normalizes speech transcript.
 */
export function cleanTranscriptText(raw = '') {
  return String(raw || '')
    .replace(/\b(eee|eee+|hmmm|anu|tolong dicatat|maksudnya|tolong catatkan)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Finds matching resident candidates for ambiguity resolution with strict similarity rules.
 */
export function findResidentCandidates(text = '', residents = []) {
  const clean = text.toLowerCase().trim();
  if (!clean || !residents.length) return [];

  const matched = residents.filter((resident) => {
    const name = String(resident.full_name || '').toLowerCase().trim();
    const room = String(resident.room_number || '').toLowerCase().trim();
    const nameParts = name.split(/\s+/).filter((p) => p.length > 2);

    // Exact full name or room match takes absolute priority
    const matchesFullName = name.length > 3 && clean.includes(name);
    const matchesRoom = room.length > 0 && (clean.includes(`kamar ${room}`) || clean.includes(`wisma ${room}`) || clean.includes(room));

    // Part match requires string length > 3 to avoid false positives (e.g., 'bu', 'pak', 'di')
    const matchesPart = nameParts.some((part) => part.length >= 4 && clean.includes(part));

    return matchesFullName || matchesRoom || matchesPart;
  });

  return matched;
}

/**
 * Checks if a duplicate or semantically identical report for same resident was submitted within last 15 minutes.
 */
export function checkDuplicateReport(text = '', residentId = null, existingFacts = []) {
  if (!text || !residentId || !existingFacts.length) return false;
  const cleanNew = cleanTranscriptText(text).toLowerCase();
  const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;

  return existingFacts.some((fact) => {
    if (fact.resident_id !== residentId) return false;
    const factTime = new Date(fact.observed_at || fact.sys_created_at || Date.now()).getTime();
    if (factTime < fifteenMinsAgo) return false;

    const rawText = String(fact.fact_value?.text_raw || fact.fact_value?.note || '').toLowerCase();
    const cleanExisting = cleanTranscriptText(rawText);

    // Exact match or string similarity substring match
    return cleanExisting === cleanNew || (cleanNew.length > 15 && cleanExisting.includes(cleanNew)) || (cleanExisting.length > 15 && cleanNew.includes(cleanExisting));
  });
}

/**
 * Extracts structured facts from cleaned report text.
 */
export function extractStructuredFacts(text = '', resident = null) {
  const lower = text.toLowerCase();
  const symptoms = [];
  const vitals = {};
  const tags = [];

  // Vitals extraction
  const tempMatch = lower.match(/(suhu|demam)\s*(\d{2}(?:\.\d)?)/i);
  if (tempMatch) vitals.temperature = parseFloat(tempMatch[2]);

  const sysDiaMatch = lower.match(/(tensi|tekanan darah)\s*(\d{2,3})\s*[\/|per]\s*(\d{2,3})/i);
  if (sysDiaMatch) {
    vitals.systolic = parseInt(sysDiaMatch[1], 10);
    vitals.diastolic = parseInt(sysDiaMatch[2], 10);
  }

  // Symptom keywords
  if (/mual|muntah/i.test(lower)) symptoms.push('nausea_vomiting');
  if (/demam|panas|suhu/i.test(lower)) symptoms.push('fever');
  if (/jatuh|terjatuh|terpeleset/i.test(lower)) symptoms.push('fall_incident');
  if (/sesak|sulit bernapas/i.test(lower)) symptoms.push('shortness_of_breath');
  if (/tidak mau makan|menolak makan/i.test(lower)) symptoms.push('loss_of_appetite');

  if (symptoms.length) tags.push('clinical_observation');
  if (Object.keys(vitals).length) tags.push('vital_signs');

  return {
    resident_id: resident?.id || null,
    resident_name: resident?.full_name || null,
    text_cleaned: cleanTranscriptText(text),
    symptoms,
    vitals,
    tags,
    extracted_at: new Date().toISOString()
  };
}

function normalizeAgentResult(raw, context, source) {
  const residents = context?.residents || [];
  const matched = residents.find((resident) => resident.id === raw?.detectedResidentId) || null;
  const candidates = raw?.residentCandidates || (matched ? [matched] : []);

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
    residentCandidates: candidates,
    isAmbiguous: candidates.length > 1,
    isDuplicate: raw?.isDuplicate || false,
    hasContradiction: raw?.hasContradiction || false,
    structuredFacts: raw?.structuredFacts || null,
    autoCloseObligationId: raw?.autoCloseObligationId || null,
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
 * @param {Object} context - Resident list, active obligations, current resident, epistemic facts
 * @returns {Promise<Object>} Structured response containing analysis text, detected entity, auto-close obligation, and proposed obligations.
 */
export async function runCareSuperagent(prompt, context) {
  const cleanedPrompt = cleanTranscriptText(prompt);
  const cacheKey = `${cleanedPrompt}_${context?.resident?.id || 'r'}_${(context?.activeObligations || []).length}`;

  if (superagentCache.has(cacheKey)) {
    return superagentCache.get(cacheKey);
  }

  // Tier 1: Gemini Nano On-Device AI Engine
  try {
    const nanoResult = await runGeminiNanoSuperagent(cleanedPrompt, context);
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
      body: { prompt: cleanedPrompt, context, missionId: genId() }
    }), 8000);

    if (!error && data && typeof data === 'object') {
      const structured = normalizeAgentResult(data, context, 'groq_cloud_edge_function');
      cacheSet(cacheKey, structured);
      return structured;
    }
  } catch (err) {
    console.warn("Care Superagent Edge Function unavailable, running local smart fallback engine:", err);
  }

  // Tier 3: Local Smart Engine
  const residents = context?.residents || [];
  const candidates = findResidentCandidates(cleanedPrompt, residents);
  const detectedResident = candidates.length === 1 ? candidates[0] : (context?.resident || null);

  // Duplicate & Contradiction Detection
  const existingFacts = context?.epistemicFacts || [];
  const isDuplicate = checkDuplicateReport(cleanedPrompt, detectedResident?.id, existingFacts);

  const contradictionCheck = detectFactContradiction(existingFacts, {
    resident_id: detectedResident?.id,
    fact_key: 'caregiver_voice_report',
    fact_value: { text_raw: cleanedPrompt }
  });

  const structuredFacts = extractStructuredFacts(cleanedPrompt, detectedResident);

  const proposedObligations = [];
  const needsReview = /38|demam|suhu tinggi|muntah|mual|gula darah|insulin|jatuh|terjatuh|terpeleset|tidak mau makan|menolak makan|nafsu makan|sesak|nyeri dada|pingsan|tidak sadar/i.test(cleanedPrompt);
  const urgentSignal = /sesak|nyeri dada|pingsan|tidak sadar|jatuh|terjatuh|terpeleset/i.test(cleanedPrompt);

  if (needsReview && detectedResident && !isDuplicate) {
    proposedObligations.push({
      title: urgentSignal ? 'Tinjau laporan segera bersama petugas berwenang' : 'Tinjau laporan observasi bersama supervisor',
      description: 'Laporan memerlukan penilaian petugas berwenang. AI tidak memberikan instruksi klinis dan tidak menutup kewajiban.',
      priority: urgentSignal ? 'critical' : 'important',
      required_evidence_grade: 'E1',
      valid_until_minutes: urgentSignal ? 15 : 120,
      resident_id: detectedResident.id,
      requires_human_review: true
    });
  }

  const resultObj = normalizeAgentResult({
    result: `Laporan dibersihkan dan dianalisis. ${detectedResident ? `Penghuni teridentifikasi: ${detectedResident.full_name}.` : candidates.length > 1 ? `Terdeteksi ${candidates.length} kandidat penghuni yang mungkin.` : 'Penghuni perlu dipilih atau disebutkan secara jelas.'} ${isDuplicate ? '[Terdeteksi Laporan Duplikat dalam 15 menit terakhir]' : ''} ${contradictionCheck.hasContradiction ? '[Peringatan Kontradiksi Data]' : ''} ${proposedObligations.length ? 'Tugas tinjauan dibuat dan menunggu verifikasi.' : 'Tidak ada tugas otomatis yang dibuat.'}`,
    detectedResidentId: detectedResident?.id || null,
    residentCandidates: candidates,
    isDuplicate,
    hasContradiction: contradictionCheck.hasContradiction,
    structuredFacts,
    proposedObligations
  }, context, 'local_rule_fallback');

  cacheSet(cacheKey, resultObj);
  return resultObj;
}
