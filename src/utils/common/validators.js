/**
 * SambungJaga AI — Utility Input & Security Validators
 */

import { supabase } from '../../supabase/client/client';

// In-Memory Cache for Prompt Injection Checks
const promptGuardCache = new Map();

/**
 * Detects prompt injection patterns in caregiver input text
 * Menggunakan Edge Function bila tersedia; fallback lokal hanya pemeriksaan pola sederhana.
 * @param {string} text
 * @returns {Promise<{ isInjection: boolean, matchedRule?: string }>}
 */
export async function validatePromptInjection(text) {
  if (!text || typeof text !== 'string') {
    return { isInjection: false };
  }

  const cleanText = text.trim().toLowerCase();
  if (promptGuardCache.has(cleanText)) {
    return promptGuardCache.get(cleanText);
  }

  // Local Rule Pre-filter
  const injectionPatterns = [
    /ignore\s+previous\s+instructions/i,
    /system\s+prompt/i,
    /clear\s+all\s+data/i,
    /drop\s+table/i,
    /delete\s+from/i,
    /you\s+are\s+now\s+a/i
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(text)) {
      const result = { isInjection: true, verified: true, mode: 'local_pattern', matchedRule: 'Local pattern match' };
      promptGuardCache.set(cleanText, result);
      return result;
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke('ai_prompt_guard', {
      body: { text }
    });

    if (!error && data) {
      const result = {
        isInjection: data.isInjection === true,
        verified: true,
        mode: 'server_guard',
        matchedRule: data.matchedRule || 'Server guard pattern match'
      };
      promptGuardCache.set(cleanText, result);
      return result;
    }
  } catch (err) {
    console.warn("AI Prompt Guard API Error, using rule fallback", err);
  }

  const result = { isInjection: false, verified: false, mode: 'local_fallback' };
  promptGuardCache.set(cleanText, result);
  return result;
}

/**
 * Validates caregiver evidence submission payload against required grade
 * @param {string} requiredGrade
 * @param {string} submittedGrade
 * @param {Object} payload
 * @returns {{ valid: boolean, errorReason?: string }}
 */
export function validateEvidencePayload(requiredGrade, submittedGrade, payload) {
  const gradeRank = { E0: 0, E1: 1, E2: 2, E3: 3 };

  const reqRank = gradeRank[requiredGrade] ?? 1;
  const subRank = gradeRank[submittedGrade] ?? 0;

  if (subRank < reqRank) {
    return {
      valid: false,
      errorReason: `Tingkat bukti (${submittedGrade}) lebih rendah dari standar minimal yang diwajibkan (${requiredGrade}).`
    };
  }

  if (submittedGrade === 'E1' && !payload?.photo_hash && !payload?.qr_code) {
    return {
      valid: false,
      errorReason: `Bukti E1 wajib melampirkan artefak foto atau QR Hash lokasi.`
    };
  }

  if (submittedGrade === 'E2' && !payload?.second_person_name) {
    return {
      valid: false,
      errorReason: `Bukti E2 wajib menyertakan verifikasi ganda (Dual Signoff).`
    };
  }

  return { valid: true };
}
