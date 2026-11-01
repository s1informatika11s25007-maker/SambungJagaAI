/**
 * SambungJaga AI — Evidence-Grade Verifier (P2 Innovation) & Spot Challenge Engine
 *
 * @module services/evidenceVerifier
 * @description Validates evidence submissions via Supabase Edge Function.
 */

import { supabase } from '../../supabase/client/client';
import { validateEvidencePayload } from '../../utils/common/validators';

/**
 * Verifies submitted caregiver evidence against required obligation evidence grade via Supabase Edge Function.
 *
 * @param {string} requiredGrade - Required evidence grade (E0, E1, E2, E3).
 * @param {string} submittedGrade - Submitted evidence grade.
 * @param {Object} payload - Evidence payload (photo_hash, qr_code, second_person_name, etc.).
 * @param {Object} [obligation] - Associated obligation details.
 * @returns {Promise<{ success: boolean, reason?: string, message?: string, triggerSpotChallenge?: boolean, spotChallengeReason?: string }>}
 */
export async function verifyEvidenceSubmission(requiredGrade, submittedGrade, payload, obligation = {}) {
  // Client-side structural validation
  const validation = validateEvidencePayload(requiredGrade, submittedGrade, payload);
  if (!validation.valid) {
    return {
      success: false,
      reason: validation.errorReason
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('ai_evidence_verifier', {
      body: { requiredGrade, submittedGrade, payload, obligation }
    });

    if (!error && data) {
      return {
        success: data.success === true,
        verified: data.verified === true,
        reason: data.reason || (data.success === true ? null : 'Verifier tidak menyetujui bukti.'),
        message: data.message || (data.verified === true ? `Bukti ${submittedGrade} diverifikasi oleh layanan.` : 'Bukti dapat disimpan untuk tinjauan manusia, tetapi verifikasi otomatis belum terbukti.'),
        triggerSpotChallenge: data.triggerSpotChallenge,
        spotChallengeReason: data.spotChallengeReason
      };
    }
  } catch (err) {
    console.warn("AI Evidence Verifier Edge Function unavailable, using rule fallback", err);
  }

  // Fallback if Edge function is unreachable
  return {
    success: true,
    verified: false,
    message: `Bukti ${submittedGrade} lolos pemeriksaan format lokal. Verifier server belum tersedia; bukti harus ditinjau supervisor dan tidak boleh menutup tugas otomatis.`
  };
}
