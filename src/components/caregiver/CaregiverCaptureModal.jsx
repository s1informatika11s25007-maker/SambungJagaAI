import React, { useEffect, useState } from 'react';

import {
  Mic,
  Send,
  AlertTriangle,
  CheckCircle,
  X,
  MicOff,
  Loader2,
  UserRound
} from 'lucide-react';

/**
 * Caregiver report capture modal.
 *
 * - Supports text and browser speech recognition.
 * - Requires resident confirmation when matching is ambiguous.
 * - Rejects uncompleted templates.
 * - Reports success only after persistence acknowledgement.
 */

export default function CaregiverCaptureModal({
  isOpen,
  onClose,
  residents = [],
  onCaptureSubmit,
  currentUser,
  initialText = '',
  onInitialTextConsumed = () => {}
}) {
  const [residentId, setResidentId] = useState('auto');
  const [inputText, setInputText] = useState('');
  const [lastInputSource, setLastInputSource] = useState('text_input');

  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [feedback, setFeedback] = useState(null);
  const [candidateList, setCandidateList] = useState([]);

  const [recognition, setRecognition] = useState(null);

  /*
   * Browser speech recognition initialization.
   */

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setRecognition(null);
      return undefined;
    }

    const rec = new SpeechRecognition();

    rec.lang = 'id-ID';
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => {
      setIsListening(true);
      setFeedback(null);
    };

    rec.onresult = (event) => {
      const transcript = String(
        event.results?.[0]?.[0]?.transcript || ''
      ).trim();

      if (!transcript) return;

      setInputText((previous) =>
        previous
          ? `${previous} ${transcript}`
          : transcript
      );

      setLastInputSource('voice');
    };

    rec.onerror = (event) => {
      setIsListening(false);

      setFeedback({
        type: 'error',

        text:
          `Pengenalan suara gagal: ${event.error || 'kesalahan tidak diketahui'}. Anda masih dapat mengetik laporan.`
      });
    };

    rec.onend = () => {
      setIsListening(false);
    };

    setRecognition(rec);

    return () => {
      try {
        rec.stop();
      } catch {
        // Recognition may already be stopped.
      }
    };
  }, []);

  /*
   * Initial template loading.
   */

  useEffect(() => {
    if (isOpen && initialText) {
      setInputText(initialText);
      setLastInputSource('text_input');
      setCandidateList([]);

      setFeedback({
        type: 'warning',
        text: 'Template telah dimuat. Lengkapi informasi penghuni dan observasi aktual.'
      });

      onInitialTextConsumed();
    }
  }, [
    isOpen,
    initialText,
    onInitialTextConsumed
  ]);

  /*
   * Reset transient state when modal closes.
   */

  useEffect(() => {
    if (!isOpen) {
      setIsListening(false);
      setIsSubmitting(false);
      setCandidateList([]);
      setFeedback(null);

      try {
        recognition?.stop();
      } catch {
        // No-op.
      }
    }
  }, [isOpen, recognition]);

  /*
   * Microphone control.
   */

  const handleSpeechToggle = () => {
    if (!recognition) {
      setFeedback({
        type: 'error',
        text: 'Browser ini tidak mendukung Web Speech API. Ketik laporan secara manual.'
      });
      return;
    }

    if (isListening) {
      try {
        recognition.stop();
      } catch {
        setIsListening(false);
      }

      return;
    }

    setLastInputSource('voice');
    setFeedback(null);

    try {
      recognition.start();

    } catch (error) {
      setIsListening(false);

      setFeedback({
        type: 'error',

        text:
          error?.message ||
          'Mikrofon tidak dapat dimulai.'
      });
    }
  };

  /*
   * Report submission.
   *
   * forcedResidentId is used after the caregiver explicitly chooses
   * one resident from the candidate list.
   */

  const handleSubmit = async (
    event,
    forcedResidentId = null
  ) => {
    if (event?.preventDefault) {
      event.preventDefault();
    }

    if (isSubmitting) return;

    const text = inputText.trim();

    if (!text) {
      setFeedback({
        type: 'error',
        text: 'Isi laporan terlebih dahulu.'
      });

      return;
    }

    if (/__+|\[[^\]]+\]/.test(text)) {
      setFeedback({
        type: 'error',

        text:
          'Lengkapi atau hapus semua placeholder template dalam tanda kurung siku sebelum mengirim laporan.'
      });

      return;
    }

    if (typeof onCaptureSubmit !== 'function') {
      setFeedback({
        type: 'error',
        text: 'Layanan pencatatan laporan belum tersedia.'
      });

      return;
    }

    const selectedId =
      forcedResidentId ||
      (residentId === 'auto' ? null : residentId);

    setIsSubmitting(true);

    setFeedback({
      type: 'loading',
      text: 'Laporan sedang diperiksa dan dikirim ke sistem…'
    });

    try {
      const result = await onCaptureSubmit({
        text,

        sourceType:
          lastInputSource === 'voice'
            ? 'voice'
            : 'text',

        residentId: selectedId,

        actorName:
          currentUser?.name ||
          currentUser?.full_name ||
          'Caregiver'
      });

      const needsResident =
        result?.needsResident === true ||
        result?.needsResidentConfirmation === true;

      /*
       * Identity confirmation.
       */

      if (
        result?.success !== true &&
        needsResident
      ) {
        const candidates =
          Array.isArray(result?.residentCandidates)
            ? result.residentCandidates
                .map((item) => item?.resident || item)
                .filter(Boolean)
            : [];

        setCandidateList(candidates);

        setFeedback({
          type: 'warning',

          text: candidates.length
            ? 'Identitas penghuni belum cukup pasti. Pilih penghuni yang benar; laporan belum disimpan.'
            : 'Identitas penghuni belum dapat ditentukan. Pilih penghuni dari daftar, lalu kirim kembali; laporan belum disimpan.'
        });

        return;
      }

      /*
       * Database failure.
       */

      if (result?.success !== true) {
        setFeedback({
          type: 'error',

          text:
            result?.error ||
            result?.message ||
            'Database belum mengonfirmasi penyimpanan laporan.'
        });

        return;
      }

      /*
       * Confirmed success.
       */

      setCandidateList([]);

      setFeedback({
        type: 'success',

        text:
          result?.message ||
          (
            result?.isOfflineSaved
              ? 'Laporan tersimpan secara lokal dan menunggu sinkronisasi.'
              : 'Laporan berhasil disimpan.'
          )
      });

      setInputText('');
      setResidentId('auto');
      setLastInputSource('text_input');

    } catch (error) {
      setFeedback({
        type: 'error',

        text:
          error?.message ||
          'Gagal memproses laporan.'
      });

    } finally {
      setIsSubmitting(false);
    }
  };

  /*
   * Fill report templates.
   */

  const usePreset = (text) => {
    setInputText(text);
    setLastInputSource('text_input');
    setCandidateList([]);

    setFeedback({
      type: 'warning',

      text:
        'Template laporan dipilih. Periksa dan sesuaikan dengan observasi aktual sebelum mengirim.'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">

      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-slate-900">

        {/* Header */}

        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Mic className="w-5 h-5 text-sky-600" />

            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Buat Laporan Perawatan
              </h3>

              <p className="text-[10px] text-slate-500">
                Teks atau transkrip suara caregiver
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Tutup formulir"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >

          {/* Resident Selector */}

          <div>
            <label
              htmlFor="care-report-resident"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              Pilih penghuni
            </label>

            <select
              id="care-report-resident"
              value={residentId}
              onChange={(event) =>
                setResidentId(event.target.value)
              }
              disabled={isSubmitting}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:ring-1 focus:ring-sky-500 outline-none"
            >
              <option value="auto">
                Deteksi otomatis dari laporan (perlu konfirmasi bila ambigu)
              </option>

              {residents.map((resident) => (
                <option
                  key={resident.id}
                  value={resident.id}
                >
                  {resident.full_name}

                  {resident.room_number
                    ? ` — Kamar ${resident.room_number}`
                    : ''
                  }
                </option>
              ))}
            </select>
          </div>

          {/* Report Text */}

          <div>
            <div className="flex items-center justify-between mb-1 gap-2">
              <label
                htmlFor="care-report-text"
                className="block text-xs font-semibold text-slate-600"
              >
                Catatan observasi
              </label>

              <button
                type="button"
                onClick={handleSpeechToggle}
                disabled={isSubmitting}
                className={`flex items-center space-x-1 text-xs font-bold px-2 py-1 rounded-md transition disabled:opacity-50 ${
                  isListening
                    ? 'bg-rose-100 text-rose-600 hover:bg-rose-200 animate-pulse'
                    : 'bg-sky-600 text-white hover:bg-sky-700'
                }`}
              >
                {isListening
                  ? <MicOff className="w-3.5 h-3.5" />
                  : <Mic className="w-3.5 h-3.5" />
                }

                <span>
                  {isListening
                    ? 'Hentikan rekaman'
                    : 'Mulai bicara'
                  }
                </span>
              </button>
            </div>

            <textarea
              id="care-report-text"
              rows={4}
              value={inputText}
              onChange={(event) => {
                setInputText(event.target.value);
                setLastInputSource('text_input');
                setCandidateList([]);
              }}
              disabled={isSubmitting}
              placeholder="Contoh: Ibu Aminah, kamar 101, suhu terukur 38,5 °C dan muntah setelah makan."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:ring-1 focus:ring-sky-500 outline-none resize-none font-medium"
            />

            <p className="mt-1 text-[10px] text-slate-500">
              Sampaikan nama penghuni dan hasil observasi yang benar-benar dilakukan. AI hanya membantu pencatatan dan usulan tinjauan, bukan diagnosis atau instruksi klinis.
            </p>
          </div>

          {/* Templates */}

          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 font-medium">
              Template untuk membantu pengisian:
            </p>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => usePreset(
                  `Observasi ${residents?.[0]?.full_name || 'penghuni'}: suhu tubuh terukur __ °C dan terdapat keluhan __.`
                )}
                className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-900 px-2 py-1 rounded-lg border border-amber-200 font-semibold disabled:opacity-50"
              >
                Template suhu/keluhan
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => usePreset(
                  'Hasil pengukuran tekanan darah __/__ mmHg pada penghuni __, diukur pada pukul __.'
                )}
                className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-900 px-2 py-1 rounded-lg border border-emerald-200 font-semibold disabled:opacity-50"
              >
                Template tekanan darah
              </button>
            </div>
          </div>

          {/* Resident Confirmation */}

          {candidateList.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-amber-900 flex items-center gap-1">
                <UserRound className="w-3.5 h-3.5" />
                Konfirmasi identitas penghuni
              </p>

              <div className="flex flex-wrap gap-2">
                {candidateList.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setResidentId(candidate.id);
                      handleSubmit(null, candidate.id);
                    }}
                    className="bg-white hover:bg-amber-600 hover:text-white border border-amber-300 text-amber-950 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
                  >
                    {candidate.full_name}

                    {candidate.room_number
                      ? ` (Kamar ${candidate.room_number})`
                      : ''
                    }
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feedback */}

          {feedback && (
            <div
              role="status"
              className={`p-3 rounded-xl text-xs flex items-start space-x-2 border font-medium ${
                feedback.type === 'error'
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : feedback.type === 'warning'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : feedback.type === 'loading'
                      ? 'bg-sky-50 border-sky-300 text-sky-900'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-900'
              }`}
            >
              {feedback.type === 'loading'
                ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                : feedback.type === 'error' || feedback.type === 'warning'
                  ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  : <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              }

              <span>{feedback.text}</span>
            </div>
          )}

          {/* Footer */}

          <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2.5 rounded-xl font-semibold transition disabled:opacity-50"
            >
              Batal
            </button>

            <button
              id="btn-submit-care-report"
              type="submit"
              disabled={!inputText.trim() || isSubmitting}
              className="w-1/2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs py-2.5 rounded-xl font-bold transition flex items-center justify-center space-x-1 shadow-md shadow-sky-600/20"
            >
              {isSubmitting
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Send className="w-3.5 h-3.5" />
              }

              <span>
                {isSubmitting ? 'Memproses…' : 'Kirim laporan'}
              </span>
            </button>

          </div>

        </form>
      </div>
    </div>
  );
}