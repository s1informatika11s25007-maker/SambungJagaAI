import React, {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

import {
  Mic,
  MicOff,
  Activity,
  Loader2,
  X,
  Volume2
} from 'lucide-react';

import {
  playSuccessChime
} from '../../services/dashboard/audioAlertService';

export default function FloatingVoiceMic({
  onCaptureSubmit,
  onOpenCapture,
  currentUser
}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultToast, setResultToast] = useState(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const processingRef = useRef(false);
  const isListeningRef = useRef(false);
  const latestTranscriptRef = useRef('');

  const stopRecognition = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);

    try {
      recognitionRef.current?.stop();
    } catch {
      // Browser may already have stopped recognition.
    }
  }, []);

  const handleAutoSubmit = useCallback(async (textToSubmit) => {
    const normalizedText = String(textToSubmit || '').trim();

    if (!normalizedText || processingRef.current) {
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);

    stopRecognition();

    let submissionConfirmed = false;

    try {
      if (typeof onCaptureSubmit !== 'function') {
        throw new Error(
          'Layanan pencatatan laporan belum tersedia.'
        );
      }

      const result = await onCaptureSubmit({
        text: normalizedText,
        sourceType: 'voice_stt',
        residentId: null,

        actorName:
          currentUser?.name ||
          currentUser?.full_name ||
          'Caregiver'
      });

      if (result?.success === true) {
        submissionConfirmed = true;

        playSuccessChime();

        setResultToast({
          type: 'success',
          title: 'Laporan suara tersimpan',

          message:
            result.message ||
            'Laporan telah dicatat dan menunggu tindak lanjut sesuai alur supervisor.'
        });

      } else {
        setResultToast({
          type: 'error',

          title: result?.needsResident
            ? 'Konfirmasi penghuni diperlukan'
            : 'Laporan belum tersimpan',

          message:
            result?.error ||
            'Sistem belum mengonfirmasi penyimpanan laporan.',

          transcript: normalizedText,
          canReview: true
        });
      }

    } catch (error) {
      setResultToast({
        type: 'error',
        title: 'Gagal memproses laporan suara',

        message:
          error?.message ||
          'Terjadi kesalahan saat menyimpan laporan.',

        transcript: normalizedText,
        canReview: true
      });

    } finally {
      processingRef.current = false;
      setIsProcessing(false);

      if (submissionConfirmed) {
        setTranscript('');
        latestTranscriptRef.current = '';
      } else {
        setTranscript(normalizedText);
        latestTranscriptRef.current = normalizedText;
      }

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      window.setTimeout(
        () => setResultToast(null),
        6000
      );
    }
  }, [
    currentUser?.name,
    currentUser?.full_name,
    onCaptureSubmit,
    stopRecognition
  ]);

  /*
   * Initialize browser speech recognition.
   */

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return undefined;
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'id-ID';

    recognition.onresult = (event) => {
      let currentText = '';

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        currentText +=
          `${event.results[index][0].transcript} `;
      }

      const nextTranscript = currentText.trim();

      if (nextTranscript) {
        latestTranscriptRef.current = nextTranscript;
        setTranscript(nextTranscript);
      }

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      if (nextTranscript.length > 5) {
        silenceTimerRef.current = window.setTimeout(
          () => {
            handleAutoSubmit(latestTranscriptRef.current);
          },
          2500
        );
      }
    };

    recognition.onerror = (event) => {
      console.warn(
        '[FloatingVoiceMic] Speech recognition error:',
        event.error
      );

      stopRecognition();

      setResultToast({
        type: 'error',
        title: 'Pengenalan suara gagal',

        message:
          `Browser tidak dapat memproses suara (${event.error || 'unknown error'}). Silakan gunakan formulir teks.`
      });
    };

    recognition.onend = () => {
      if (
        isListeningRef.current &&
        !processingRef.current
      ) {
        try {
          recognition.start();
        } catch {
          // Ignore InvalidStateError.
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isListeningRef.current = false;

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      try {
        recognition.stop();
      } catch {
        // No-op on unmount.
      }

      recognitionRef.current = null;
    };
  }, [
    handleAutoSubmit,
    stopRecognition
  ]);

  /*
   * Toggle microphone.
   */

  const toggleListening = () => {
    if (!speechSupported) {
      setResultToast({
        type: 'error',
        title: 'Dikte suara tidak tersedia',

        message:
          'Browser belum mendukung Web Speech API. Gunakan formulir laporan teks.'
      });

      return;
    }

    if (isListeningRef.current) {
      const textToSubmit = latestTranscriptRef.current;

      stopRecognition();

      if (textToSubmit.trim().length > 3) {
        handleAutoSubmit(textToSubmit);
      }

      return;
    }

    latestTranscriptRef.current = '';
    setTranscript('');
    setResultToast(null);

    isListeningRef.current = true;
    setIsListening(true);

    try {
      recognitionRef.current?.start();

    } catch (error) {
      isListeningRef.current = false;
      setIsListening(false);

      setResultToast({
        type: 'error',
        title: 'Mikrofon tidak dapat dimulai',

        message:
          error?.message ||
          'Periksa izin mikrofon browser.'
      });
    }
  };

  const handleManualSend = () => {
    const textToSubmit =
      latestTranscriptRef.current ||
      transcript;

    stopRecognition();

    if (textToSubmit.trim().length > 3) {
      handleAutoSubmit(textToSubmit);
    } else {
      setResultToast({
        type: 'error',
        title: 'Laporan terlalu singkat',
        message: 'Ucapkan laporan terlebih dahulu sebelum mengirim.'
      });
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-3 pointer-events-none">

      {/* Result notification */}

      {resultToast && (
        <div
          className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border text-xs max-w-sm backdrop-blur-md animate-slide-up ${
            resultToast.type === 'success'
              ? 'bg-emerald-900/95 text-emerald-100 border-emerald-500/50'
              : 'bg-rose-900/95 text-rose-100 border-rose-500/50'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-emerald-400 shrink-0" />

              <p className="font-bold text-white text-xs">
                {resultToast.title}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setResultToast(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="mt-1 text-[11px] opacity-90 leading-relaxed">
            {resultToast.message}
          </p>

          {resultToast.transcript && (
            <div className="mt-2 rounded-lg bg-black/20 p-2 text-[10px] leading-relaxed">
              <span className="font-bold">Transkrip:</span>{' '}
              {resultToast.transcript}
            </div>
          )}

          {resultToast.canReview &&
            typeof onOpenCapture === 'function' && (
              <button
                type="button"
                onClick={() =>
                  onOpenCapture(
                    resultToast.transcript || transcript
                  )
                }
                className="mt-2 rounded-lg bg-white/15 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-white/25"
              >
                Buka formulir &amp; pilih penghuni
              </button>
            )}
        </div>
      )}

      {/* Listening panel */}

      {isListening && (
        <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-sky-500/40 max-w-sm w-80 space-y-2 animate-pulse">

          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 flex items-center">
              <Volume2 className="w-3.5 h-3.5 mr-1 animate-bounce" />
              Hands-Free Voice Capture
            </span>

            <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-mono">
              LIVE
            </span>
          </div>

          <p className="text-xs text-slate-200 min-h-[36px] italic">
            {transcript || 'Mendengarkan laporan caregiver…'}
          </p>

          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
            <span>Ucapkan laporan Anda…</span>

            <button
              type="button"
              onClick={handleManualSend}
              className="bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-1 rounded-lg font-bold"
            >
              Kirim
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}

      <div className="pointer-events-auto relative group">
        <button
          type="button"
          onClick={toggleListening}
          disabled={isProcessing}
          title="Hands-Free Voice Capture SambungJaga AI"
          className={`relative p-4 rounded-full shadow-2xl transition-all transform active:scale-95 flex items-center justify-center border-2 ${
            isListening
              ? 'bg-red-600 text-white border-red-300 ring-4 ring-red-500/40 animate-pulse scale-110'
              : isProcessing
                ? 'bg-amber-500 text-white border-amber-300'
                : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white border-sky-300 shadow-sky-500/30'
          }`}
        >
          {isProcessing
            ? <Loader2 className="w-6 h-6 animate-spin" />
            : isListening
              ? <MicOff className="w-6 h-6" />
              : <Mic className="w-6 h-6" />
          }

          <span className="absolute -top-2 -right-1 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow border border-white">
            AI Voice
          </span>
        </button>
      </div>

    </div>
  );
}