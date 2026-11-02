import React, { useState, useEffect } from 'react';
import { Mic, Send, AlertTriangle, CheckCircle, X, MicOff } from 'lucide-react';

export default function CaregiverCaptureModal({ isOpen, onClose, residents, onCaptureSubmit, currentUser }) {
  const [residentId, setResidentId] = useState('auto');
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [recognition, setRecognition] = useState(null);

  // Setup Web Speech API for Real Voice STT
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.lang = 'id-ID'; // Bahasa Indonesia
      rec.continuous = false;
      rec.interimResults = false;

      rec.onstart = () => {
        setIsListening(true);
        setFeedback(null);
      };

      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(prev => (prev ? prev + ' ' + transcript : transcript));
      };

      rec.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        setFeedback({ type: 'error', text: `Gagal merekam suara: ${event.error}` });
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
    }
  }, []);

  if (!isOpen) return null;

  const handleSpeechToggle = () => {
    if (!recognition) {
      alert('Browser Anda tidak mendukung Web Speech API. Harap gunakan Chrome, Edge, atau Safari versi terbaru.');
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  const [candidateList, setCandidateList] = useState([]);

  const handleSubmit = async (e, forcedResidentId = null) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const targetResId = forcedResidentId || (residentId === 'auto' ? null : residentId);

    try {
      const res = await onCaptureSubmit({
        text: inputText,
        sourceType: isListening ? 'voice_stt' : 'text_input',
        residentId: targetResId,
        actorName: currentUser?.name || currentUser?.full_name || 'Caregiver'
      });

      if (!res?.success) {
        if (res?.needsResident && res?.residentCandidates?.length) {
          setCandidateList(res.residentCandidates);
          setFeedback({ type: 'amber', text: 'Terdeteksi beberapa kandidat nama lansia. Pilih salah satu lansia berikut:' });
        } else {
          setFeedback({ type: 'error', text: res?.error || res?.message || 'Gagal memproses laporan.' });
        }
      } else {
        setCandidateList([]);
        setFeedback({
          type: 'success',
          text: res?.message || (res?.offline ? res?.message : 'Laporan berhasil diproses oleh Care Superagent Otonom')
        });
        setInputText('');
      }
    } catch (err) {
      setFeedback({ type: 'error', text: `Gagal memproses laporan: ${err.message}` });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-slate-900"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Mic className="w-5 h-5 text-sky-600 animate-pulse" />
            <h3 className="font-bold text-slate-900 text-sm">Zero-Friction Voice Capture</h3>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-300 font-mono font-bold flex items-center">
              <CheckCircle className="w-3 h-3 mr-1 text-sky-600" />
              Auto-Resolution System
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Pilih Target Lansia</label>
            <select
              value={residentId}
              onChange={(e) => setResidentId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:ring-1 focus:ring-sky-500 outline-none"
            >
              <option value="auto">⚡ Auto-Deteksi Lansia dari Suara / Teks (Zero-Friction)</option>
              {residents.map(r => (
                <option key={r.id} value={r.id}>{r.full_name} ({r.room_number})</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-600">Input Catatan Suara / Bicara Bebas</label>
              <button
                type="button"
                onClick={handleSpeechToggle}
                className={`flex items-center space-x-1 text-xs font-bold px-2 py-1 rounded-md transition ${
                  isListening
                    ? 'bg-rose-100 text-rose-600 hover:bg-rose-200 animate-pulse'
                    : 'bg-sky-500 text-white hover:bg-sky-600 shadow-md shadow-sky-500/20'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-3.5 h-3.5 animate-pulse" />
                    <span>Hentikan Rekaman...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5" />
                    <span>Mulai Bicara (STT)</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Contoh: Tadi Wisma Melati Oma Aminah suhu tubuhnya 38.5°C dan muntah setelah minum susu..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:ring-1 focus:ring-sky-500 outline-none resize-none font-medium"
            />
          </div>

          {/* Quick preset chips */}
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 font-medium">Uji Coba Otomatisasi AI (Preset 1-Tap):</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setInputText(`Tadi ${residents?.[0]?.full_name?.split(' (')[0] || 'penghuni'} suhu tubuhnya 38.5°C dan muntah setelah makan.`)}
                className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-900 px-2 py-1 rounded-lg border border-amber-200 font-semibold"
              >
                Auto-Task (Gejala Demam/Muntah)
              </button>
              <button
                type="button"
                onClick={() => setInputText('Tensi Pak Bambang sudah diselesaikan 120/80.')}
                className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-900 px-2 py-1 rounded-lg border border-emerald-200 font-semibold"
              >
                Auto-Close (Tensi Pak Bambang)
              </button>
            </div>
          </div>

          {/* Ambiguity Candidate Resolution Selector */}
          {candidateList.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-amber-900">Kandidat Lansia Terdeteksi (Konfirmasi 1-Tap):</p>
              <div className="flex flex-wrap gap-2">
                {candidateList.map((cand) => (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => {
                      setResidentId(cand.id);
                      handleSubmit(null, cand.id);
                    }}
                    className="bg-white hover:bg-amber-600 hover:text-white border border-amber-300 text-amber-950 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition flex items-center space-x-1"
                  >
                    <span>👤 {cand.full_name} ({cand.room_number || 'Kamar'})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {feedback && (
            <div className={`p-3 rounded-xl text-xs flex items-start space-x-2 border font-medium ${
              feedback.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : feedback.type === 'amber'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}>
              {feedback.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" /> : <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />}
              <span>{feedback.text}</span>
            </div>
          )}

          <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2.5 rounded-xl font-semibold transition"
            >
              Batal
            </button>
            <button
              id="btn-submit-care-report"
              type="submit"
              className="w-1/2 bg-sky-600 hover:bg-sky-700 text-white text-xs py-2.5 rounded-xl font-bold transition flex items-center justify-center space-x-1 shadow-md shadow-sky-600/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Proses AI Superagent</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
