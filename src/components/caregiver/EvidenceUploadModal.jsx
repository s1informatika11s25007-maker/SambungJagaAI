import React, { useState, useRef } from 'react';
import { Camera, ShieldCheck, AlertCircle, X, Loader2, Check, AlertTriangle, LockKeyhole } from 'lucide-react';
import { EVIDENCE_GRADE, EVIDENCE_GRADE_LABELS } from '../../types/core/architecture';
import { processRealCameraEvidence } from '../../services/ai/realVisionOcrService';

export default function EvidenceUploadModal({ isOpen, onClose, obligation, onSubmitEvidence, currentUser }) {
  const [selectedGrade, setSelectedGrade] = useState(obligation?.required_evidence_grade || EVIDENCE_GRADE.E1);
  const [isOcrScanning, setIsOcrScanning] = useState(false);
  const [ocrVerifiedData, setOcrVerifiedData] = useState(null);
  const [capturedHash, setCapturedHash] = useState(null);
  const [manualReadout, setManualReadout] = useState('');
  const [feedback, setFeedback] = useState(null);

  const fileInputRef = useRef(null);

  if (!isOpen || !obligation) return null;

  const handleProcessImage = async (imageInput) => {
    setIsOcrScanning(true);
    setFeedback(null);

    try {
      const processed = await processRealCameraEvidence(imageInput, obligation?.title);
      setCapturedHash(processed.photoHash);
      setOcrVerifiedData(processed.ocrData);

      if (processed.ocrData && processed.ocrData.vitalReadout) {
        setManualReadout(processed.ocrData.vitalReadout);
      } else {
        setManualReadout('');
      }

      setSelectedGrade(EVIDENCE_GRADE.E1);
    } catch (err) {
      console.error("OCR Scan Error:", err);
      setFeedback({ type: 'error', text: `Gagal memproses foto kamera: ${err.message}` });
    } finally {
      setIsOcrScanning(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessImage(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    const finalReadout = manualReadout.trim() || ocrVerifiedData?.vitalReadout || null;
    if ([EVIDENCE_GRADE.E2, EVIDENCE_GRADE.E3].includes(selectedGrade)) {
      setFeedback({ type: 'error', text: 'Verifikasi ganda dan sensor belum terhubung ke identitas/perangkat yang dapat diverifikasi. Jangan mengklaim bukti E2/E3; minta supervisor meninjau kebutuhan bukti.' });
      return;
    }
    if (selectedGrade === EVIDENCE_GRADE.E1 && !capturedHash) {
      setFeedback({ type: 'error', text: 'Unggah foto terlebih dahulu agar sidik-jari SHA-256 dihitung dari artefak yang benar-benar dipilih.' });
      return;
    }

    const payload = {
      photo_hash: capturedHash,
      qr_code: null,
      ocr_readout: finalReadout,
      evidence_source: capturedHash ? 'uploaded_image_sha256' : 'caregiver_claim',
      timestamp: new Date().toISOString()
    };

    const res = await onSubmitEvidence({
      obligationId: obligation.id,
      evidenceGrade: selectedGrade,
      payload,
      actorName: currentUser?.name || currentUser?.full_name || 'Caregiver'
    });

    if (!res.success) {
      setFeedback({ type: 'error', text: res.error, requiresHumanApproval: res.requiresHumanApproval });
    } else {
      setFeedback({ type: 'success', text: res.message });
      setTimeout(() => {
        setFeedback(null);
        onClose();
      }, 1500);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-slate-900"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">Unggah bukti tugas</h3>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono font-bold border border-amber-300">
              Wajib Min: {obligation.required_evidence_grade}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <p className="text-xs font-bold text-slate-900">{obligation.title}</p>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">{obligation.resident_name}</p>
        </div>

        {/* Hidden File Input for Real Photo Upload */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Real Camera OCR Trigger Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isOcrScanning}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white p-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-md shadow-emerald-500/20 transition"
        >
          {isOcrScanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-emerald-100" />
              <span>Memindai Foto Kamera (Real Tesseract OCR)...</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span>Ambil / unggah foto bukti</span>
            </>
          )}
        </button>

        {ocrVerifiedData && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-900 space-y-2 animate-slide-up">
            <div className="flex items-center justify-between font-bold text-emerald-800">
              <span className="flex items-center">
                <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Hasil OCR Kamera Rill:
              </span>
              <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-mono font-bold">
                OCR: {ocrVerifiedData.confidence ?? 'tidak tersedia'} (indikatif)
              </span>
            </div>

            {ocrVerifiedData.hasValidReadout ? (
              <div>
                <label className="block text-[10px] font-bold text-emerald-800 mb-0.5">Angka Hasil Pembacaan:</label>
                <input
                  type="text"
                  value={manualReadout}
                  onChange={(e) => setManualReadout(e.target.value)}
                  className="w-full text-xs font-mono font-bold text-slate-900 bg-white p-2 rounded-lg border border-emerald-300 outline-none"
                />
              </div>
            ) : (
              <div className="bg-amber-100/80 border border-amber-300 p-2 rounded-lg space-y-1">
                <div className="flex items-center text-amber-900 font-bold text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-700 shrink-0" />
                  <span>Tidak terdeteksi angka jelas pada foto. Ketik angka rill:</span>
                </div>
                <input
                  type="text"
                  value={manualReadout}
                  onChange={(e) => setManualReadout(e.target.value)}
                  placeholder="Contoh: 120/80 mmHg atau Suhu 36.8°C"
                  className="w-full text-xs font-mono font-bold text-slate-900 bg-white p-2 rounded-lg border border-amber-400 outline-none"
                />
              </div>
            )}

            <p className="text-[10px] text-emerald-700 font-medium">{ocrVerifiedData.facelessCropStatus}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Tingkat Bukti yang Diunggah</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(EVIDENCE_GRADE).map((gradeKey) => {
                const info = EVIDENCE_GRADE_LABELS[gradeKey];
                const isSelected = selectedGrade === gradeKey;
                const isUnsupported = gradeKey === EVIDENCE_GRADE.E2 || gradeKey === EVIDENCE_GRADE.E3;
                return (
                  <button
                    key={gradeKey}
                    type="button"
                    onClick={() => !isUnsupported && setSelectedGrade(gradeKey)}
                    disabled={isUnsupported}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      isSelected
                        ? 'bg-sky-50 border-sky-400 text-sky-900 shadow-sm'
                        : isUnsupported ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold">{info.name}</div>
                    <div className="text-[10px] opacity-80 mt-0.5">{isUnsupported ? 'Belum didukung: perlu verifikasi identitas/perangkat' : info.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {(selectedGrade === EVIDENCE_GRADE.E1 || selectedGrade === EVIDENCE_GRADE.E2) && (
            <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-800 font-semibold flex items-center">
                  <Camera className="w-3.5 h-3.5 mr-1.5 text-sky-600" /> Sidik-jari foto (SHA-256)
                </span>
                <span className="text-[10px] font-bold text-slate-500">{capturedHash ? 'Tersedia' : 'Belum ada foto'}</span>
              </div>
              <p className="flex items-start gap-2 text-[10px] leading-relaxed text-slate-500"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />QR lokasi dan tanda tangan orang kedua belum terhubung ke verifier perangkat/akun. Aplikasi tidak akan mengarang identitas atau QR untuk menaikkan tingkat bukti.</p>
            </div>
          )}

          {feedback && (
            <div className={`p-3 rounded-xl text-xs flex items-start space-x-2 border font-medium ${
              feedback.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p className="font-bold">{feedback.text}</p>
                {feedback.requiresHumanApproval && (
                  <p className="text-[11px] text-rose-700 mt-1 font-semibold">
                    Silakan teruskan ke Supervisor untuk persetujuan A3 Human Review.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2.5 rounded-xl font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2.5 rounded-xl font-bold shadow-md shadow-emerald-600/20"
            >
              Kirim untuk ditinjau
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
