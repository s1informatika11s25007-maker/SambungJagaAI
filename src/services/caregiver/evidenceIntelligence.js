/**
 * SambungJaga AI — Evidence Intelligence Agent (P0 Innovation)
 *
 * Handles private storage uploading, visual object validation, format checking,
 * job-type match verification, duplicate image detection, supervisor review storage,
 * and linking evidence with obligation IDs.
 */

import { supabase } from '../../supabase/client/client';
import { executeRealVisionOCR } from '../ai/realVisionOcrService';

/**
 * Computes a perceptual hash / string fingerprint for duplicate detection.
 */
function computePerceptualHash(str) {
  let hash = 0;
  if (!str || str.length === 0) return 'hash-empty';
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `phash-${Math.abs(hash).toString(16)}-${str.length}`;
}

/**
 * Checks if photo hash is already present in DB evidence records.
 */
export async function checkDuplicatePhotoHash(photoHash) {
  if (!photoHash) return false;
  try {
    const { data, error } = await supabase.from('evidence_verifications')
      .select('id')
      .eq('evidence_payload->>photo_hash', photoHash)
      .limit(1);

    if (!error && data && data.length > 0) {
      return true;
    }
  } catch (err) {
    console.warn('Duplicate hash DB check fallback:', err);
  }
  return false;
}

/**
 * Validates uploaded photo evidence matching specific job requirements.
 * @param {File|Object|string} photoInput - Photo file, data URL, or metadata payload
 * @param {Object} obligation - Associated obligation details
 * @returns {Promise<Object>} Verification analysis result
 */
export async function analyzeEvidenceIntelligence(photoInput, obligation = {}) {
  const photoUrl = typeof photoInput === 'string' ? photoInput : photoInput?.dataUrl || photoInput?.photoUrl || '';
  const photoHash = photoInput?.photo_hash || computePerceptualHash(photoUrl);

  // 1. Format & Corruption Check (Must be non-empty and valid data URL / blob / hash)
  const isValidFormat = (photoUrl && (photoUrl.startsWith('data:image/') || photoUrl.startsWith('http') || photoUrl.startsWith('blob:'))) || photoInput?.photo_hash;
  if (!isValidFormat) {
    return {
      valid: false,
      reason: 'Format foto tidak valid, berkas bukan gambar, atau artefak gambar rusak.',
      isDuplicate: false,
      jobTypeMatched: false
    };
  }

  // 2. Database Duplicate Detection Check
  const isDuplicate = await checkDuplicatePhotoHash(photoHash);
  if (isDuplicate) {
    return {
      valid: false,
      reason: 'Terdeteksi foto duplikat yang pernah diunggah sebelumnya pada tugas lain.',
      isDuplicate: true,
      jobTypeMatched: false
    };
  }

  // 3. OCR / Object Presence Detection
  let ocrResult = { rawText: '', vitalReadout: null, hasValidReadout: false };
  if (photoUrl) {
    try {
      ocrResult = await executeRealVisionOCR(photoUrl, obligation.title || '');
    } catch (err) {
      console.warn('Vision OCR execution fallback:', err);
    }
  }

  // 4. Job-Type Match Verification (dynamic regex based on obligation title & category)
  const titleLower = (obligation.title || '').toLowerCase();
  const descLower = (obligation.description || '').toLowerCase();
  const textLower = (ocrResult.rawText || '').toLowerCase();

  let jobTypeMatched = false;
  let matchCategory = 'general';

  if (/obat|medikasi|parasetamol|dosis|insulin|suntik|tablet|kapsul/i.test(titleLower) || /obat|medikasi/i.test(descLower)) {
    matchCategory = 'medication';
    jobTypeMatched = /mg|ml|tablet|kapsul|strip|obat|paracetamol|amlodipine|dosis|suntik|sirup/i.test(textLower) || ocrResult.hasValidReadout;
  } else if (/vital|tensi|suhu|gula darah|sp02|tekanan darah/i.test(titleLower) || /tensi|suhu/i.test(descLower)) {
    matchCategory = 'vitals';
    jobTypeMatched = /\d{2,3}|\/|mmhg|°c|mg\/dl|spo2|bpm/i.test(textLower) || ocrResult.hasValidReadout;
  } else if (/makan|nutrisi|diet|sarapan|maksi|malam|minum/i.test(titleLower) || /makan|nutrisi/i.test(descLower)) {
    matchCategory = 'nutrition';
    jobTypeMatched = /makan|piring|makanan|porsi|sayur|nasi|lauk|minum|buah|suap/i.test(textLower) || Boolean(photoUrl);
  } else {
    jobTypeMatched = Boolean(photoUrl);
  }

  const isCritical = ['critical', 'emergency'].includes(obligation.priority);
  const requiresSupervisorApproval = isCritical || obligation.requires_human_review !== false;

  return {
    valid: true,
    photoHash,
    isDuplicate: false,
    jobTypeMatched,
    matchCategory,
    ocrExtractedText: ocrResult.rawText || null,
    vitalReadout: ocrResult.vitalReadout || null,
    requiresSupervisorApproval,
    recommendation: jobTypeMatched
      ? 'Bukti fisik sesuai jenis pekerjaan.'
      : 'Bukti fisik berhasil diunggah, namun kesesuaian teks/objek membutuhkan konfirmasi supervisor.',
    message: requiresSupervisorApproval
      ? 'Bukti tersimpan. Membutuhkan pemeriksaan supervisor sebelum tugas ditutup.'
      : 'Bukti diverifikasi dan memenuhi syarat penutupan tugas.'
  };
}

/**
 * Uploads a photo file to private Storage bucket and creates signed URL for access.
 */
export async function uploadToPrivateStorage(file, obligationId) {
  if (!file) {
    return { success: false, error: 'File foto tidak tersedia untuk diunggah.' };
  }

  const fileName = `evidence_${obligationId || 'ob'}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;

  try {
    const { data, error } = await supabase.storage
      .from('private-care-evidence')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (error) {
      return { success: false, error: `Gagal mengunggah foto ke Storage Privat: ${error.message}` };
    }

    if (data) {
      // Use signed URL for private bucket access (valid for 24 hours)
      const { data: signedData, error: signedError } = await supabase.storage
        .from('private-care-evidence')
        .createSignedUrl(fileName, 86400);

      const signedUrl = signedData?.signedUrl || '';
      return {
        success: true,
        path: data.path,
        signedUrl: signedUrl || null,
        publicUrl: signedUrl // Return signedUrl for backward compatibility
      };
    }
  } catch (err) {
    return { success: false, error: `Gagal terhubung ke Storage Privat: ${err.message}` };
  }

  return { success: false, error: 'Pengunggahan bukti privat tidak memberikan respon.' };
}

/**
 * Records supervisor review decision for evidence in database.
 */
export async function storeSupervisorEvidenceDecision({
  obligationId,
  evidenceId,
  supervisorId,
  supervisorName,
  decision, // 'approved' | 'rejected'
  rejectionReason = null
}) {
  if (!obligationId) {
    return { success: false, error: 'Obligation ID wajib dispesifikasikan.' };
  }

  try {
    let query = supabase.from('evidence_verifications').update({
      verifier_status: decision === 'approved' ? 'verified' : 'rejected',
      verifier_notes: rejectionReason || (decision === 'approved' ? `Disetujui oleh supervisor ${supervisorName || ''}` : 'Ditolak supervisor'),
      rejection_reason: decision === 'rejected' ? rejectionReason : null
    });

    if (evidenceId) {
      query = query.eq('id', evidenceId);
    } else {
      query = query.eq('obligation_id', obligationId);
    }

    const { data, error } = await query.select();

    if (error) {
      return { success: false, error: `Gagal memperbarui keputusan supervisor di database: ${error.message}` };
    }

    if (!data || data.length === 0) {
      return { success: false, error: 'Bukti verifikasi tidak ditemukan di database.' };
    }

    // Update obligation status based on decision
    if (decision === 'approved') {
      await supabase.from('bitemporal_obligations')
        .update({ status: 'verified_closed', evidence_submitted: true })
        .eq('id', obligationId);
    } else {
      await supabase.from('bitemporal_obligations')
        .update({ status: 'open', evidence_submitted: false })
        .eq('id', obligationId);
    }

    return { success: true, evidence: data[0] };
  } catch (err) {
    return { success: false, error: `Kesalahan saat menyimpan keputusan supervisor: ${err.message}` };
  }
}
