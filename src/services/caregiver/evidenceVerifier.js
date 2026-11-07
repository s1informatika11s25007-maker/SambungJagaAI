/**
 * SambungJaga AI — Evidence Intake & Supervisor Review Service
 *
 * Lifecycle:
 * uploaded -> pending_review -> approved/rejected/resubmission_required
 *
 * Security guarantees:
 * - Only actual image bytes can be uploaded.
 * - SHA-256 is calculated from original image bytes.
 * - Storage must acknowledge the upload.
 * - Database RPC must acknowledge the evidence record.
 * - Client cannot auto-approve submitted evidence.
 * - Supervisor decisions are committed through protected RPC.
 */

import { supabase } from '../../supabase/client/client.js';

import { validateEvidencePayload } from '../../utils/common/validators.js';

import { auditEvidenceCompleteness } from './evidenceCompletenessAgent.js';


export const EVIDENCE_STATUS = Object.freeze({
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  RESUBMISSION_REQUIRED: 'resubmission_required',
  CLOSED: 'closed'
});

const STORAGE_BUCKET = 'private-care-evidence';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const inMemoryEvidenceHashes = new Set();


function makeEvidenceId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `ev-${crypto.randomUUID()}`;
  }

  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}


function isSafePathSegment(value) {
  const segment = String(value || '').trim();

  return Boolean(segment) &&
    !segment.includes('/') &&
    !segment.includes('\\') &&
    segment !== '.' &&
    segment !== '..';
}


/**
 * Converts a Base64 image data URL to Blob.
 */

function dataUrlToBlob(dataUrl) {
  if (
    typeof dataUrl !== 'string' ||
    !dataUrl.startsWith('data:')
  ) {
    throw new Error('Data URL foto tidak valid.');
  }

  const separatorIndex = dataUrl.indexOf(',');

  if (separatorIndex < 0) {
    throw new Error('Data URL foto tidak memiliki payload.');
  }

  const metadata = dataUrl.slice(0, separatorIndex);
  const encodedData = dataUrl.slice(separatorIndex + 1);

  if (!/;base64$/i.test(metadata)) {
    throw new Error('Foto harus berupa data URL Base64.');
  }

  const mimeType =
    metadata.match(/^data:([^;]+)/i)?.[1]?.toLowerCase() || '';

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `Format foto ${mimeType || 'tidak diketahui'} tidak didukung.`
    );
  }

  let binary;

  try {
    binary = atob(encodedData);
  } catch {
    throw new Error('Payload Base64 foto tidak valid.');
  }

  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob(
    [bytes],
    { type: mimeType }
  );
}


/**
 * Computes SHA-256 from real image bytes.
 * There is no fake hash fallback.
 */

export async function computeSha256BinaryHash(arrayBuffer) {
  if (
    !arrayBuffer ||
    !(arrayBuffer instanceof ArrayBuffer)
  ) {
    throw new Error(
      'ArrayBuffer file bukti tidak ditemukan untuk kalkulasi SHA-256.'
    );
  }

  if (
    typeof crypto === 'undefined' ||
    !crypto.subtle
  ) {
    throw new Error(
      'WebCrypto API tidak tersedia. SHA-256 tidak dapat dihitung.'
    );
  }

  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    arrayBuffer
  );

  return Array.from(
    new Uint8Array(hashBuffer)
  )
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}


/**
 * Validates JPEG, PNG and WebP magic bytes.
 */

export function validateMagicByteSignature(uint8Array) {
  if (!uint8Array || uint8Array.length < 12) {
    return {
      valid: false,
      format: 'unknown'
    };
  }

  // JPEG
  if (
    uint8Array[0] === 0xff &&
    uint8Array[1] === 0xd8 &&
    uint8Array[2] === 0xff
  ) {
    return {
      valid: true,
      format: 'image/jpeg'
    };
  }

  // PNG
  if (
    uint8Array[0] === 0x89 &&
    uint8Array[1] === 0x50 &&
    uint8Array[2] === 0x4e &&
    uint8Array[3] === 0x47 &&
    uint8Array[4] === 0x0d &&
    uint8Array[5] === 0x0a &&
    uint8Array[6] === 0x1a &&
    uint8Array[7] === 0x0a
  ) {
    return {
      valid: true,
      format: 'image/png'
    };
  }

  // WebP
  if (
    String.fromCharCode(
      ...uint8Array.slice(0, 4)
    ) === 'RIFF' &&
    String.fromCharCode(
      ...uint8Array.slice(8, 12)
    ) === 'WEBP'
  ) {
    return {
      valid: true,
      format: 'image/webp'
    };
  }

  return {
    valid: false,
    format: 'unsupported'
  };
}


/**
 * Validates actual file size, MIME type and signature.
 */

export function validateEvidenceBinaryFile(
  blobOrBuffer,
  mimeType,
  uint8Array
) {
  if (!blobOrBuffer || !uint8Array) {
    return {
      valid: false,
      error: 'File atau data foto bukti tidak ditemukan.'
    };
  }

  const size =
    blobOrBuffer.size ||
    blobOrBuffer.byteLength ||
    0;

  if (size <= 0) {
    return {
      valid: false,
      error: 'File foto kosong.'
    };
  }

  if (size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Ukuran file (${(size / 1024 / 1024).toFixed(2)} MB) melebihi batas maksimum 10 MB.`
    };
  }

  const normalizedMime = String(
    mimeType || ''
  ).toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
    return {
      valid: false,
      error: `Format file ${normalizedMime || 'tidak diketahui'} tidak didukung.`
    };
  }

  const signature = validateMagicByteSignature(
    uint8Array
  );

  if (
    !signature.valid ||
    signature.format !== normalizedMime
  ) {
    return {
      valid: false,
      error: 'Magic bytes tidak cocok dengan MIME type. File ditolak.'
    };
  }

  return {
    valid: true,
    size,
    mimeType: normalizedMime
  };
}


/**
 * Duplicate SHA-256 detection.
 */

export async function checkDuplicateEvidenceHash(
  sha256Hash
) {
  if (
    !sha256Hash ||
    !/^[a-f0-9]{64}$/i.test(sha256Hash)
  ) {
    throw new Error('SHA-256 bukti tidak valid.');
  }

  if (inMemoryEvidenceHashes.has(sha256Hash)) {
    return {
      isDuplicate: true,
      reason: 'Foto duplikat terdeteksi pada sesi perangkat ini.'
    };
  }

  const { data, error } = await supabase
    .from('evidence_verifications')
    .select('id')
    .filter(
      'evidence_payload->>sha256_hash',
      'eq',
      sha256Hash
    )
    .limit(1);

  if (error) {
    throw new Error(
      `Tidak dapat memeriksa duplikasi bukti pada database: ${error.message}`
    );
  }

  if (Array.isArray(data) && data.length > 0) {
    return {
      isDuplicate: true,
      reason: 'Foto duplikat terdeteksi pada database.'
    };
  }

  return {
    isDuplicate: false
  };
}


/**
 * Uploads actual image to private Supabase Storage.
 */

export async function uploadEvidencePhotoToStorage({
  imageDataUrlOrBlob,
  obligationId,
  facilityId,
  captureMetadata = {}
} = {}) {
  if (!imageDataUrlOrBlob) {
    throw new Error('Foto bukti wajib disertakan.');
  }

  if (
    !isSafePathSegment(obligationId) ||
    !isSafePathSegment(facilityId)
  ) {
    throw new Error(
      'ID tugas atau fasilitas tidak valid untuk path penyimpanan bukti.'
    );
  }

  let blob;

  if (typeof imageDataUrlOrBlob === 'string') {
    blob = dataUrlToBlob(imageDataUrlOrBlob);

  } else if (
    typeof Blob !== 'undefined' &&
    imageDataUrlOrBlob instanceof Blob
  ) {
    blob = imageDataUrlOrBlob;

  } else {
    throw new Error(
      'Format foto tidak didukung. Kirim Blob atau Data URL hasil pemrosesan kamera.'
    );
  }

  const mimeType = String(
    blob.type || ''
  ).toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `Format foto ${mimeType || 'tidak diketahui'} tidak didukung.`
    );
  }

  const arrayBuffer = await blob.arrayBuffer();

  const uint8Array = new Uint8Array(arrayBuffer);

  const validation = validateEvidenceBinaryFile(
    blob,
    mimeType,
    uint8Array
  );

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const sha256Hash = await computeSha256BinaryHash(
    arrayBuffer
  );

  const duplicateCheck = await checkDuplicateEvidenceHash(
    sha256Hash
  );

  if (duplicateCheck.isDuplicate) {
    throw new Error(
      `Foto duplikat ditolak. ${duplicateCheck.reason}`
    );
  }

  if (!supabase?.storage?.from) {
    throw new Error(
      'Supabase Storage client tidak tersedia. Bukti tidak diunggah.'
    );
  }

  const evidenceId = makeEvidenceId();

  const extension =
    mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/webp'
        ? 'webp'
        : 'jpg';

  const storagePath =
    `${facilityId}/${obligationId}/${evidenceId}.${extension}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(
      storagePath,
      blob,
      {
        contentType: mimeType,
        upsert: false,
        cacheControl: '3600'
      }
    );

  if (error) {
    throw new Error(
      `Gagal mengunggah foto ke private Storage: ${error.message}`
    );
  }

  if (
    !data?.path ||
    data.path !== storagePath
  ) {
    throw new Error(
      'Supabase Storage tidak memberikan path objek yang valid.'
    );
  }

  return {
    evidenceId,
    obligationId,
    facilityId,

    filePath: data.path,

    sha256Hash,

    fileSize: validation.size,

    mimeType,

    capturedAt:
      captureMetadata.capturedAt ||
      new Date().toISOString(),

    deviceLocation:
      captureMetadata.location || null
  };
}


async function removeUploadedObject(storagePath) {
  if (
    !storagePath ||
    !supabase?.storage?.from
  ) {
    return;
  }

  try {
    const { error } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.warn(
        '[Evidence] Uploaded object cleanup failed; manual review may be required:',
        error.message
      );
    }

  } catch (error) {
    console.warn(
      '[Evidence] Uploaded object cleanup failed:',
      error?.message || error
    );
  }
}


/**
 * Submit evidence and move obligation to pending_review.
 *
 * No client-side auto-approval.
 */

export async function submitEvidenceAndCloseObligationAtomic({
  obligationId,
  evidenceGrade = 'E1',
  evidencePayload = {},
  imageDataUrl = null,
  facilityId
} = {}) {
  if (!obligationId || !facilityId) {
    return {
      success: false,
      atomicCompleted: false,
      error: 'ID tugas dan fasilitas terverifikasi wajib disertakan.'
    };
  }

  if (!['E0', 'E1'].includes(evidenceGrade)) {
    return {
      success: false,
      atomicCompleted: false,
      error: 'Saat ini hanya tingkat bukti E0 dan E1 yang didukung. E2/E3 membutuhkan verifikasi tambahan.'
    };
  }

  /*
   * Read task requirements.
   * The database RPC enforces the same rule again.
   */

  let obligationRecord;

  try {
    const { data, error } = await supabase
      .from('bitemporal_obligations')
      .select(
        'id, facility_id, required_evidence_grade, status'
      )
      .eq('id', obligationId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    obligationRecord = data;

  } catch (error) {
    return {
      success: false,
      atomicCompleted: false,

      error:
        `Persyaratan tugas tidak dapat diverifikasi: ${
          error?.message || 'database tidak tersedia'
        }`
    };
  }

  if (!obligationRecord) {
    return {
      success: false,
      atomicCompleted: false,
      error: 'Tugas tidak ditemukan atau tidak dapat diakses oleh akun ini.'
    };
  }

  if (
    String(obligationRecord.facility_id || '') !==
    String(facilityId)
  ) {
    return {
      success: false,
      atomicCompleted: false,
      error: 'Facility ID tugas tidak cocok dengan fasilitas aktif.'
    };
  }

  const gradeRank = {
    E0: 0,
    E1: 1,
    E2: 2,
    E3: 3
  };

  const requiredGrade =
    obligationRecord.required_evidence_grade || 'E1';

  if (
    gradeRank[evidenceGrade] <
    (gradeRank[requiredGrade] ?? 1)
  ) {
    return {
      success: false,
      atomicCompleted: false,

      error:
        `Tugas mensyaratkan ${requiredGrade}; bukti ${evidenceGrade} tidak memenuhi tingkat minimum.`
    };
  }

  if (
    ['closed', 'verified_closed', 'canceled'].includes(
      obligationRecord.status
    )
  ) {
    return {
      success: false,
      atomicCompleted: false,
      error: 'Tugas sudah ditutup atau dibatalkan.'
    };
  }

  const actualImage =
    imageDataUrl ||
    evidencePayload?.imageDataUrl ||
    evidencePayload?.file ||
    null;

  if (
    evidenceGrade === 'E1' &&
    !actualImage
  ) {
    return {
      success: false,
      atomicCompleted: false,
      error: 'Bukti E1 wajib menyertakan foto aktual. Hash atau catatan teks saja tidak cukup.'
    };
  }

  if (
    evidenceGrade === 'E0' &&
    !actualImage &&
    !String(evidencePayload?.note || '').trim()
  ) {
    return {
      success: false,
      atomicCompleted: false,
      error: 'Bukti E0 memerlukan catatan tertulis atau foto.'
    };
  }

  /*
   * Upload actual image.
   */

  let photoUploadResult = null;

  if (actualImage) {
    try {
      photoUploadResult = await uploadEvidencePhotoToStorage({
        imageDataUrlOrBlob: actualImage,
        obligationId,
        facilityId,
        captureMetadata: evidencePayload?.metadata || {}
      });

    } catch (uploadError) {
      return {
        success: false,
        atomicCompleted: false,
        error: uploadError?.message || 'Upload foto bukti gagal.'
      };
    }
  }

  /*
   * Build payload.
   */

  const enrichedPayload = {
    ...evidencePayload,

    lifecycle_status: EVIDENCE_STATUS.PENDING_REVIEW,

    sha256_hash:
      photoUploadResult?.sha256Hash || null,

    storage_path:
      photoUploadResult?.filePath || null,

    attestation_timestamp:
      photoUploadResult?.capturedAt ||
      new Date().toISOString(),

    location_attestation:
      photoUploadResult?.deviceLocation || null,

    evidence_source:
      photoUploadResult
        ? 'private_storage_upload'
        : 'caregiver_note',

    client_verification:
      'pending_supervisor_review'
  };

  const completenessAudit = auditEvidenceCompleteness(
    {
      storage_url:
        photoUploadResult?.filePath || null,

      evidence_payload: enrichedPayload
    },
    evidenceGrade
  );

  enrichedPayload.completeness_score =
    completenessAudit.completenessScore;

  enrichedPayload.completeness_audit =
    completenessAudit;

  /*
   * Atomic RPC submission.
   */

  try {
    const { data, error } = await supabase.rpc(
      'fn_submit_evidence_and_close_obligation',
      {
        p_obligation_id: obligationId,

        p_evidence_grade: evidenceGrade,

        p_evidence_payload: enrichedPayload,

        // Persist a stable private path, not a temporary signed URL.
        p_storage_url:
          photoUploadResult?.filePath || null
      }
    );

    if (error) {
      await removeUploadedObject(
        photoUploadResult?.filePath
      );

      return {
        success: false,
        atomicCompleted: false,

        error:
          `Database menolak penyimpanan bukti: ${error.message}`
      };
    }

    if (
      data?.success !== true ||
      !data?.evidence_id
    ) {
      await removeUploadedObject(
        photoUploadResult?.filePath
      );

      return {
        success: false,
        atomicCompleted: false,

        error:
          data?.message ||
          'Database tidak memberikan acknowledgement bukti tersimpan.'
      };
    }

    if (photoUploadResult?.sha256Hash) {
      inMemoryEvidenceHashes.add(
        photoUploadResult.sha256Hash
      );
    }

    const lifecycleStatus =
      data.lifecycle_status ||
      EVIDENCE_STATUS.PENDING_REVIEW;

    if (
      lifecycleStatus !== EVIDENCE_STATUS.PENDING_REVIEW
    ) {
      return {
        success: false,
        atomicCompleted: true,

        evidenceId: data.evidence_id,
        obligationId,

        error:
          `Status lifecycle tidak sesuai kontrak: ${lifecycleStatus}. Periksa konfigurasi RPC database.`
      };
    }

    return {
      success: true,
      atomicCompleted: true,

      lifecycleStatus:
        EVIDENCE_STATUS.PENDING_REVIEW,

      isAutoApproved: false,
      verified: false,
      requiresHumanReview: true,

      completenessScore:
        completenessAudit.completenessScore,

      evidenceId: data.evidence_id,

      obligationId,

      sha256Hash:
        photoUploadResult?.sha256Hash || null,

      storagePath:
        photoUploadResult?.filePath || null,

      message:
        'Bukti tersimpan dan menunggu persetujuan supervisor.'
    };

  } catch (rpcError) {
    await removeUploadedObject(
      photoUploadResult?.filePath
    );

    return {
      success: false,
      atomicCompleted: false,

      error:
        rpcError?.message ||
        'Transaksi database bukti gagal.'
    };
  }
}


/**
 * Supervisor review.
 *
 * All decisions must pass through database RPC.
 */

export async function reviewEvidenceBySupervisor({
  evidenceId,
  obligationId,
  decision = 'approved',
  rejectionReason = null
} = {}) {
  if (!evidenceId || !obligationId) {
    return {
      success: false,
      error: 'ID bukti dan ID tugas wajib disertakan.'
    };
  }

  if (
    ![
      'approved',
      'rejected',
      'resubmission_required'
    ].includes(decision)
  ) {
    return {
      success: false,
      error: 'Keputusan supervisor tidak valid.'
    };
  }

  if (
    decision !== 'approved' &&
    !String(rejectionReason || '').trim()
  ) {
    return {
      success: false,
      error: 'Alasan penolakan atau permintaan unggah ulang wajib diisi.'
    };
  }

  try {
    const { data, error } = await supabase.rpc(
      'review_obligation_evidence',
      {
        p_evidence_id: evidenceId,
        p_obligation_id: obligationId,
        p_decision: decision,
        p_rejection_reason: rejectionReason
      }
    );

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    if (data?.success !== true) {
      return {
        success: false,

        error:
          data?.message ||
          'Keputusan tidak dikonfirmasi database.'
      };
    }

    return {
      success: true,

      evidenceStatus:
        data.evidence_status,

      targetObligationStatus:
        data.obligation_status,

      result: data
    };

  } catch (error) {
    return {
      success: false,

      error:
        error?.message ||
        'Gagal meninjau bukti.'
    };
  }
}


/**
 * Creates a spot challenge suggestion.
 * It does not itself verify evidence.
 */

export function generateRandomSpotChallenge({
  id,
  obligationId
} = {}) {
  return {
    id: `challenge-${Date.now()}`,

    evidence_id: id || null,

    obligation_id: obligationId || null,

    challenge_reason:
      'Pemeriksaan acak bukti oleh supervisor',

    status: 'pending'
  };
}


/**
 * Validate evidence and optionally call AI verifier.
 *
 * This function supports:
 * 1. Positional arguments.
 * 2. Object arguments used by agentMeshOrchestrator.
 *
 * An unavailable AI verifier never means the evidence is verified.
 */

export async function verifyEvidenceSubmission(
  requiredGradeOrOptions,
  submittedGradeArg,
  payloadArg,
  obligationArg = {}
) {
  let requiredGrade = requiredGradeOrOptions;
  let submittedGrade = submittedGradeArg;
  let payload = payloadArg;
  let obligation = obligationArg;

  if (
    requiredGradeOrOptions &&
    typeof requiredGradeOrOptions === 'object'
  ) {
    const options = requiredGradeOrOptions;

    obligation = options.obligation || {};

    requiredGrade =
      options.requiredGrade ||
      obligation.required_evidence_grade ||
      options.evidenceGrade ||
      'E1';

    submittedGrade =
      options.submittedGrade ||
      options.evidenceGrade ||
      'E1';

    payload = options.payload || {
      photo_hash:
        options.photo_hash ||
        options.sha256_hash ||
        null,

      qr_code:
        options.qr_code || null,

      second_person_name:
        options.second_person_name || null,

      note:
        options.notes ||
        options.note ||
        null,

      file:
        options.file || null,

      imageDataUrl:
        options.imageDataUrl || null
    };
  }

  const rawPayload =
    payload && typeof payload === 'object'
      ? payload
      : {};

  const normalizedPayload = {
    ...rawPayload,

    photo_hash:
      rawPayload.photo_hash ||
      rawPayload.sha256_hash ||
      null
  };

  const validation = validateEvidencePayload(
    requiredGrade || 'E1',
    submittedGrade || 'E0',
    normalizedPayload
  );

  if (!validation.valid) {
    return {
      success: false,
      verified: false,
      requiresHumanReview: true,

      reason: validation.errorReason
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      'ai_evidence_verifier',
      {
        body: {
          requiredGrade:
            requiredGrade || 'E1',

          submittedGrade:
            submittedGrade || 'E1',

          payload: normalizedPayload,

          obligation
        }
      }
    );

    if (
      !error &&
      data &&
      typeof data === 'object'
    ) {
      return {
        success: data.success === true,

        verified: data.verified === true,

        requiresHumanReview:
          data.verified !== true,

        reason:
          data.reason || null,

        message:
          data.message ||
          (
            data.verified === true
              ? `Bukti ${submittedGrade} lolos pemeriksaan layanan.`
              : 'Bukti diterima untuk tinjauan manusia.'
          ),

        triggerSpotChallenge:
          data.triggerSpotChallenge === true,

        spotChallengeReason:
          data.spotChallengeReason || null
      };
    }

  } catch (error) {
    console.warn(
      '[Evidence] AI verifier unavailable; retaining manual review:',
      error
    );
  }

  return {
    success: true,

    verified: false,

    requiresHumanReview: true,

    reason: null,

    message:
      'Pemeriksaan AI tidak tersedia. Validasi format lokal lolos; bukti tetap menunggu tinjauan supervisor.'
  };
}