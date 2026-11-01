import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Activity, Loader2, Check, AlertCircle, X, Volume2 } from 'lucide-react';
import { playSuccessChime } from '../../services/dashboard/audioAlertService';

export default function FloatingVoiceMic({ onCaptureSubmit, currentUser }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultToast, setResultToast] = useState(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'id-ID';

    recognition.onresult = (event) => {
      let currentText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentText += event.results[i][0].transcript;
      }
      setTranscript(currentText);

      // Auto-submit after 2.5 seconds of silence when continuous transcript is captured
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (currentText.trim().length > 5) {
        silenceTimerRef.current = setTimeout(() => {
          handleAutoSubmit(currentText);
        }, 2500);
      }
    };

    recognition.onerror = (event) => {
      console.warn("Speech Recognition Error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      // If still supposed to be listening, restart
      if (isListening) {
        try { recognition.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try { recognition.stop(); } catch {}
    };
  }, [isListening]);

  const toggleListening = () => {
    if (!speechSupported) {
      setResultToast({
        type: 'error',
        title: 'Dikte suara tidak tersedia',
        message: 'Browser ini belum mendukung Web Speech API. Gunakan formulir laporan teks pada halaman Pengasuh; tidak ada laporan contoh yang dikirim otomatis.'
      });
      return;
    }

    if (isListening) {
      stopListeningAndSubmit();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    setTranscript('');
    setResultToast(null);
    setIsListening(true);
    try {
      recognitionRef.current?.start();
    } catch (err) {
      console.warn("Speech start error:", err);
    }
  };

  const stopListeningAndSubmit = () => {
    setIsListening(false);
    try { recognitionRef.current?.stop(); } catch {}
    if (transcript.trim().length > 3) {
      handleAutoSubmit(transcript);
    }
  };

  const handleAutoSubmit = async (textToSubmit) => {
    if (isProcessing || !textToSubmit.trim()) return;
    setIsListening(false);
    try { recognitionRef.current?.stop(); } catch {}

    setIsProcessing(true);
    const actorName = currentUser?.name || currentUser?.full_name || 'Pengasuh';

    const res = await onCaptureSubmit({
      text: textToSubmit,
      sourceType: 'handsfree_floating_mic',
      actorName
    });

    setIsProcessing(false);
    playSuccessChime();

    if (res?.success) {
      setResultToast({
        type: 'success',
        title: 'Laporan Suara Hands-Free Tersimpan!',
        message: res.message || 'Laporan berhasil dicatat di Bitemporal Ledger.'
      });
    } else {
      setResultToast({
        type: 'error',
        title: 'Gagal Memproses Laporan Suara',
        message: res?.error || 'Terjadi kesalahan sistem.'
      });
    }

    setTranscript('');
    setTimeout(() => setResultToast(null), 5000);
  };



  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-3 pointer-events-none">
      {/* Result Toast Banner */}
      {resultToast && (
        <div className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border text-xs max-w-sm backdrop-blur-md animate-slide-up ${
          resultToast.type === 'success'
            ? 'bg-emerald-900/95 text-emerald-100 border-emerald-500/50'
            : 'bg-rose-900/95 text-rose-100 border-rose-500/50'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="font-bold text-white text-xs">{resultToast.title}</p>
            </div>
            <button onClick={() => setResultToast(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="mt-1 text-[11px] opacity-90 leading-relaxed">{resultToast.message}</p>
        </div>
      )}

      {/* Live Voice Speech Bubble */}
      {isListening && (
        <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-sky-500/40 max-w-sm w-80 space-y-2 animate-pulse">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 flex items-center">
              <Volume2 className="w-3.5 h-3.5 mr-1 animate-bounce" /> Hands-Free Voice Capture
            </span>
            <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-mono animate-ping">
              LIVE
            </span>
          </div>

          <p className="text-xs text-slate-200 min-h-[36px] italic">
            "{transcript || 'Mendengarkan laporan pengasuh...'}"
          </p>

          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
            <span>Ucapkan laporan Anda...</span>
            <button
              onClick={stopListeningAndSubmit}
              className="bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-1 rounded-lg font-bold"
            >
              Kirim
            </button>
          </div>
        </div>
      )}

      {/* Floating Microphone Button */}
      <div className="pointer-events-auto relative group">
        <button
          onClick={toggleListening}
          disabled={isProcessing}
          title="Hands-Free Floating Voice Microphone (SambungJaga AI)"
          className={`relative p-4 rounded-full shadow-2xl transition-all transform active:scale-95 flex items-center justify-center border-2 ${
            isListening
              ? 'bg-red-600 text-white border-red-300 ring-4 ring-red-500/40 animate-pulse scale-110'
              : isProcessing
              ? 'bg-amber-500 text-white border-amber-300 animate-spin'
              : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white border-sky-300 shadow-sky-500/30'
          }`}
        >
          {isProcessing ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : isListening ? (
            <MicOff className="w-6 h-6 animate-bounce" />
          ) : (
            <Mic className="w-6 h-6" />
          )}

          {/* Badge Label */}
          <span className="absolute -top-2 -right-1 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow border border-white">
            AI Voice
          </span>
        </button>
      </div>
    </div>
  );
}
