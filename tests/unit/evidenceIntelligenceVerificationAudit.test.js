import { describe, it, expect } from 'vitest';
import {
  computeSha256BinaryHash,
  validateEvidenceBinaryFile,
  uploadEvidencePhotoToStorage,
  submitEvidenceAndCloseObligationAtomic
} from '../../src/services/caregiver/evidenceVerifier';

describe('P0 Evidence Intelligence & Verification Agent Audit Tests (Requirement 3.1)', () => {
  const validDataUrl1 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const validDataUrl2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  it('1. SHA-256 Binary Hashing - should compute WebCrypto SHA-256 hash over binary ArrayBuffer', async () => {
    const encoder = new TextEncoder();
    const buffer = encoder.encode('SAMPLE_EVIDENCE_PHOTO_BYTES').buffer;
    const hash = await computeSha256BinaryHash(buffer);

    expect(hash).toBeDefined();
    expect(hash.length).toBe(64); // SHA-256 hex string length is 64 chars
  });

  it('2. Binary File Validation - should validate MIME type and 10MB size limit', () => {
    const validBlob = new Blob(['A'.repeat(1024)], { type: 'image/jpeg' });
    const validCheck = validateEvidenceBinaryFile(validBlob, 'image/jpeg');
    expect(validCheck.valid).toBe(true);

    const invalidType = validateEvidenceBinaryFile(validBlob, 'application/pdf');
    expect(invalidType.valid).toBe(false);
    expect(invalidType.error).toContain('tidak didukung');

    const oversizedBlob = new Blob(['A'.repeat(11 * 1024 * 1024)], { type: 'image/jpeg' });
    const oversizedCheck = validateEvidenceBinaryFile(oversizedBlob, 'image/jpeg');
    expect(oversizedCheck.valid).toBe(false);
    expect(oversizedCheck.error).toContain('melebihi batas');
  });

  it('3. Deterministic Storage Upload & Signed URL - should upload to facility_id/obligation_id/evidence_id.jpg path', async () => {
    const upload = await uploadEvidencePhotoToStorage({
      imageDataUrlOrBlob: validDataUrl1,
      obligationId: 'ob-101',
      facilityId: 'FAC-001'
    });

    expect(upload.filePath).toContain('FAC-001/ob-101/ev-');
    expect(upload.sha256Hash).toBeDefined();
  });

  it('4. Duplicate Photo Detection - should throw error when same photo is uploaded twice', async () => {
    // First upload succeeds
    await uploadEvidencePhotoToStorage({
      imageDataUrlOrBlob: validDataUrl2,
      obligationId: 'ob-201',
      facilityId: 'FAC-001'
    });

    // Second upload of identical photo fails
    await expect(uploadEvidencePhotoToStorage({
      imageDataUrlOrBlob: validDataUrl2,
      obligationId: 'ob-202',
      facilityId: 'FAC-001'
    })).rejects.toThrow('Foto duplikat terdeteksi');
  });

  it('5. Atomic Evidence Closure RPC - should execute atomic evidence submission & closure', async () => {
    const res = await submitEvidenceAndCloseObligationAtomic({
      obligationId: 'ob-101',
      evidenceGrade: 'E1',
      evidencePayload: { note: 'Tensi normal' },
      facilityId: 'FAC-001'
    });

    expect(res.success).toBe(true);
    expect(res.sha256Hash).toBeDefined();
  });
});
