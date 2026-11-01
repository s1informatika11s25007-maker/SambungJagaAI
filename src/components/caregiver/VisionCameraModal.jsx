import React, { useState, useRef, useEffect } from 'react';
import { Camera, Loader2, Check, AlertCircle, X, ShieldCheck, RefreshCw, QrCode, Upload, AlertTriangle } from 'lucide-react';
import { EVIDENCE_GRADE } from '../../types/core/architecture';
import { scanBedQrCodeNative } from '../../services/ai/nativeChromeService';
import { processRealCameraEvidence } from '../../services/ai/realVisionOcrService';

export default function VisionCameraModal({ isOpen, onClose, obligation, onSubmitEvidence, currentUser }) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null); // Data URL of processed privacy photo
  const [capturedHash, setCapturedHash] = useState(null);
  const [ocrData, setOcrData] = useState(null);
  const [manualReadout, setManualReadout] = useState('');
  const [detectedQrCode, setDetectedQrCode] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      console.warn("Kamera langsung tidak tersedia di browser, beralih ke mode unggah file foto rill:", err);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const processAndRunOCR = async (imageInput) => {
    setIsScanning(true);
    setFeedback(null);

    // Scan Barcode Detector QR if active video element
    if (videoRef.current && isCameraActive) {
      const nativeQr = await scanBedQrCodeNative(videoRef.current);
      if (nativeQr) {
        setDetectedQrCode(nativeQr);
      }
    }

    try {
      const processed = await processRealCameraEvidence(imageInput, obligation?.title);
      stopCamera();

      setCapturedImage(processed.imageDataUrl);
      setCapturedHash(processed.photoHash);

      if (processed.ocrData && processed.ocrData.vitalReadout) {
        setManualReadout(processed.ocrData.vitalReadout);
      } else {
        setManualReadout('');
      }

      setOcrData(processed.ocrData);
    } catch (err) {
      console.error("Gagal memproses Vision OCR rill:", err);
      setFeedback({ type: 'error', text: `Gagal memproses foto: ${err.message}` });
    } finally {
      setIsScanning(false);
    }
  };

  const handleCaptureClick = () => {
    if (videoRef.current && isCameraActive) {
      processAndRunOCR(videoRef.current);
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processAndRunOCR(file);
    }
  };

  const handleConfirmAndCloseObligation = async () => {
    const finalReadout = manualReadout.trim() || ocrData?.vitalReadout;
    if (!finalReadout) {
      setFeedback({ type: 'error', text: 'Harap pastikan atau isi angka hasil pemeriksaan tensi/suhu lansia.' });
      return;
    }

    setFeedback(null);
    const payload = {
      photo_hash: capturedHash || null,
      qr_code: detectedQrCode || null,
      ocr_readout: finalReadout,
      raw_ocr_confidence: ocrData?.confidence ?? null,
      timestamp: new Date().toISOString()
    };

    const res = await onSubmitEvidence({
      obligationId: obligation.id,
      evidenceGrade: EVIDENCE_GRADE.E1,
      payload,
      actorName: currentUser?.name || currentUser?.full_name || 'Caregiver'
    });

    if (!res.success) {
      setFeedback({ type: 'error', text: res.error });
    } else {
      setFeedback({ type: 'success', text: res.requiresHumanApproval ? 'Bukti tersimpan. Tugas menunggu pemeriksaan supervisor.' : 'Bukti tersimpan dan tugas ditutup.' });
      setTimeout(() => {
        setFeedback(null);
        onClose();
      }, 1200);
    }
  };

  if (!isOpen || !obligation) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-slate-900"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-sky-600" />
            <h3 className="font-bold text-slate-900 text-sm">Vision AI Camera OCR (Data Rill Kamera)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-sky-50 p-3 rounded-xl border border-sky-200 text-xs">
          <p className="font-bold text-sky-900">{obligation.title}</p>
          <p className="text-[11px] text-sky-700 mt-0.5">{obligation.resident_name}</p>
        </div>

        {/* Hidden File Input for File/Camera Capture */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Live Camera Viewport or Captured View */}
        <div className="relative bg-slate-900 rounded-2xl overflow-hidden aspect-video flex items-center justify-center border-2 border-dashed border-sky-400/50 shadow-inner">
          {isCameraActive ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          ) : capturedImage ? (
            <div className="relative w-full h-full">
              <img src={capturedImage} alt="Bukti Foto Kamera Privacy Crop" className="w-full h-full object-cover" />
              <div className="absolute bottom-2 left-2 right-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700 text-[10px] text-emerald-400 font-mono flex items-center justify-between">
                <span className="flex items-center">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Faceless Privacy Crop PDP
                </span>
                <span className="text-slate-300">Data Kamera Rill</span>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-slate-400 space-y-2">
              <Camera className="w-8 h-8 mx-auto text-sky-400" />
              <p className="text-xs font-medium">Arahkan kamera ke layar tensi/termometer digital lansia</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] bg-slate-800 hover:bg-slate-700 text-sky-300 px-3 py-1.5 rounded-lg border border-slate-700 font-semibold inline-flex items-center"
              >
                <Upload className="w-3 h-3 mr-1" /> Unggah Foto Kamera Kasus
              </button>
            </div>
          )}

          {/* OCR Scanning Overlay */}
          {isScanning && (
            <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-2 p-4 text-center">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-xs font-bold animate-pulse">Memindai Angka Foto Kamera (Real Tesseract OCR)...</p>
              <p className="text-[10px] text-slate-300">Menerapkan Faceless Privacy Crop UU PDP & SHA-256 Hash</p>
            </div>
          )}
        </div>

        {/* Vision AI & QR Detection Results */}
        {ocrData && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-xs text-emerald-900 space-y-2 animate-slide-up">
            <div className="flex items-center justify-between font-bold text-emerald-800">
              <span className="flex items-center">
                <Check className="w-4 h-4 mr-1 text-emerald-600" /> Hasil Real OCR Kamera:
              </span>
              <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-mono font-bold">
                Akurasi OCR: {ocrData.confidence}
              </span>
            </div>

            {ocrData.hasValidReadout ? (
              <div>
                <label className="block text-[10px] font-bold text-emerald-800 mb-0.5">Hasil Pembacaan Layar Alat:</label>
                <input
                  type="text"
                  value={manualReadout}
                  onChange={(e) => setManualReadout(e.target.value)}
                  className="w-full text-sm font-mono font-black text-slate-900 bg-white p-2 rounded-lg border border-emerald-300 outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            ) : (
              <div className="bg-amber-100/80 border border-amber-300 p-2 rounded-lg space-y-1">
                <div className="flex items-center text-amber-900 font-bold text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-700 shrink-0" />
                  <span>Tidak terdeteksi angka jelas pada foto. Silakan ketik angka rill:</span>
                </div>
                <input
                  type="text"
                  value={manualReadout}
                  onChange={(e) => setManualReadout(e.target.value)}
                  placeholder="Contoh: 120/80 mmHg atau Suhu 36.8°C"
                  className="w-full text-xs font-mono font-bold text-slate-900 bg-white p-2 rounded-lg border border-amber-400 outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            )}

            {detectedQrCode && (
              <div className="text-[10px] text-emerald-800 font-mono font-semibold flex items-center pt-1 border-t border-emerald-200">
                <QrCode className="w-3 h-3 mr-1 text-emerald-600" /> BarcodeDetector QR: {detectedQrCode}
              </div>
            )}

            <p className="text-[10px] text-emerald-700 font-medium flex items-center">
              <ShieldCheck className="w-3 h-3 mr-1 text-emerald-600" />
              {ocrData.facelessCropStatus}
            </p>
          </div>
        )}

        {feedback && (
          <div className={`p-3 rounded-xl text-xs font-bold border ${
            feedback.type === 'error' ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}>
            {feedback.text}
          </div>
        )}

        <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
          {!ocrData ? (
            <div className="w-full flex space-x-2">
              <button
                type="button"
                onClick={handleCaptureClick}
                disabled={isScanning}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs py-3 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition"
              >
                <Camera className="w-4 h-4" />
                <span>Ambil Foto Kamera & Scan Real OCR</span>
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setOcrData(null); setCapturedImage(null); startCamera(); }}
                className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Foto Ulang</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmAndCloseObligation}
                className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-1"
              >
                <Check className="w-4 h-4" />
                <span>Konfirmasi Bukti & Selesai</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
