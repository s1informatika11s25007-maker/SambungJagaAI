import React, { useState } from 'react';
import {
  Mic,
  Send,
  Sparkles,
  Loader2
} from 'lucide-react';

import {
  getPrioritizedCaregiverTasks
} from '../../services/caregiver/caregiverAutonomousAssistant';

export default function CaregiverAssistantWidget({
  currentUser,
  residents = [],
  obligations = [],
  staff = [],
  onRefresh = () => {},
  onCaptureSubmit,
  onOpenCapture = () => {}
}) {
  const [reportText, setReportText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [reportInputSource, setReportInputSource] = useState('text_input');
  const [reportFeedback, setReportFeedback] = useState(null);
  const [activeTab, setActiveTab] = useState('assistant');

  const caregiverId =
    currentUser?.staff_id ||
    currentUser?.staffProfileId ||
    currentUser?.id ||
    currentUser?.authUserId ||
    null;

  const myDashboard = getPrioritizedCaregiverTasks({
    caregiverId,
    obligations,
    residents,
    staff
  });

  /*
   * Browser Web Speech API.
   */

  const handleMicClick = () => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }

    if (typeof window === 'undefined') {
      setReportFeedback({
        ok: false,
        msg: 'Mikrofon hanya tersedia di browser.'
      });
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setReportFeedback({
        ok: false,
        msg: 'Pengenalan suara tidak didukung peramban ini. Silakan ketik laporan.'
      });
      return;
    }

    try {
      const recognition = new SpeechRecognition();

      recognition.lang = 'id-ID';
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsRecording(true);

        setReportFeedback({
          ok: true,
          msg: 'Mikrofon aktif. Silakan ucapkan laporan perawatan.'
        });
      };

      recognition.onresult = (event) => {
        const transcript =
          event.results?.[0]?.[0]?.transcript || '';

        if (!transcript.trim()) {
          setReportFeedback({
            ok: false,
            msg: 'Browser tidak menghasilkan transkrip.'
          });
          return;
        }

        setReportText((previous) =>
          previous
            ? `${previous} ${transcript}`
            : transcript
        );

        setReportInputSource('voice_stt');
        setIsRecording(false);

        setReportFeedback({
          ok: true,
          msg: `Transkrip suara diterima: "${transcript}"`
        });
      };

      recognition.onerror = (event) => {
        setIsRecording(false);

        setReportFeedback({
          ok: false,
          msg: `Gagal merekam mikrofon: ${event.error || 'Kesalahan mikrofon'}`
        });
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();

    } catch (error) {
      setIsRecording(false);

      setReportFeedback({
        ok: false,
        msg: `Gagal membuka mikrofon: ${error?.message || 'unknown error'}`
      });
    }
  };

  /*
   * Unified report handler.
   */

  const handleReportSubmit = async (event) => {
    event.preventDefault();

    const text = reportText.trim();

    if (!text || isProcessing) return;

    if (typeof onCaptureSubmit !== 'function') {
      setReportFeedback({
        ok: false,
        msg: 'Handler laporan bersama belum tersedia.'
      });
      return;
    }

    setIsProcessing(true);

    try {
      const result = await onCaptureSubmit({
        text,

        sourceType:
          reportInputSource === 'voice_stt'
            ? 'voice'
            : 'text',

        residentId: null,

        actorName:
          currentUser?.name ||
          currentUser?.full_name ||
          'Caregiver'
      });

      if (result?.success !== true) {
        if (
          result?.needsResident === true ||
          result?.needsResidentConfirmation === true
        ) {
          const candidates = Array.isArray(result?.residentCandidates)
            ? result.residentCandidates
            : [];

          const candidateNames = candidates
            .map((item) =>
              item?.resident?.full_name ||
              item?.full_name
            )
            .filter(Boolean);

          setReportFeedback({
            ok: false,

            msg: candidateNames.length
              ? `Laporan belum disimpan. Pilih penghuni yang benar: ${candidateNames.join(', ')}.`
              : 'Laporan belum disimpan. Identitas penghuni perlu dipilih melalui formulir.'
          });

          onOpenCapture(text);
        } else {
          setReportFeedback({
            ok: false,

            msg:
              result?.error ||
              'Database belum mengonfirmasi penyimpanan laporan.'
          });
        }

        return;
      }

      setReportFeedback({
        ok: true,

        msg:
          result.message ||
          'Laporan tersimpan. Usulan tindak lanjut menunggu tinjauan petugas.'
      });

      setReportText('');
      setReportInputSource('text_input');

      await onRefresh();

    } catch (error) {
      setReportFeedback({
        ok: false,
        msg: error?.message || 'Laporan gagal diproses.'
      });

    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 font-sans">

      {/* Header */}

      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
            <Sparkles size={20} />
          </div>

          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Caregiver Autonomous Assistant
            </h2>

            <p className="text-[11px] text-slate-500">
              Pencatatan laporan, matching penghuni, dan prioritas kerja.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 text-xs font-bold font-mono">
          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">
            Workload Score: {myDashboard.workloadScore}
          </span>
        </div>
      </div>

      {/* Tabs */}

      <div className="flex border-b border-slate-100 space-x-4 text-xs font-bold text-slate-500">
        <button
          type="button"
          onClick={() => setActiveTab('assistant')}
          className={`pb-2 transition ${
            activeTab === 'assistant'
              ? 'border-b-2 border-sky-600 text-sky-600'
              : 'hover:text-slate-800'
          }`}
        >
          Laporan Suara / Teks
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my_tasks')}
          className={`pb-2 transition ${
            activeTab === 'my_tasks'
              ? 'border-b-2 border-sky-600 text-sky-600'
              : 'hover:text-slate-800'
          }`}
        >
          Tugas Prioritas Saya ({myDashboard.activeTaskCount})
        </button>
      </div>

      {/* Assistant */}

      {activeTab === 'assistant' && (
        <form onSubmit={handleReportSubmit} className="space-y-3">
          <div className="relative bg-slate-50 border border-slate-200 rounded-xl p-3 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100 transition">

            <textarea
              rows={3}
              value={reportText}
              onChange={(event) => {
                setReportText(event.target.value);
                setReportInputSource('text_input');
              }}
              placeholder="Ketik laporan perawatan atau gunakan mikrofon..."
              className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 outline-none resize-none"
            />

            <div className="flex items-center justify-between border-t border-slate-200/60 pt-2 mt-1">

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={isProcessing}
                  className={`p-2 rounded-xl text-xs font-bold transition flex items-center space-x-1 ${
                    isRecording
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                  }`}
                >
                  <Mic size={14} />
                  <span>
                    {isRecording ? 'Merekam Suara...' : 'Rekam Suara'}
                  </span>
                </button>

                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  Offline queue tersedia jika dikonfigurasi
                </span>
              </div>

              <button
                type="submit"
                disabled={!reportText.trim() || isProcessing}
                className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5 transition"
              >
                {isProcessing
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Send size={13} />
                }

                <span>Proses Laporan</span>
              </button>
            </div>
          </div>

          {reportFeedback && (
            <div
              role="status"
              className={`p-3 rounded-xl text-xs font-bold border ${
                reportFeedback.ok
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border-rose-200'
              }`}
            >
              {reportFeedback.msg}
            </div>
          )}
        </form>
      )}

      {/* Task Dashboard */}

      {activeTab === 'my_tasks' && (
        <div className="space-y-2">

          {myDashboard.upcomingDeadlines.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl">
              Tidak ada tugas aktif dialokasikan untuk Anda saat ini.
            </p>
          ) : (
            myDashboard.upcomingDeadlines.map((task, index) => (
              <div
                key={task.id || index}
                className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900">
                    {task.title}
                  </span>

                  <p className="text-[11px] text-slate-500">
                    {task.residentName} · {task.urgencyLabel}
                  </p>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    task.isOverdue
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {String(task.priority || 'routine').toUpperCase()}
                </span>
              </div>
            ))
          )}

        </div>
      )}

    </div>
  );
}