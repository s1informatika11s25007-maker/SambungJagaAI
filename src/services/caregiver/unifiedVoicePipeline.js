/**
 * SambungJaga AI — Unified Voice-to-Ledger Analysis Pipeline
 *
 * File ini hanya melakukan validasi, pencocokan penghuni, dan analisis.
 * Tidak melakukan INSERT/UPDATE, RPC, audit write, atau penutupan kewajiban.
 * Penyimpanan dilakukan satu kali oleh useSambungJaga.js.
 */

import { validatePromptInjection } from '../../utils/common/validators';
import {
  cleanTranscriptText,
  checkDuplicateReport,
  runCareSuperagent,
  findResidentCandidatesWithConfidenceScore
} from '../ai/aiSuperagent';

const MAX_REPORT_LENGTH = 8000;
const MIN_RESIDENT_CONFIDENCE = 0.85;

const VOICE_SOURCES = new Set([
  'voice',
  'voice_stt',
  'handsfree_floating_mic',
  'handsfree_voice',
  'whatsapp_voice_note'
]);

const ALLOWED_PRIORITIES = new Set([
  'routine',
  'important',
  'critical',
  'emergency'
]);

// E2/E3 belum diaktifkan pada alur verifikasi bukti saat ini.
const ALLOWED_EVIDENCE_GRADES = new Set(['E0', 'E1']);

const CLINICAL_DIRECTIVE_PATTERN =
  /\b(beri(?:kan)?|hentikan|naikkan|turunkan|suntik|injeksi|dosis|obat|medikasi|insulin|parasetamol|paracetamol|mg\b|ml\b|resep)\b/i;


function makeFailure(base, status, error, extra = {}) {
  return {
    ...base,
    ...extra,
    success: false,
    persisted: false,
    status,
    error,
    processedAt: new Date().toISOString()
  };
}


function normalizeSourceType(value) {
  return VOICE_SOURCES.has(String(value || '').toLowerCase())
    ? 'voice_stt'
    : 'text_input';
}


function normalizeName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function containsWholeName(reportText, fullName) {
  const report = normalizeName(reportText);
  const name = normalizeName(fullName);

  return Boolean(
    report &&
    name &&
    (` ${report} `).includes(` ${name} `)
  );
}


function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


// Identitas penghuni disamarkan sebelum teks diberikan ke Prompt Guard/model.
// Pencocokan nama tetap memakai teks asli dan berlangsung secara lokal.
function redactSensitiveText(text, residents = []) {
  let safeText = String(text || '');

  const names = residents
    .map((resident) => String(resident?.full_name || '').trim())
    .filter((name) => name.length >= 3)
    .sort((a, b) => b.length - a.length);

  for (const name of names) {
    safeText = safeText.replace(
      new RegExp(escapeRegExp(name), 'gi'),
      '[PENGHUNI]'
    );
  }

  return safeText
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      '[EMAIL]'
    )
    .replace(
      /(?:\+?62|0)\s*8\d[\d\s-]{6,12}/g,
      '[NOMOR_TELEPON]'
    )
    .replace(
      /\b(?:kamar|ruang|wisma|rm)\s*(?:nomor|no\.?\s*)?\d{1,6}\b/gi,
      '[LOKASI_KAMAR]'
    );
}


function sanitizeProposedObligations(items, residentId) {
  if (!Array.isArray(items)) return [];

  return items
    .filter((item) =>
      item &&
      typeof item === 'object' &&
      !Array.isArray(item)
    )
    .slice(0, 3)
    .map((item) => {
      const title = String(item.title || '')
        .trim()
        .slice(0, 180);

      const description = String(item.description || '')
        .trim()
        .slice(0, 1200);

      const clinicalDirective =
        CLINICAL_DIRECTIVE_PATTERN.test(
          `${title} ${description}`
        );

      const validity = Number(item.valid_until_minutes);

      return {
        title: clinicalDirective
          ? 'Tinjau laporan observasi bersama petugas berwenang'
          : (
              title ||
              'Tinjau laporan bersama petugas berwenang'
            ),

        description:
          'Usulan AI berdasarkan laporan caregiver. Wajib ditinjau petugas berwenang; bukan instruksi klinis.',

        priority: ALLOWED_PRIORITIES.has(item.priority)
          ? item.priority
          : 'important',

        required_evidence_grade:
          ALLOWED_EVIDENCE_GRADES.has(item.required_evidence_grade)
            ? item.required_evidence_grade
            : 'E1',

        valid_until_minutes: Number.isFinite(validity)
          ? Math.round(
              Math.max(5, Math.min(validity, 1440))
            )
          : 120,

        resident_id: residentId,
        requires_human_review: true
      };
    });
}


/**
 * Entry point:
 * Memproses laporan tertulis atau transcript hasil STT dari UI.
 */
export async function processUnifiedVoiceReport(options = {}) {
  const {
    textPrompt = '',
    residents = [],
    epistemicFacts = [],
    currentUser = null,
    facilityId: requestedFacilityId = null,
    residentId = null,
    sourceType: requestedSourceType = 'text_input'
  } = options;

  const sourceType = normalizeSourceType(requestedSourceType);

  const rawInput = typeof textPrompt === 'string'
    ? textPrompt.trim()
    : String(textPrompt || '').trim();

  const cleanedInput = cleanTranscriptText(rawInput);

  const authenticatedFacilityId =
    currentUser?.facility_id ??
    currentUser?.facilityId ??
    null;

  const base = {
    processedAt: new Date().toISOString(),
    facilityId: authenticatedFacilityId,
    sourceType,

    promptGuardPassed: false,
    promptGuardVerified: false,
    promptGuardMode: null,

    residentMatch: null,
    residentCandidates: [],

    superagentResult: null,
    proposedObligations: [],

    persisted: false,
    auditLogged: false,
    requiresHumanReview: true
  };


  // 1. Validasi input.

  if (!cleanedInput) {
    return makeFailure(
      base,
      'EMPTY_INPUT',
      'Laporan tidak boleh kosong.'
    );
  }

  if (cleanedInput.length > MAX_REPORT_LENGTH) {
    return makeFailure(
      base,
      'INPUT_TOO_LONG',
      `Laporan melebihi batas ${MAX_REPORT_LENGTH} karakter.`
    );
  }


  // 2. Validasi fasilitas dari profil pengguna terautentikasi.

  if (!authenticatedFacilityId) {
    return makeFailure(
      base,
      'FACILITY_CONTEXT_MISSING',
      'Fasilitas aktif tidak tersedia pada profil pengguna.'
    );
  }

  if (
    requestedFacilityId &&
    String(requestedFacilityId) !==
      String(authenticatedFacilityId)
  ) {
    return makeFailure(
      base,
      'FACILITY_SCOPE_MISMATCH',
      'Facility ID tidak sesuai dengan fasilitas akun aktif.'
    );
  }


  // 3. Validasi daftar penghuni.

  if (!Array.isArray(residents) || residents.length === 0) {
    return makeFailure(
      base,
      'RESIDENT_DIRECTORY_UNAVAILABLE',
      'Daftar penghuni fasilitas belum tersedia.'
    );
  }

  // Hanya penghuni dari fasilitas akun aktif yang boleh digunakan.
  const facilityResidents = residents.filter((resident) => {
    const residentFacilityId =
      resident?.facility_id ??
      resident?.facilityId ??
      null;

    return (
      residentFacilityId != null &&
      String(residentFacilityId) ===
        String(authenticatedFacilityId)
    );
  });

  if (facilityResidents.length === 0) {
    return makeFailure(
      base,
      'RESIDENT_DIRECTORY_SCOPE_INVALID',
      'Daftar penghuni tidak memiliki data fasilitas yang cocok dengan akun aktif.'
    );
  }


  // 4. Tolak template yang belum dilengkapi.

  if (/\[[^\]]+\]|_{2,}/.test(cleanedInput)) {
    return makeFailure(
      base,
      'INCOMPLETE_TEMPLATE',
      'Laporan masih berisi placeholder. Lengkapi informasi observasi aktual terlebih dahulu.'
    );
  }


  // 5. Prompt Injection Guard.

  // Prompt Guard harus terverifikasi.
  // Fallback lokal saja tidak dianggap lulus.

  let guardCheck;

  try {
    guardCheck = await validatePromptInjection(
      redactSensitiveText(
        cleanedInput,
        facilityResidents
      )
    );
  } catch (error) {
    return makeFailure(
      base,
      'PROMPT_GUARD_FAILED',
      error?.message ||
        'Pemeriksaan keamanan input gagal.'
    );
  }

  if (
    !guardCheck ||
    typeof guardCheck.isInjection !== 'boolean'
  ) {
    return makeFailure(
      base,
      'PROMPT_GUARD_INVALID',
      'Prompt Guard tidak menghasilkan respons yang valid.'
    );
  }

  if (guardCheck.isInjection) {
    return makeFailure(
      base,
      'BLOCKED_PROMPT_INJECTION',
      `Laporan ditolak oleh Security Guard: ${
        guardCheck.matchedRule ||
        'pola instruksi mencurigakan'
      }`,
      {
        promptGuardMode: guardCheck.mode || null,
        promptGuardVerified: guardCheck.verified === true
      }
    );
  }

  if (guardCheck.verified !== true) {
    return makeFailure(
      base,
      'PROMPT_GUARD_UNVERIFIED',
      'Prompt Guard server tidak dapat diverifikasi. Laporan belum diteruskan untuk analisis.',
      {
        promptGuardMode:
          guardCheck.mode || 'local_fallback',
        promptGuardVerified: false
      }
    );
  }

  base.promptGuardPassed = true;
  base.promptGuardVerified = true;
  base.promptGuardMode =
    guardCheck.mode || 'server_guard';


  // 6. Pilihan penghuni secara manual.

  let selectedResident = null;

  if (residentId != null && residentId !== '') {
    selectedResident = facilityResidents.find(
      (resident) =>
        String(resident.id) === String(residentId)
    ) || null;

    if (!selectedResident) {
      return makeFailure(
        base,
        'INVALID_RESIDENT_SELECTION',
        'Penghuni yang dipilih tidak ditemukan pada fasilitas akun aktif.'
      );
    }
  }


  // 7. Pencocokan penghuni secara deterministik.

  let candidates;

  try {
    candidates = selectedResident
      ? [{
          resident: selectedResident,
          confidenceScore: 1,
          matchReasons: ['manual_user_selection']
        }]
      : findResidentCandidatesWithConfidenceScore(
          cleanedInput,
          facilityResidents
        );
  } catch (error) {
    return makeFailure(
      base,
      'RESIDENT_MATCH_FAILED',
      error?.message ||
        'Pencocokan penghuni gagal.'
    );
  }

  const first = candidates[0] || null;
  const second = candidates[1] || null;

  const confidence = Number(
    first?.confidenceScore || 0
  );

  const confidenceGap = second
    ? confidence - Number(second.confidenceScore || 0)
    : 1;

  // Skor tinggi saja tidak cukup.
  // Nama lengkap harus muncul sebagai frasa utuh.
  const clearlyIdentified = Boolean(
    first?.resident?.full_name &&
    confidence >= MIN_RESIDENT_CONFIDENCE &&
    containsWholeName(
      cleanedInput,
      first.resident.full_name
    ) &&
    confidenceGap >= 0.15
  );

  const matchedResident =
    selectedResident ||
    (clearlyIdentified ? first.resident : null);


  base.residentCandidates = candidates
    .map((item) => item?.resident)
    .filter(Boolean);

  // Jika tidak ada kandidat dari teks, UI tetap mendapat daftar
  // penghuni fasilitas aktif agar caregiver dapat memilih manual.
  if (base.residentCandidates.length === 0) {
    base.residentCandidates = facilityResidents;
  }

  const residentMatch = matchedResident
    ? {
        resident: matchedResident,

        confidenceScore: selectedResident
          ? 1
          : confidence,

        matchReasons: selectedResident
          ? ['manual_user_selection']
          : (first.matchReasons || []),

        requiresHumanVerification: false
      }
    : first;

  base.residentMatch = residentMatch;


  if (!matchedResident) {
    return makeFailure(
      base,
      'NEEDS_RESIDENT_CONFIRMATION',
      'Identitas penghuni belum cukup pasti. Pilih penghuni yang benar sebelum laporan dianalisis.',
      {
        needsResidentConfirmation: true,
        requiresHumanConfirm: true
      }
    );
  }


  // 8. Verifikasi fasilitas penghuni.

  const residentFacilityId =
    matchedResident.facility_id ??
    matchedResident.facilityId ??
    null;

  if (
    residentFacilityId == null ||
    String(residentFacilityId) !==
      String(authenticatedFacilityId)
  ) {
    return makeFailure(
      base,
      'RESIDENT_FACILITY_MISMATCH',
      'Fasilitas penghuni tidak dapat diverifikasi atau tidak sesuai dengan fasilitas akun aktif.'
    );
  }


  // 9. Deteksi laporan duplikat secara lokal.
  // Riwayat laporan tidak dikirim ke model.

  const scopedFacts = Array.isArray(epistemicFacts)
    ? epistemicFacts.filter(
        (fact) =>
          String(fact?.resident_id) ===
          String(matchedResident.id)
      )
    : [];

  let duplicateDetected;

  try {
    duplicateDetected = checkDuplicateReport(
      cleanedInput,
      matchedResident.id,
      scopedFacts
    );
  } catch (error) {
    return makeFailure(
      base,
      'DUPLICATE_CHECK_FAILED',
      error?.message ||
        'Pemeriksaan duplikat gagal.'
    );
  }

  if (duplicateDetected) {
    return makeFailure(
      base,
      'DUPLICATE_REPORT',
      'Laporan serupa ditemukan dalam periode pemeriksaan. Tidak ada catatan baru yang dibuat.',
      {
        isDuplicate: true,
        residentMatch
      }
    );
  }


  // 10. Jalankan Care Superagent.
  //
  // Gunakan identitas sementara agar ID/nama penghuni dan riwayat klinis
  // tidak ikut dikirim ke layanan AI.
  // Identitas asli dipasang kembali secara lokal setelah analisis.

  const agentResident = {
    id: '__resolved_resident__',
    full_name: 'Penghuni terpilih'
  };

  const redactedPrompt = redactSensitiveText(
    cleanedInput,
    [matchedResident]
  );

  let superagentResult;

  try {
    // Kontrak yang benar:
    // runCareSuperagent(prompt, context)

    superagentResult = await runCareSuperagent(
      redactedPrompt,
      {
        resident: agentResident,
        residents: [agentResident],
        activeObligations: [],
        epistemicFacts: [],
        sourceType
      }
    );
  } catch (error) {
    return makeFailure(
      base,
      'SUPERAGENT_FAILED',
      error?.message ||
        'Care Superagent gagal dijalankan.'
    );
  }


  // 11. Validasi hasil Superagent.

  if (
    !superagentResult ||
    typeof superagentResult !== 'object' ||
    Array.isArray(superagentResult)
  ) {
    return makeFailure(
      base,
      'SUPERAGENT_INVALID_RESPONSE',
      'Care Superagent tidak menghasilkan analisis yang valid.'
    );
  }


  // Identitas tetap ditentukan oleh pencocokan lokal.
  const agentResidentId =
    superagentResult.detectedResidentId;

  if (
    agentResidentId != null &&
    String(agentResidentId) !== agentResident.id
  ) {
    return makeFailure(
      base,
      'AI_RESIDENT_MISMATCH',
      'Hasil analisis mengembalikan identitas penghuni yang berbeda. Laporan perlu diperiksa ulang.',
      {
        superagentResult
      }
    );
  }


  if (
    superagentResult.isAmbiguous === true ||
    superagentResult.requiresHumanVerification === true
  ) {
    return makeFailure(
      base,
      'NEEDS_RESIDENT_CONFIRMATION',
      'Analisis masih menandai identitas penghuni sebagai ambigu. Konfirmasi manual diperlukan.',
      {
        needsResidentConfirmation: true,
        requiresHumanConfirm: true,
        superagentResult
      }
    );
  }


  // 12. Sanitasi usulan kewajiban.

  const proposedObligations = sanitizeProposedObligations(
    superagentResult.proposedObligations,
    matchedResident.id
  );


  // 13. Kembalikan hasil analisis dengan identitas asli.
  // Belum ada operasi database pada tahap ini.

  const structuredFacts =
    superagentResult.structuredFacts &&
    typeof superagentResult.structuredFacts === 'object'
      ? {
          ...superagentResult.structuredFacts,
          resident_id: matchedResident.id,
          resident_name: matchedResident.full_name || null
        }
      : null;

  const safeSuperagentResult = {
    ...superagentResult,

    detectedResidentId: matchedResident.id,
    detectedResidentName: matchedResident.full_name || null,

    residentCandidates: [matchedResident],

    structuredFacts,

    // AI tidak boleh menutup kewajiban.
    autoCloseObligationId: null,

    proposedObligations
  };


  return {
    ...base,

    success: true,
    persisted: false,
    status: 'ANALYSIS_COMPLETED',
    processedAt: new Date().toISOString(),

    residentMatch: {
      ...residentMatch,
      resident: matchedResident
    },

    superagentResult: safeSuperagentResult,

    proposedObligations,

    auditLogged: false,
    requiresHumanReview: true,

    message:
      'Analisis selesai. Laporan belum tersimpan sampai RPC database memberikan konfirmasi.'
  };
}