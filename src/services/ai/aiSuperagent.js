/**
 * SambungJaga AI — Care Intake Superagent Orchestrator
 *
 * Tier 1: Chrome Built-in Gemini Nano (on-device, optional)
 * Tier 2: Supabase Edge Function (cloud AI, optional)
 * Tier 3: Deterministic local rules (always available)
 *
 * Safety:
 * - Resident identity is resolved locally, never by an AI model.
 * - Ambiguous identity requires human confirmation.
 * - AI suggestions are review tasks, never clinical instructions.
 * - AI cannot approve evidence or close obligations.
 * - Cloud AI receives redacted text, not resident records.
 * - Persistence is handled only by recordFactAndObligationAtomic().
 */

import { supabase } from '../../supabase/client/client';
import { runGeminiNanoSuperagent } from './geminiNanoService';


const MIN_RESIDENT_CONFIDENCE = 0.85;

const ALLOWED_PRIORITIES = new Set([
  'routine',
  'important',
  'critical',
  'emergency'
]);

// E2/E3 are not enabled in the current evidence-verification workflow.
const ALLOWED_EVIDENCE_GRADES = new Set([
  'E0',
  'E1'
]);

const ALLOWED_SOURCE_TYPES = new Set([
  'voice',
  'voice_stt',
  'handsfree_floating_mic',
  'handsfree_voice',
  'whatsapp_voice_note',
  'text',
  'text_input'
]);

const CLINICAL_ACTION_PATTERN =
  /\b(obat|medikasi|parasetamol|paracetamol|amlodipine|insulin|suntik|injeksi|dosis|mg\b|ml\b|resep|beri(?:kan)?|hentikan|naikkan|turunkan)\b/i;

const REVIEW_SIGNAL_PATTERN =
  /\b(demam|panas|suhu|muntah|mual|gula darah|insulin|jatuh|terjatuh|terpeleset|tidak mau makan|menolak makan|nafsu makan|sesak|sulit bernapas|nyeri dada|pingsan|tidak sadar|obat|medikasi|tensi|tekanan darah)\b/i;

const URGENT_SIGNAL_PATTERN =
  /\b(sesak|sulit bernapas|susah bernapas|nyeri dada|pingsan|tidak sadar|jatuh|terjatuh|terpeleset)\b/i;


/* =========================================================
 * 1. TEXT NORMALIZATION AND PRIVACY
 * ======================================================= */

/**
 * Remove known identifiers before cloud processing.
 *
 * The original report remains local and is used for the ledger.
 * This function only creates a redacted copy for cloud AI.
 */
export function redactIdentifiersForCloud(prompt, context = {}) {
  let redacted = String(prompt || '');

  const residents = Array.isArray(context?.residents)
    ? context.residents
    : [];

  const names = residents
    .map((resident) =>
      String(resident?.full_name || '').trim()
    )
    .filter((name) => name.length >= 3)
    .sort((a, b) => b.length - a.length);

  for (const name of names) {
    const escaped = name.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

    redacted = redacted.replace(
      new RegExp(escaped, 'gi'),
      '[PENGHUNI]'
    );
  }

  return redacted
    .replace(
      /\b(?:kamar|ruang|wisma|rm)\s*(?:nomor|no\.?\s*)?\d{1,6}\b/gi,
      '[LOKASI_KAMAR]'
    )
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      '[EMAIL]'
    )
    .replace(
      /(?:\+?62|0)\s*8\d[\d\s-]{6,12}/g,
      '[NOMOR_TELEPON]'
    );
}


function normalizeForMatching(value = '') {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,;:!?()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function containsPhrase(haystack, phrase) {
  if (!haystack || !phrase) return false;

  const escaped = phrase.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  return new RegExp(
    `(^|\\s)${escaped}(?=$|\\s)`,
    'i'
  ).test(haystack);
}


function getExplicitRoomMatch(text, roomNumber) {
  if (roomNumber == null || roomNumber === '') {
    return false;
  }

  const escaped = String(roomNumber)
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (!escaped) return false;

  return new RegExp(
    `\\b(?:kamar|ruang|wisma|rm)\\s*(?:nomor|no\\.?\\s*)?${escaped}\\b`,
    'i'
  ).test(text);
}


/**
 * Clean filler words from speech transcript.
 * Does not remove observations or change the original meaning.
 */
export function cleanTranscriptText(raw = '') {
  return String(raw || '')
    .replace(
      /\b(?:eee+|hmmm+|anu|tolong dicatat|maksudnya|tolong catatkan)\b/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}


/* =========================================================
 * 2. DETERMINISTIC RESIDENT MATCHING
 * ======================================================= */

/**
 * Returns resident records for the UI confirmation selector.
 */
export function findResidentCandidates(text = '', residents = []) {
  return findResidentCandidatesWithConfidenceScore(
    text,
    residents
  ).map((item) => item.resident);
}


/**
 * Multi-factor resident matching.
 *
 * Exact full name:
 *   Strong evidence, eligible for automatic matching.
 *
 * Partial name:
 *   Suggestion only; manual confirmation required.
 *
 * Explicit room:
 *   Suggestion only unless the full name is also matched.
 *
 * Medical conditions are never identity evidence.
 */
export function findResidentCandidatesWithConfidenceScore(
  text = '',
  residents = []
) {
  const normalizedText = normalizeForMatching(text);

  if (
    !normalizedText ||
    !Array.isArray(residents) ||
    residents.length === 0
  ) {
    return [];
  }

  return residents
    .filter((resident) =>
      resident &&
      resident.id &&
      resident.full_name
    )
    .map((resident) => {
      const fullName = normalizeForMatching(
        resident.full_name
      );

      const roomNumber = String(
        resident.room_number ?? ''
      ).trim();

      const nameTokens = fullName
        .split(' ')
        .filter((token) => token.length >= 3);

      const matchedTokens = nameTokens.filter(
        (token) => containsPhrase(normalizedText, token)
      );

      const exactFullName =
        fullName.length >= 3 &&
        containsPhrase(normalizedText, fullName);

      const explicitRoom = getExplicitRoomMatch(
        normalizedText,
        roomNumber
      );

      let confidenceScore = 0;
      const matchReasons = [];

      if (exactFullName) {
        confidenceScore = 0.98;
        matchReasons.push('exact_full_name');

      } else if (matchedTokens.length > 0) {
        const ratio =
          matchedTokens.length /
          Math.max(1, nameTokens.length);

        confidenceScore = Math.min(
          0.62,
          0.30 + (ratio * 0.32)
        );

        matchReasons.push(
          ...matchedTokens.map(
            (token) => `partial_name_${token}`
          )
        );
      }

      if (explicitRoom) {
        matchReasons.push('explicit_room_number');

        if (exactFullName) {
          // Important: a room match must not lower an exact-name score.
          confidenceScore = 0.98;

        } else if (confidenceScore > 0) {
          // Partial name + room is still not sufficient for automatic selection.
          confidenceScore = Math.min(
            0.82,
            confidenceScore + 0.18
          );

        } else {
          // Room-only match can be shown as a candidate for manual confirmation.
          confidenceScore = 0.45;
        }
      }

      confidenceScore = Number(
        confidenceScore.toFixed(2)
      );

      return {
        resident,
        confidenceScore,
        matchReasons,
        requiresHumanVerification:
          confidenceScore < MIN_RESIDENT_CONFIDENCE
      };
    })
    .filter((item) => item.confidenceScore >= 0.25)
    .sort(
      (a, b) =>
        b.confidenceScore - a.confidenceScore
    );
}


/**
 * Resolves resident identity locally.
 *
 * A manually selected resident must also exist in the supplied
 * resident directory. An arbitrary context.resident object is not trusted.
 */
function resolveResidentFromContext(text, context = {}) {
  const residents = Array.isArray(context.residents)
    ? context.residents
    : [];

  if (context.resident?.id) {
    const selectedResident = residents.find(
      (resident) =>
        String(resident.id) === String(context.resident.id)
    );

    if (!selectedResident) {
      return {
        selectedResident: null,
        candidates: [],
        detectedResident: null,
        isAmbiguous: true,
        invalidSelection: true,
        confidenceScore: 0,
        requiresHumanVerification: true
      };
    }

    return {
      selectedResident,
      candidates: [{
        resident: selectedResident,
        confidenceScore: 1,
        matchReasons: ['user_selected_resident'],
        requiresHumanVerification: false
      }],
      detectedResident: selectedResident,
      isAmbiguous: false,
      invalidSelection: false,
      confidenceScore: 1,
      requiresHumanVerification: false
    };
  }

  const candidates =
    findResidentCandidatesWithConfidenceScore(
      text,
      residents
    );

  const first = candidates[0] || null;
  const second = candidates[1] || null;

  const clearlyAhead =
    !second ||
    (
      first.confidenceScore -
      second.confidenceScore >= 0.15
    );

  const detectedResident =
    first &&
    first.confidenceScore >= MIN_RESIDENT_CONFIDENCE &&
    clearlyAhead
      ? first.resident
      : null;

  const strongCandidates = candidates.filter(
    (candidate) =>
      candidate.confidenceScore >= MIN_RESIDENT_CONFIDENCE
  );

  return {
    selectedResident: null,
    candidates,
    detectedResident,

    isAmbiguous:
      strongCandidates.length > 1 ||
      (!detectedResident && candidates.length > 0),

    invalidSelection: false,

    confidenceScore: detectedResident
      ? first.confidenceScore
      : (first?.confidenceScore || 0),

    requiresHumanVerification: !detectedResident
  };
}


/* =========================================================
 * 3. DUPLICATE REPORT DETECTION
 * ======================================================= */

/**
 * Detects an exact or near-duplicate report from the same resident
 * within the last 15 minutes.
 */
export function checkDuplicateReport(
  text = '',
  residentId = null,
  existingFacts = []
) {
  if (
    !text ||
    !residentId ||
    !Array.isArray(existingFacts) ||
    existingFacts.length === 0
  ) {
    return false;
  }

  const cleanNew = normalizeForMatching(
    cleanTranscriptText(text)
  );

  if (!cleanNew) return false;

  const fifteenMinutesAgo =
    Date.now() - (15 * 60 * 1000);

  return existingFacts.some((fact) => {
    if (
      String(fact?.resident_id) !==
      String(residentId)
    ) {
      return false;
    }

    const rawTimestamp =
      fact.observed_at ||
      fact.sys_created_at ||
      fact.created_at ||
      null;

    if (!rawTimestamp) return false;

    const factTimestamp = new Date(
      rawTimestamp
    ).getTime();

    if (
      !Number.isFinite(factTimestamp) ||
      factTimestamp < fifteenMinutesAgo
    ) {
      return false;
    }

    const rawText = String(
      fact.fact_value?.text_raw ||
      fact.fact_value?.transcript ||
      fact.fact_value?.note ||
      ''
    );

    const cleanExisting = normalizeForMatching(
      cleanTranscriptText(rawText)
    );

    if (!cleanExisting) return false;

    return (
      cleanExisting === cleanNew ||
      (
        cleanNew.length >= 20 &&
        cleanExisting.includes(cleanNew)
      ) ||
      (
        cleanExisting.length >= 20 &&
        cleanNew.includes(cleanExisting)
      )
    );
  });
}


/* =========================================================
 * 4. DETERMINISTIC FACT EXTRACTION
 * ======================================================= */

/**
 * Extracts literal values and reported symptoms.
 *
 * This is not a diagnosis or clinical interpretation.
 */
export function extractStructuredFacts(
  text = '',
  resident = null
) {
  const cleaned = cleanTranscriptText(text);
  const lower = cleaned.toLowerCase();

  const symptoms = [];
  const vitals = {};
  const tags = [];

  // Temperature.
  const temperatureMatch = lower.match(
    /(?:suhu(?: tubuh| badan)?(?:nya)?|demam)\s*(\d{2}(?:[.,]\d)?)/i
  );

  if (temperatureMatch) {
    const temperature = Number.parseFloat(
      temperatureMatch[1].replace(',', '.')
    );

    if (
      Number.isFinite(temperature) &&
      temperature >= 25 &&
      temperature <= 45
    ) {
      vitals.temperature_celsius = temperature;
    }
  }

  // Blood pressure: group 1 = systolic, group 2 = diastolic.
  const bloodPressureMatch = lower.match(
    /(?:tensi(?:nya)?|tekanan darah(?:nya)?)\s*(\d{2,3})\s*(?:\/|\bper\b)\s*(\d{2,3})/i
  );

  if (bloodPressureMatch) {
    const systolic = Number.parseInt(
      bloodPressureMatch[1],
      10
    );

    const diastolic = Number.parseInt(
      bloodPressureMatch[2],
      10
    );

    if (
      Number.isInteger(systolic) &&
      Number.isInteger(diastolic) &&
      systolic >= 50 &&
      systolic <= 260 &&
      diastolic >= 30 &&
      diastolic <= 160
    ) {
      vitals.systolic_mmhg = systolic;
      vitals.diastolic_mmhg = diastolic;

    } else {
      vitals.blood_pressure_parse_warning =
        'Angka tekanan darah ditemukan tetapi berada di luar rentang validasi format.';
    }
  }

  // Reported symptoms. These labels do not imply a diagnosis.
  if (/mual|muntah/i.test(lower)) {
    symptoms.push('nausea_vomiting');
  }

  if (/demam|panas|suhu/i.test(lower)) {
    symptoms.push('reported_fever');
  }

  if (/jatuh|terjatuh|terpeleset/i.test(lower)) {
    symptoms.push('fall_incident_reported');
  }

  if (/sesak|sulit bernapas|susah bernapas/i.test(lower)) {
    symptoms.push('breathing_difficulty_reported');
  }

  if (/tidak mau makan|menolak makan|nafsu makan/i.test(lower)) {
    symptoms.push('appetite_change_reported');
  }

  if (/nyeri dada/i.test(lower)) {
    symptoms.push('chest_pain_reported');
  }

  if (/pingsan|tidak sadar/i.test(lower)) {
    symptoms.push('loss_of_consciousness_reported');
  }

  if (symptoms.length > 0) {
    tags.push('caregiver_reported_observation');
  }

  if (Object.keys(vitals).length > 0) {
    tags.push('literal_vital_sign_reading');
  }

  return {
    resident_id: resident?.id || null,
    resident_name: resident?.full_name || null,

    text_cleaned: cleaned,

    reported_symptoms: [...new Set(symptoms)],
    reported_vitals: vitals,

    tags,

    extracted_at: new Date().toISOString(),

    interpretation: 'reported_data_only_not_a_diagnosis'
  };
}


/* =========================================================
 * 5. RECENT VITAL DISCREPANCY DETECTION
 * ======================================================= */

function findRecentVitalDiscrepancies(
  prompt,
  resident,
  context = {}
) {
  if (!resident?.id) return [];

  const currentVitals = extractStructuredFacts(
    prompt,
    resident
  ).reported_vitals || {};

  if (Object.keys(currentVitals).length === 0) {
    return [];
  }

  const recentCutoff =
    Date.now() - (24 * 60 * 60 * 1000);

  const discrepancies = [];

  const facts = Array.isArray(context?.epistemicFacts)
    ? context.epistemicFacts
    : [];

  for (const fact of facts) {
    if (
      String(fact?.resident_id) !==
      String(resident.id)
    ) {
      continue;
    }

    const rawTimestamp =
      fact.observed_at ||
      fact.sys_created_at ||
      fact.created_at ||
      null;

    if (!rawTimestamp) continue;

    const observedAt = new Date(
      rawTimestamp
    ).getTime();

    if (
      !Number.isFinite(observedAt) ||
      observedAt < recentCutoff
    ) {
      continue;
    }

    const previousVitals =
      fact.fact_value?.structured?.reported_vitals ||
      fact.fact_value?.structured?.vitals ||
      {};

    for (const key of [
      'temperature_celsius',
      'systolic_mmhg',
      'diastolic_mmhg'
    ]) {
      const previousValue = previousVitals[key];
      const currentValue = currentVitals[key];

      if (
        previousValue != null &&
        currentValue != null &&
        Number.isFinite(Number(previousValue)) &&
        Number.isFinite(Number(currentValue)) &&
        Number(previousValue) !== Number(currentValue)
      ) {
        discrepancies.push({
          key,
          previousValue: Number(previousValue),
          currentValue: Number(currentValue),

          previousObservedAt:
            new Date(observedAt).toISOString(),

          message:
            'Nilai berbeda dari laporan sebelumnya; periksa waktu dan ulangi pengukuran bila diperlukan.'
        });
      }
    }
  }

  return discrepancies.slice(0, 5);
}


/* =========================================================
 * 6. AI OUTPUT SANITIZATION
 * ======================================================= */

function sanitizeModelSummary(value) {
  const summary = String(
    value ||
    'Laporan dianalisis dan menunggu tindak lanjut petugas.'
  )
    .trim()
    .slice(0, 1200);

  // Do not expose model-generated medication or treatment instructions.
  if (CLINICAL_ACTION_PATTERN.test(summary)) {
    return 'Laporan memuat informasi terkait obat atau tindakan yang perlu ditinjau petugas berwenang. Ringkasan ini bukan instruksi klinis.';
  }

  return summary ||
    'Laporan dianalisis dan menunggu tindak lanjut petugas.';
}


function sanitizeProposedObligations(
  items,
  residentId,
  prompt = ''
) {
  if (!Array.isArray(items)) return [];

  const urgent = URGENT_SIGNAL_PATTERN.test(prompt);

  return items
    .filter((item) =>
      item &&
      typeof item === 'object' &&
      !Array.isArray(item)
    )
    .slice(0, 3)
    .map((item) => {
      const rawTitle = String(
        item.title ||
        'Tinjau laporan bersama supervisor'
      )
        .trim()
        .slice(0, 180);

      const rawDescription = String(
        item.description || ''
      )
        .trim()
        .slice(0, 1200);

      const containsClinicalAction =
        CLINICAL_ACTION_PATTERN.test(
          `${rawTitle} ${rawDescription}`
        );

      const requestedPriority =
        ALLOWED_PRIORITIES.has(item.priority)
          ? item.priority
          : 'important';

      let priority = requestedPriority;

      // The model cannot lower the priority of a deterministic urgent signal.
      if (
        urgent &&
        !['critical', 'emergency'].includes(priority)
      ) {
        priority = 'important';
      }

      const rawMinutes = Number(
        item.valid_until_minutes
      );

      const validUntilMinutes =
        Number.isFinite(rawMinutes)
          ? Math.round(
              Math.max(5, Math.min(rawMinutes, 1440))
            )
          : 120;

      return {
        title: containsClinicalAction
          ? 'Tinjau laporan observasi bersama supervisor'
          : (
              rawTitle ||
              'Tinjau laporan bersama supervisor'
            ),

        // Never trust the model's free-text description as an instruction.
        description:
          'Usulan AI berdasarkan laporan caregiver. Petugas berwenang wajib meninjau; AI tidak menetapkan diagnosis, dosis, tindakan klinis, atau penutupan tugas.',

        priority,

        required_evidence_grade:
          ALLOWED_EVIDENCE_GRADES.has(
            item.required_evidence_grade
          )
            ? item.required_evidence_grade
            : 'E1',

        valid_until_minutes: validUntilMinutes,

        resident_id: residentId || null,

        requires_human_review: true
      };
    });
}


/* =========================================================
 * 7. NORMALIZE AI RESULT
 * ======================================================= */

/**
 * The model may summarize and suggest review tasks.
 * Resident matching, duplicate detection and facts stay deterministic.
 */
function normalizeAgentResult(
  raw,
  context,
  source,
  prompt
) {
  const resolution = resolveResidentFromContext(
    prompt,
    context
  );

  const detectedResident =
    resolution.detectedResident;

  const residentCandidates =
    resolution.candidates.map(
      (candidate) => candidate.resident
    );

  const deterministicFacts =
    extractStructuredFacts(
      prompt,
      detectedResident
    );

  const duplicateDetected = detectedResident
    ? checkDuplicateReport(
        prompt,
        detectedResident.id,
        context?.epistemicFacts || []
      )
    : false;

  const potentialDiscrepancies = detectedResident
    ? findRecentVitalDiscrepancies(
        prompt,
        detectedResident,
        context
      )
    : [];

  let proposedObligations =
    sanitizeProposedObligations(
      raw?.proposedObligations,
      detectedResident?.id,
      prompt
    );

  /*
   * Deterministic safety net:
   * The model cannot suppress an explicit review signal.
   */
  if (
    proposedObligations.length === 0 &&
    detectedResident &&
    !duplicateDetected &&
    REVIEW_SIGNAL_PATTERN.test(prompt)
  ) {
    const urgent =
      URGENT_SIGNAL_PATTERN.test(prompt);

    proposedObligations = [{
      title: urgent
        ? 'Tinjau laporan prioritas segera bersama petugas berwenang'
        : 'Tinjau laporan observasi bersama supervisor',

      description:
        'Usulan tindak lanjut berdasarkan laporan caregiver. Wajib ditinjau petugas berwenang; bukan instruksi klinis.',

      priority: urgent
        ? 'critical'
        : 'important',

      required_evidence_grade: 'E1',

      valid_until_minutes: urgent
        ? 15
        : 120,

      resident_id: detectedResident.id,

      requires_human_review: true
    }];
  }

  return {
    source,

    result: sanitizeModelSummary(raw?.result),

    // These fields are populated by the local resolver, never by the model.
    detectedResidentId:
      detectedResident?.id || null,

    detectedResidentName:
      detectedResident?.full_name || null,

    residentCandidates,

    confidenceScore:
      resolution.confidenceScore,

    requiresHumanVerification:
      resolution.requiresHumanVerification,

    isAmbiguous:
      resolution.isAmbiguous,

    invalidResidentSelection:
      resolution.invalidSelection === true,

    isDuplicate: duplicateDetected,

    // The model cannot assert clinical contradiction.
    hasContradiction: false,

    potentialDiscrepancies,

    structuredFacts: deterministicFacts,

    // Application intake never closes an existing obligation.
    autoCloseObligationId: null,

    proposedObligations:
      detectedResident
        ? proposedObligations
        : [],

    requiresHumanReview: true,

    modelsChainUsed:
      Array.isArray(raw?.modelsChainUsed)
        ? raw.modelsChainUsed
        : [source]
  };
}


/* =========================================================
 * 8. ATOMIC DATABASE PERSISTENCE
 * ======================================================= */

/**
 * This is the only database-write helper in this service.
 *
 * It must be called once by unifiedVoicePipeline.js after
 * all security and resident checks have passed.
 *
 * sourceActorId must be staff_profiles.id, not auth.users.id.
 */
export async function recordFactAndObligationAtomic(
  options = {}
) {
  const {
    residentId,
    factKey = 'caregiver_voice_report',
    factValue,
    sourceType = 'voice_stt',
    sourceActorId,
    proposedObligations = []
  } = options;

  if (!residentId) {
    return {
      success: false,
      error:
        'ID penghuni wajib tersedia sebelum fakta disimpan.'
    };
  }

  if (!sourceActorId) {
    return {
      success: false,
      error:
        'ID profil staf wajib tersedia sebelum laporan disimpan.'
    };
  }

  if (!Array.isArray(proposedObligations)) {
    return {
      success: false,
      error:
        'Usulan tugas harus berupa array.'
    };
  }

  const safeSourceType =
    ALLOWED_SOURCE_TYPES.has(sourceType)
      ? sourceType
      : 'text_input';

  // Sanitize again at the persistence boundary.
  const safeProposals =
    sanitizeProposedObligations(
      proposedObligations,
      residentId
    ).map((item) => ({
      title: item.title,
      description: item.description,
      priority: item.priority,
      required_evidence_grade:
        item.required_evidence_grade,
      valid_until_minutes:
        item.valid_until_minutes
    }));

  const safeFactValue =
    factValue &&
    typeof factValue === 'object' &&
    !Array.isArray(factValue)
      ? factValue
      : {
          note: factValue ?? null
        };

  try {
    /*
     * This expects the public RPC wrapper:
     * public.fn_record_care_fact_and_obligation(...)
     *
     * The wrapper should call the secured kernel_domain function.
     */
    const { data, error } = await supabase.rpc(
      'fn_record_care_fact_and_obligation',
      {
        p_resident_id: residentId,

        p_fact_key: String(factKey)
          .trim()
          .slice(0, 120),

        p_fact_value: safeFactValue,

        p_source_type: safeSourceType,

        p_source_actor_id: sourceActorId,

        // AI intake never closes an existing obligation.
        p_close_obligation_id: null,
        p_close_note: null,

        p_proposed_obligations: safeProposals
      }
    );

    if (error) {
      return {
        success: false,
        error:
          error.message ||
          'RPC penyimpanan fakta gagal.'
      };
    }

    if (
      data?.success !== true ||
      !data?.fact_id
    ) {
      return {
        success: false,
        error:
          data?.message ||
          'Database tidak mengonfirmasi penyimpanan fakta.'
      };
    }

    return {
      success: true,
      data
    };

  } catch (rpcError) {
    console.error(
      '[CareSuperagent] Atomic persistence failed:',
      rpcError
    );

    return {
      success: false,
      error:
        rpcError?.message ||
        'Gagal menyimpan fakta ke database.'
    };
  }
}


/* =========================================================
 * 9. DETERMINISTIC LOCAL FALLBACK
 * ======================================================= */

function createLocalFallbackResult(
  prompt,
  context
) {
  const resolution = resolveResidentFromContext(
    prompt,
    context
  );

  const resident =
    resolution.detectedResident;

  const existingFacts =
    Array.isArray(context?.epistemicFacts)
      ? context.epistemicFacts
      : [];

  const duplicate = resident
    ? checkDuplicateReport(
        prompt,
        resident.id,
        existingFacts
      )
    : false;

  const potentialDiscrepancies = resident
    ? findRecentVitalDiscrepancies(
        prompt,
        resident,
        context
      )
    : [];

  const proposedObligations = [];

  if (
    resident &&
    !duplicate &&
    REVIEW_SIGNAL_PATTERN.test(prompt)
  ) {
    const urgent =
      URGENT_SIGNAL_PATTERN.test(prompt);

    proposedObligations.push({
      title: urgent
        ? 'Tinjau laporan prioritas segera bersama petugas berwenang'
        : 'Tinjau laporan observasi bersama supervisor',

      description:
        'Usulan tindak lanjut berdasarkan laporan caregiver. Wajib ditinjau petugas berwenang; bukan instruksi klinis.',

      priority: urgent
        ? 'critical'
        : 'important',

      required_evidence_grade: 'E1',

      valid_until_minutes: urgent
        ? 15
        : 120,

      resident_id: resident.id,

      requires_human_review: true
    });
  }

  const summary = resident
    ? `Penghuni teridentifikasi: ${resident.full_name}.`
    : resolution.candidates.length > 0
      ? `Ditemukan ${resolution.candidates.length} kandidat penghuni; konfirmasi manual diperlukan.`
      : 'Identitas penghuni belum dapat ditentukan. Pilih penghuni secara manual.';

  return normalizeAgentResult(
    {
      result: [
        'Laporan diproses menggunakan aturan lokal.',
        summary,

        duplicate
          ? 'Laporan serupa ditemukan dalam 15 menit terakhir.'
          : '',

        potentialDiscrepancies.length > 0
          ? 'Peringatan: nilai vital berbeda dari laporan sebelumnya dan perlu diperiksa petugas.'
          : '',

        proposedObligations.length > 0
          ? 'Usulan tugas dibuat dan menunggu tinjauan manusia.'
          : 'Tidak ada usulan tugas otomatis.'
      ]
        .filter(Boolean)
        .join(' '),

      proposedObligations
    },
    context,
    'local_rule_fallback',
    prompt
  );
}


/* =========================================================
 * 10. EDGE FUNCTION ERROR HANDLING
 * ======================================================= */

async function readFunctionErrorPayload(error) {
  const response = error?.context;

  if (
    !response ||
    typeof response.clone !== 'function'
  ) {
    return null;
  }

  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}


function createPromptGuardBlockedError() {
  const error = new Error(
    'Prompt Guard Edge Function menolak laporan. Laporan tidak diteruskan ke fallback AI.'
  );

  error.code = 'PROMPT_GUARD_BLOCKED';

  return error;
}


/* =========================================================
 * 11. MAIN SUPERAGENT ORCHESTRATOR
 * ======================================================= */

/**
 * Stable function contract:
 *
 * runCareSuperagent(prompt, context)
 *
 * Called by unifiedVoicePipeline.js.
 */
export async function runCareSuperagent(
  prompt,
  context = {}
) {
  const cleanedPrompt =
    cleanTranscriptText(prompt);

  if (!cleanedPrompt) {
    return {
      source: 'none',

      result:
        'Laporan kosong. Masukkan teks hasil transkripsi atau laporan tertulis.',

      detectedResidentId: null,
      detectedResidentName: null,

      residentCandidates: [],

      confidenceScore: 0,

      requiresHumanVerification: true,
      isAmbiguous: false,
      invalidResidentSelection: false,

      isDuplicate: false,
      hasContradiction: false,

      structuredFacts:
        extractStructuredFacts(''),

      autoCloseObligationId: null,

      proposedObligations: [],

      requiresHumanReview: true,

      modelsChainUsed: []
    };
  }

  const safeContext = {
    ...context,

    residents: Array.isArray(context?.residents)
      ? context.residents
      : [],

    activeObligations: Array.isArray(context?.activeObligations)
      ? context.activeObligations
      : [],

    epistemicFacts: Array.isArray(context?.epistemicFacts)
      ? context.epistemicFacts
      : []
  };


  // Resolve identity locally before any AI model is called.
  const resolution = resolveResidentFromContext(
    cleanedPrompt,
    safeContext
  );

  /*
   * If no resident has been resolved, do not send the report
   * to Gemini Nano or the cloud AI.
   *
   * The pipeline can request manual resident confirmation.
   */
  if (
    !resolution.detectedResident ||
    resolution.invalidSelection
  ) {
    return createLocalFallbackResult(
      cleanedPrompt,
      safeContext
    );
  }

  const resolvedResident =
    resolution.detectedResident;


  /* -------------------------------------------------------
   * Tier 1: Gemini Nano — on-device
   * ----------------------------------------------------- */

  try {
    /*
     * The on-device model receives only the resolved resident.
     * It does not receive the entire facility roster or history.
     */
    const nanoContext = {
      resident: resolvedResident,
      residents: [resolvedResident],

      // These are not needed for simple report summarization.
      activeObligations: [],
      epistemicFacts: []
    };

    const nanoResult =
      await runGeminiNanoSuperagent(
        cleanedPrompt,
        nanoContext
      );

    if (
      nanoResult &&
      typeof nanoResult === 'object' &&
      !Array.isArray(nanoResult)
    ) {
      return normalizeAgentResult(
        nanoResult,
        safeContext,
        'on_device_ai',
        cleanedPrompt
      );
    }

  } catch (nanoError) {
    console.warn(
      '[CareSuperagent] Gemini Nano unavailable; trying cloud tier:',
      nanoError
    );
  }


  /* -------------------------------------------------------
   * Tier 2: Supabase Edge Function — cloud AI
   * ----------------------------------------------------- */

  try {
    let timeoutId;

    const cloudSafePrompt =
      redactIdentifiersForCloud(
        cleanedPrompt,
        safeContext
      );

    const edgeRequest =
      supabase.functions.invoke(
        'ai_superagent',
        {
          body: {
            prompt: cloudSafePrompt,

            // No resident IDs, directory or clinical history.
            context: {
              sourceType:
                safeContext.sourceType || null
            },

            missionId:
              typeof crypto !== 'undefined' &&
              typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `mission-${Date.now()}`
          }
        }
      );

    let response;

    try {
      response = await Promise.race([
        edgeRequest,

        new Promise((_, reject) => {
          timeoutId = setTimeout(
            () => reject(
              new Error(
                'AI Edge Function timeout after 8 seconds.'
              )
            ),
            8000
          );
        })
      ]);

    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    const { data, error } = response || {};


    // A cloud Prompt Guard rejection must never fall through to local AI.
    if (
      data?.blocked === true ||
      data?.isInjection === true
    ) {
      throw createPromptGuardBlockedError();
    }

    if (error) {
      const errorPayload =
        await readFunctionErrorPayload(error);

      if (
        errorPayload?.blocked === true ||
        errorPayload?.isInjection === true
      ) {
        throw createPromptGuardBlockedError();
      }

      console.warn(
        '[CareSuperagent] Cloud AI returned an error; trying local rules:',
        error.message || error
      );

    } else if (
      data &&
      typeof data === 'object' &&
      data.success === true
    ) {
      return normalizeAgentResult(
        data,
        safeContext,
        'groq_cloud_edge_function',
        cleanedPrompt
      );
    }

  } catch (cloudError) {
    // Do not bypass a positive security rejection.
    if (
      cloudError?.code === 'PROMPT_GUARD_BLOCKED'
    ) {
      throw cloudError;
    }

    console.warn(
      '[CareSuperagent] Cloud AI unavailable; using local rules:',
      cloudError
    );
  }


  /* -------------------------------------------------------
   * Tier 3: Deterministic local fallback
   * ----------------------------------------------------- */

  return createLocalFallbackResult(
    cleanedPrompt,
    safeContext
  );
}