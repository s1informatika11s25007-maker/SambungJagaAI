import React, {
  useEffect,
  useState,
  useRef
} from 'react';

import {
  Camera,
  ShieldCheck,
  AlertCircle,
  X,
  Loader2,
  Check,
  AlertTriangle,
  LockKeyhole
} from 'lucide-react';

import {
  EVIDENCE_GRADE,
  EVIDENCE_GRADE_LABELS
} from '../../types/core/architecture';

import {
  processRealCameraEvidence
} from '../../services/ai/realVisionOcrService';


export default function EvidenceUploadModal({
  isOpen,
  onClose,
  obligation,
  onSubmitEvidence,
  currentUser
}) {
  const [selectedGrade, setSelectedGrade] = useState(
    obligation?.required_evidence_grade || EVIDENCE_GRADE.E1
  );

  const [isOcrScanning, setIsOcrScanning] = useState(false);
  const [ocrVerifiedData, setOcrVerifiedData] = useState(null);

  const [capturedHash, setCapturedHash] = useState(null);
  const [capturedImageDataUrl, setCapturedImageDataUrl] = useState(null);

  const [manualReadout, setManualReadout] = useState('');
  const [manualEvidenceNote, setManualEvidenceNote] = useState('');

  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef(null);

  /*
   * Reset state when selected obligation changes.
   */

  useEffect(() => {
    setSelectedGrade(
      obligation?.required_evidence_grade || EVIDENCE_GRADE.E1
    );

    setFeedback(null);
    setCapturedHash(null);
    setCapturedImageDataUrl(null);
    setOcrVerifiedData(null);
    setManualReadout('');
    setManualEvidenceNote('');

  }, [
    obligation?.id,
    obligation?.required_evidence_grade
  ]);

  if (!isOpen || !obligation) {
    return null;
  }

  const unsupportedRequiredGrade = [
    EVIDENCE_GRADE.E2,
    EVIDENCE_GRADE.E3
  ].includes(obligation.required_evidence_grade);

  /*
   * Process actual image.
   */

  const handleProcessImage = async (imageInput) => {
    setIsOcrScanning(true);
    setFeedback(null);

    try {
      const processed = await processRealCameraEvidence(
        imageInput,
        obligation?.title
      );

      setCapturedHash(processed.photoHash);

      setCapturedImageDataUrl(
        processed.imageDataUrl
      );

      setOcrVerifiedData(
        processed.ocrData
      );

      if (
        processed.ocrData &&
        processed.ocrData.vitalReadout
      ) {
        setManualReadout(
          processed.ocrData.vitalReadout
        );
      } else {
        setManualReadout('');
      }

      setSelectedGrade(EVIDENCE_GRADE.E1);

    } catch (error) {
      console.error(
        '[Evidence OCR] Processing error:',
        error
      );

      setFeedback({
        type: 'error',

        text:
          `Gagal memproses foto kamera: ${error?.message || 'unknown error'}`
      });

    } finally {
      setIsOcrScanning(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];

    if (file) {
      handleProcessImage(file);
    }

    // Allow selecting the same file again after correcting an issue.
    event.target.value = '';
  };

  /*
   * Evidence submission.
   */

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    setFeedback(null);

    if (unsupportedRequiredGrade) {
      setFeedback({
        type: 'error',

        text:
          `Tugas ini mensyaratkan ${obligation.required_evidence_grade}. Verifikasi E2/E3 belum tersedia; bukti E1 tidak boleh dipakai untuk menurunkan standar tugas. Minta supervisor mengubah persyaratan melalui prosedur resmi atau aktifkan verifier yang sesuai.`
      });

      return;
    }

    if (typeof onSubmitEvidence !== 'function') {
      setFeedback({
        type: 'error',
        text: 'Handler penyimpanan bukti tidak tersedia.'
      });

      return;
    }

    const finalReadout =
      manualReadout.trim() ||
      ocrVerifiedData?.vitalReadout ||
      null;

    if (
      [EVIDENCE_GRADE.E2, EVIDENCE_GRADE.E3].includes(
        selectedGrade
      )
    ) {
      setFeedback({
        type: 'error',

        text:
          'Verifikasi E2/E3 belum tersedia karena identitas orang kedua/perangkat belum diverifikasi.'
      });

      return;
    }

    if (
      selectedGrade === EVIDENCE_GRADE.E0 &&
      !capturedImageDataUrl &&
      !manualEvidenceNote.trim()
    ) {
      setFeedback({
        type: 'error',
        text: 'Bukti E0 memerlukan catatan aktual yang ditulis caregiver atau foto bukti.'
      });

      return;
    }

    if (
      selectedGrade === EVIDENCE_GRADE.E1 &&
      (!capturedHash || !capturedImageDataUrl)
    ) {
      setFeedback({
        type: 'error',

        text:
          'Unggah foto aktual terlebih dahulu. Hash SHA-256 akan dihitung ulang dari file asli saat disimpan.'
      });

      return;
    }

    const payload = {
      photo_hash: capturedHash,

      qr_code: null,

      ocr_readout: finalReadout,

      evidence_source:
        capturedImageDataUrl
          ? 'uploaded_image'
          : 'caregiver_note',

      timestamp:
        new Date().toISOString(),

      note:
        selectedGrade === EVIDENCE_GRADE.E0
          ? manualEvidenceNote.trim()
          : null
    };

    setIsSubmitting(true);

    try {
      const result = await onSubmitEvidence({
        obligationId: obligation.id,

        evidenceGrade: selectedGrade,

        imageDataUrl: capturedImageDataUrl,

        payload,

        actorName:
          currentUser?.name ||
          currentUser?.full_name ||
          'Caregiver'
      });

      if (result?.success !== true) {
        setFeedback({
          type: 'error',

          text:
            result?.error ||
            'Database belum mengonfirmasi penyimpanan bukti.',

          requiresHumanApproval:
            result?.requiresHumanApproval
        });

      } else {
        setFeedback({
          type: 'success',

          text:
            result.message ||
            'Bukti tersimpan dan menunggu tinjauan supervisor.'
        });

        window.setTimeout(() => {
          setFeedback(null);
          onClose();
        }, 1500);
      }

    } catch (error) {
      setFeedback({
        type: 'error',

        text:
          error?.message ||
          'Gagal mengirim bukti.'
      });

    } finally {
      setIsSubmitting(false);
    }
  };

  const gradeRank = {
    E0: 0,
    E1: 1,
    E2: 2,
    E3: 3
  };

  const requiredGrade =
    obligation.required_evidence_grade ||
    EVIDENCE_GRADE.E1;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-slate-900"
      >

        {/* Header */}

        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />

            <h3 className="font-bold text-slate-900 text-sm">
              Unggah bukti tugas
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono font-bold border border-amber-300">
              Wajib Min: {requiredGrade}
            </span>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Unsupported grade warning */}

        {unsupportedRequiredGrade && (
          <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl p-3 text-xs">
            Tugas ini mensyaratkan {requiredGrade}. Fitur verifikasi E2/E3 belum tersedia. Formulir tidak akan menurunkan tingkat bukti secara otomatis.
          </div>
        )}

        {/* Obligation */}

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <p className="text-xs font-bold text-slate-900">
            {obligation.title}
          </p>

          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            {obligation.resident_name || 'Nama penghuni tidak tersedia'}
          </p>
        </div>

        {/* File Input */}

        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Camera Button */}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isOcrScanning || isSubmitting || unsupportedRequiredGrade}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white p-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-md shadow-emerald-500/20 transition"
        >
          {isOcrScanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-emerald-100" />
              <span>Memproses foto...</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span>Ambil / unggah foto bukti</span>
            </>
          )}
        </button>

        {/* OCR Result */}

        {ocrVerifiedData && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-900 space-y-2 animate-slide-up">

            <div className="flex items-center justify-between font-bold text-emerald-800">
              <span className="flex items-center">
                <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Hasil OCR kamera:
              </span>

              <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-mono font-bold">
                OCR: {ocrVerifiedData.confidence ?? 'tidak tersedia'} (indikatif)
              </span>
            </div>

            {ocrVerifiedData.hasValidReadout ? (
              <div>
                <label className="block text-[10px] font-bold text-emerald-800 mb-0.5">
                  Angka hasil pembacaan
                </label>

                <input
                  type="text"
                  value={manualReadout}
                  onChange={(event) =>
                    setManualReadout(event.target.value)
                  }
                  className="w-full text-xs font-mono font-bold text-slate-900 bg-white p-2 rounded-lg border border-emerald-300 outline-none"
                />
              </div>
            ) : (
              <div className="bg-amber-100/80 border border-amber-300 p-2 rounded-lg space-y-1">
                <div className="flex items-center text-amber-900 font-bold text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-700 shrink-0" />

                  <span>
                    Tidak terdeteksi angka jelas pada foto. Ketik angka riil:
                  </span>
                </div>

                <input
                  type="text"
                  value={manualReadout}
                  onChange={(event) =>
                    setManualReadout(event.target.value)
                  }
                  placeholder="Contoh: 120/80 mmHg atau suhu 36.8°C"
                  className="w-full text-xs font-mono font-bold text-slate-900 bg-white p-2 rounded-lg border border-amber-400 outline-none"
                />
              </div>
            )}

            <p className="text-[10px] text-emerald-700 font-medium">
              {ocrVerifiedData.facelessCropStatus}
            </p>

            <p className="text-[10px] text-emerald-800">
              Hasil OCR bersifat indikatif dan bukan verifikasi klinis.
            </p>
          </div>
        )}

        {/* Evidence Form */}

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >

          {/* Evidence Grade */}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Tingkat Bukti yang Diunggah
            </label>

            <div className="grid grid-cols-2 gap-2">
              {Object.keys(EVIDENCE_GRADE).map((gradeKey) => {
                const info = EVIDENCE_GRADE_LABELS[gradeKey];

                const isSelected =
                  selectedGrade === gradeKey;

                const isUnsupported =
                  gradeKey === EVIDENCE_GRADE.E2 ||
                  gradeKey === EVIDENCE_GRADE.E3;

                const isBelowRequired =
                  (gradeRank[gradeKey] ?? -1) <
                  (gradeRank[requiredGrade] ?? 1);

                const isDisabled =
                  isUnsupported || isBelowRequired;

                return (
                  <button
                    key={gradeKey}
                    type="button"
                    onClick={() => {
                      if (!isDisabled) {
                        setSelectedGrade(gradeKey);
                      }
                    }}
                    disabled={isDisabled || isSubmitting}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      isSelected
                        ? 'bg-sky-50 border-sky-400 text-sky-900 shadow-sm'
                        : isDisabled
                          ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold">
                      {info.name}
                    </div>

                    <div className="text-[10px] opacity-80 mt-0.5">
                      {isUnsupported
                        ? 'Belum didukung: perlu verifikasi identitas/perangkat'
                        : isBelowRequired
                          ? `Di bawah persyaratan minimum ${requiredGrade}`
                          : info.desc
                      }
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* E0 note */}

          {selectedGrade === EVIDENCE_GRADE.E0 && (
            <div className="space-y-2 bg-amber-50 border border-amber-200 p-3 rounded-xl">
              <label
                htmlFor="evidence-e0-note"
                className="block text-xs font-semibold text-amber-950"
              >
                Catatan bukti aktual (wajib)
              </label>

              <textarea
                id="evidence-e0-note"
                rows={3}
                value={manualEvidenceNote}
                onChange={(event) =>
                  setManualEvidenceNote(event.target.value)
                }
                placeholder="Tuliskan apa yang benar-benar diamati atau dikerjakan."
                className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-amber-200"
              />

              <p className="text-[10px] text-amber-800">
                Catatan E0 tidak diverifikasi otomatis dan tetap menunggu pemeriksaan supervisor.
              </p>
            </div>
          )}

          {/* E1 photo hash */}

          {selectedGrade === EVIDENCE_GRADE.E1 && (
            <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-800 font-semibold flex items-center">
                  <Camera className="w-3.5 h-3.5 mr-1.5 text-sky-600" />
                  Sidik-jari foto (SHA-256)
                </span>

                <span className="text-[10px] font-bold text-slate-500">
                  {capturedHash ? 'Tersedia' : 'Belum ada foto'}
                </span>
              </div>

              <p className="flex items-start gap-2 text-[10px] leading-relaxed text-slate-500">
                <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                Hash dihitung ulang dari byte foto asli sebelum upload. Foto tetap menunggu persetujuan supervisor; hash tidak berarti foto sudah diverifikasi secara klinis.
              </p>

            </div>
          )}

          {/* Feedback */}

          {feedback && (
            <div
              role="status"
              className={`p-3 rounded-xl text-xs flex items-start space-x-2 border font-medium ${
                feedback.type === 'error'
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />

              <div>
                <p className="font-bold">
                  {feedback.text}
                </p>

                {feedback.requiresHumanApproval && (
                  <p className="text-[11px] text-rose-700 mt-1 font-semibold">
                    Silakan teruskan ke Supervisor untuk persetujuan A3 Human Review.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Footer */}

          <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-1/2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs py-2.5 rounded-xl font-semibold"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                unsupportedRequiredGrade
              }
              className="w-1/2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs py-2.5 rounded-xl font-bold shadow-md shadow-emerald-600/20"
            >
              {isSubmitting
                ? 'Menyimpan…'
                : 'Kirim untuk ditinjau'
              }
            </button>

          </div>
        </form>

      </div>
    </div>
  );
}