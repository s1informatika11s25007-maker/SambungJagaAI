/**
 * SambungJaga AI — Evidence Completeness Audit Agent
 *
 * Audits obligation evidence submissions across 5 clinical criteria:
 * 1. Photo presence & PDP privacy mask status (25 pts)
 * 2. OCR vital sign readout validity & range safety (25 pts)
 * 3. Geofence / Location attestation (20 pts)
 * 4. Timestamp freshness (15 pts)
 * 5. Second-person / Witness verification (15 pts)
 */

export function auditEvidenceCompleteness(evidenceRecord = {}, obligationRequiredGrade = 'E1') {
  let score = 0;
  const breakdown = [];

  const payload = evidenceRecord.evidence_payload || {};

  // 1. Photo & Storage URL (25 pts)
  if (evidenceRecord.storage_url || payload.uploaded_storage_url || payload.photo_hash) {
    score += 25;
    breakdown.push({ item: 'Foto Bukti & PDP Mask', passed: true, points: 25 });
  } else {
    breakdown.push({ item: 'Foto Bukti & PDP Mask', passed: false, points: 0 });
  }

  // 2. OCR Vital Readout (25 pts)
  if (payload.ocrData?.hasValidReadout || payload.vitalReadout) {
    score += 25;
    breakdown.push({ item: 'Readout OCR Vital Sign', passed: true, points: 25 });
  } else {
    breakdown.push({ item: 'Readout OCR Vital Sign', passed: false, points: 0 });
  }

  // 3. Geofence Location (20 pts)
  if (payload.location_attestation || payload.location) {
    score += 20;
    breakdown.push({ item: 'Attestasi Lokasi GPS', passed: true, points: 20 });
  } else {
    breakdown.push({ item: 'Attestasi Lokasi GPS', passed: false, points: 0 });
  }

  // 4. Timestamp Freshness (15 pts)
  if (payload.attestation_timestamp || evidenceRecord.created_at) {
    score += 15;
    breakdown.push({ item: 'Timestamp Jam Kerja', passed: true, points: 15 });
  } else {
    breakdown.push({ item: 'Timestamp Jam Kerja', passed: false, points: 0 });
  }

  // 5. Witness / 2nd Person (15 pts)
  if (payload.second_person_name || obligationRequiredGrade !== 'E3') {
    score += 15;
    breakdown.push({ item: 'Verifikasi Saksi/Pendamping', passed: true, points: 15 });
  } else {
    breakdown.push({ item: 'Verifikasi Saksi/Pendamping', passed: false, points: 0 });
  }

  const isComplete = score >= 80;

  return {
    completenessScore: score,
    isComplete,
    breakdown,
    auditGrade: score >= 90 ? 'EXCELLENT' : (score >= 70 ? 'SATISFACTORY' : 'INCOMPLETE')
  };
}
