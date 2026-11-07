import React, { useCallback, useMemo, useState } from 'react';
import {
  Mic,
  WifiOff,
  Clock,
  Activity,
  Loader2,
  Send,
  CheckCircle2
} from 'lucide-react';

import ObligationGraphCard from '../../components/dashboard/ObligationGraphCard';
import CaregiverCaptureModal from '../../components/caregiver/CaregiverCaptureModal';
import EvidenceUploadModal from '../../components/caregiver/EvidenceUploadModal';
import VisionCameraModal from '../../components/caregiver/VisionCameraModal';
import FloatingVoiceMic from '../../components/common/FloatingVoiceMic';
import CaregiverAssistantWidget from '../../components/caregiver/CaregiverAssistantWidget';

import { processWhatsAppVoiceReport } from '../../services/caregiver/whatsappBotService';

export default function CaregiverMobilePage({
  residents = [],
  obligations = [],
  onCaptureSubmit,
  onSubmitEvidence,
  onOpenTraceModal,
  isOffline = false,
  offlineQueue = [],
  currentUser
}) {
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [captureInitialText, setCaptureInitialText] = useState('');

  const [
    selectedObligationForEvidence,
    setSelectedObligationForEvidence
  ] = useState(null);

  const [
    selectedObligationForVision,
    setSelectedObligationForVision
  ] = useState(null);

  // WhatsApp simulator is local, not a live WhatsApp integration.
  const [showWhatsAppSim, setShowWhatsAppSim] = useState(false);

  const firstResidentName =
    residents?.[0]?.full_name || 'Penghuni';

  const secondResidentName =
    residents?.[1]?.full_name || firstResidentName;

  const [waInputText, setWaInputText] = useState(
    `Laporan perawatan ${firstResidentName}: kondisi perlu diperiksa caregiver.`
  );

  const [waChatHistory, setWaChatHistory] = useState([]);
  const [isWaSending, setIsWaSending] = useState(false);
  const [quickChipFeedback, setQuickChipFeedback] = useState(null);

  const userFacilityId = currentUser?.facility_id || null;

  const currentStaffIds = [
    currentUser?.staff_id,
    currentUser?.id
  ].filter(Boolean);

  /*
   * Fail closed:
   * Never display obligations without a facility match.
   */

  const caregiverObs = useMemo(() => {
    if (!userFacilityId || currentStaffIds.length === 0) {
      return [];
    }

    return obligations.filter((obligation) =>
      currentStaffIds.includes(obligation.assigned_caregiver_id) &&
      obligation.facility_id === userFacilityId
    );
  }, [
    obligations,
    userFacilityId,
    currentUser?.staff_id,
    currentUser?.id
  ]);

  /*
   * One canonical report handler for every input method.
   */

  const submitCareReport = useCallback(async (payloadOrText) => {
    if (typeof onCaptureSubmit !== 'function') {
      return {
        success: false,
        error: 'Layanan pencatatan laporan belum tersedia.'
      };
    }

    const payload = typeof payloadOrText === 'string'
      ? { text: payloadOrText }
      : (payloadOrText || {});

    const normalizedPayload = {
      text: String(
        payload.text ||
        payload.textPrompt ||
        payload.transcript ||
        ''
      ).trim(),

      sourceType: [
        'voice',
        'voice_stt',
        'handsfree_voice'
      ].includes(payload.sourceType)
        ? 'voice'
        : 'text',

      residentId: payload.residentId || null,

      actorName:
        payload.actorName ||
        currentUser?.name ||
        currentUser?.full_name ||
        'Caregiver'
    };

    if (!normalizedPayload.text) {
      return {
        success: false,
        error: 'Isi laporan masih kosong.'
      };
    }

    try {
      const result = await onCaptureSubmit(normalizedPayload);

      return {
        ...result,

        needsResident:
          result?.needsResident === true ||
          result?.needsResidentConfirmation === true
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || 'Laporan gagal diproses.'
      };
    }
  }, [
    onCaptureSubmit,
    currentUser?.name,
    currentUser?.full_name
  ]);

  /*
   * Quick-report templates.
   *
   * They are never submitted directly because they do not represent
   * an actual observation until completed by the caregiver.
   */

  const currentHour = new Date().getHours();

  let timeOfDayLabel = 'Shift Pagi (06:00–11:00)';

  let quickChips = [
    {
      label: `🥣 ${firstResidentName} — Sarapan`,

      text:
        'Catatan sarapan: [NAMA PENGHUNI] — [TULISKAN APAKAH SARAPAN DILAKUKAN DAN JUMLAH MAKANAN AKTUAL].'
    },
    {
      label: `💊 ${secondResidentName} — Laporan obat`,

      text:
        'Catatan jadwal perawatan: [NAMA PENGHUNI] — [TULISKAN OBSERVASI AKTUAL TANPA MENAMBAHKAN INSTRUKSI OBAT].'
    },
    {
      label: '🌡️ Pemeriksaan suhu',

      text:
        'Pemeriksaan suhu: [NAMA PENGHUNI] — [TULISKAN HASIL PENGUKURAN AKTUAL DALAM °C].'
    }
  ];

  if (currentHour >= 11 && currentHour < 16) {
    timeOfDayLabel = 'Shift Siang (11:00–16:00)';

    quickChips = [
      {
        label: '🍲 Makan siang',
        text:
          'Catatan makan siang: [NAMA PENGHUNI] — [TULISKAN JUMLAH MAKANAN AKTUAL].'
      },
      {
        label: `🩺 Pemeriksaan ${firstResidentName}`,
        text:
          'Catatan pemeriksaan: [NAMA PENGHUNI] — [TULISKAN HASIL PENGUKURAN AKTUAL].'
      },
      {
        label: '🛏️ Istirahat siang',
        text:
          'Catatan istirahat siang: [NAMA PENGHUNI] — [TULISKAN KEADAAN YANG BENAR-BENAR DIAMATI].'
      }
    ];

  } else if (currentHour >= 16 || currentHour < 6) {
    timeOfDayLabel = 'Shift Malam (16:00–06:00)';

    quickChips = [
      {
        label: '🍚 Makan malam',
        text:
          'Catatan makan malam: [NAMA PENGHUNI] — [TULISKAN JUMLAH MAKANAN AKTUAL].'
      },
      {
        label: `💊 Catatan ${secondResidentName}`,
        text:
          'Catatan jadwal perawatan: [NAMA PENGHUNI] — [TULISKAN OBSERVASI AKTUAL].'
      },
      {
        label: '🌙 Pemeriksaan keamanan',
        text:
          'Catatan pemeriksaan keamanan: [AREA/PENGHUNI] — [TULISKAN HASIL PEMERIKSAAN AKTUAL].'
      }
    ];
  }

  const handleQuickChipClick = (chip) => {
    setCaptureInitialText(chip.text);

    setQuickChipFeedback({
      type: 'warning',

      text:
        'Template dibuka pada formulir. Lengkapi nama penghuni dan hasil observasi aktual sebelum mengirim.'
    });

    setIsCaptureOpen(true);
  };

  const closeCaptureModal = () => {
    setIsCaptureOpen(false);
    setCaptureInitialText('');
  };

  /*
   * WhatsApp local test simulator.
   */

  const handleSendWhatsAppSim = async (event) => {
    event.preventDefault();

    if (!waInputText.trim() || isWaSending) {
      return;
    }

    const inputTextToProcess = waInputText.trim();

    const timestamp = new Date().toLocaleTimeString(
      [],
      {
        hour: '2-digit',
        minute: '2-digit'
      }
    );

    const userMsg = {
      id: `msg-${Date.now()}`,
      sender: 'caregiver',
      text: inputTextToProcess,
      timestamp
    };

    setWaChatHistory((previous) => [
      ...previous,
      userMsg
    ]);

    setIsWaSending(true);
    setWaInputText('');

    try {
      const botResult = await processWhatsAppVoiceReport({
        messageText: inputTextToProcess,

        senderName:
          currentUser?.name ||
          currentUser?.full_name ||
          'Caregiver (simulasi)',

        context: {
          residents,
          activeObligations: obligations,
          facilityId: userFacilityId
        },

        onCaptureSubmit: submitCareReport
      });

      const botMsg = {
        id: `bot-${Date.now()}`,
        sender: 'bot',

        text: botResult?.success === true
          ? botResult.replyMessage
          : `Laporan belum tersimpan: ${
              botResult?.captureResult?.error ||
              botResult?.error ||
              'layanan gagal mengonfirmasi penyimpanan.'
            }`,

        timestamp: new Date().toLocaleTimeString(
          [],
          {
            hour: '2-digit',
            minute: '2-digit'
          }
        )
      };

      setWaChatHistory((previous) => [
        ...previous,
        botMsg
      ]);

    } catch (error) {
      setWaChatHistory((previous) => [
        ...previous,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',

          text:
            `Gagal memproses laporan: ${
              error?.message || 'kesalahan tidak diketahui.'
            }`,

          timestamp: new Date().toLocaleTimeString(
            [],
            {
              hour: '2-digit',
              minute: '2-digit'
            }
          )
        }
      ]);

    } finally {
      setIsWaSending(false);
    }
  };

  /*
   * Task dashboard data.
   */

  const nextTask = caregiverObs.find((item) =>
    ['open', 'assigned'].includes(item.status)
  );

  const nearestDeadlineTask = caregiverObs
    .filter((item) =>
      item.valid_until &&
      Number.isFinite(
        new Date(item.valid_until).getTime()
      )
    )
    .sort((a, b) =>
      new Date(a.valid_until).getTime() -
      new Date(b.valid_until).getTime()
    )[0];

  return (
    <div className="space-y-6 w-full">

      {isOffline && (
        <div className="bg-amber-500 text-white px-4 py-3 rounded-2xl flex items-center justify-between shadow-md font-mono text-xs animate-pulse">

          <div className="flex items-center space-x-2">
            <WifiOff size={18} />

            <span className="font-bold">
              MODALITAS OFFLINE AKTIF
            </span>
          </div>

          <span className="bg-amber-600 px-2.5 py-1 rounded-lg text-[10px] font-bold">
            {offlineQueue?.length || 0} antrean lokal
          </span>
        </div>
      )}

      {/* Header */}

      <div className="bg-gradient-to-r from-sky-900 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 bg-sky-500/30 text-sky-200 border border-sky-400/40 rounded-full text-[11px] font-mono font-bold">
              Caregiver Assistant
            </span>

            <span className="text-slate-400 text-xs font-mono">
              • {timeOfDayLabel}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            Caregiver Mobile Interface
          </h1>

          <p className="text-slate-300 text-xs mt-1">
            Catat observasi aktual. AI membantu menyusun informasi; petugas berwenang tetap memeriksa tindak lanjut.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">

          <button
            type="button"
            onClick={() => setShowWhatsAppSim(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-3 rounded-2xl text-xs transition"
          >
            Uji Bot Pesan
          </button>

          <button
            type="button"
            onClick={() => {
              setCaptureInitialText('');
              setIsCaptureOpen(true);
            }}
            className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-5 py-3 rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-sky-500/20 transition transform active:scale-95"
          >
            <Mic size={18} />
            <span>Buat Laporan Baru</span>
          </button>

        </div>
      </div>

      {/* Daily Command Center */}

      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">

        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-sky-600" />

            <h2 className="text-sm font-bold text-slate-900">
              Pusat Perintah Harian Pengasuh
            </h2>
          </div>

          <span className="text-[10px] bg-sky-50 text-sky-800 border border-sky-200 font-mono px-2.5 py-1 rounded-lg font-bold">
            Pusat Komando Shift
          </span>
        </div>

        {/* Metrics */}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

          <div className="p-3 bg-sky-50 border border-sky-100 rounded-2xl">
            <span className="text-[10px] text-sky-800 font-bold block uppercase tracking-wider">
              Pekerjaan Prioritas
            </span>

            <span className="text-xl font-extrabold text-sky-900 mt-1 block">
              {
                caregiverObs.filter((item) =>
                  ['critical', 'emergency', 'important'].includes(item.priority)
                ).length
              }
            </span>

            <span className="text-[9px] text-sky-700 font-medium">
              Dari {caregiverObs.length} tugas teralokasi
            </span>
          </div>

          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
            <span className="text-[10px] text-indigo-800 font-bold block uppercase tracking-wider">
              Penghuni Ditangani
            </span>

            <span className="text-xl font-extrabold text-indigo-900 mt-1 block">
              {
                new Set(
                  caregiverObs
                    .map((item) => item.resident_id)
                    .filter(Boolean)
                ).size
              }
            </span>

            <span className="text-[9px] text-indigo-700 font-medium">
              Dari tugas yang teralokasi
            </span>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl">
            <span className="text-[10px] text-amber-800 font-bold block uppercase tracking-wider">
              Belum Memiliki Bukti
            </span>

            <span className="text-xl font-extrabold text-amber-900 mt-1 block">
              {
                caregiverObs.filter((item) =>
                  !item.evidence_submitted &&
                  item.required_evidence_grade &&
                  item.required_evidence_grade !== 'E0'
                ).length
              }
            </span>

            <span className="text-[9px] text-amber-700 font-medium">
              Memerlukan bukti sesuai grade
            </span>
          </div>

          <div className="p-3 bg-purple-50 border border-purple-100 rounded-2xl">
            <span className="text-[10px] text-purple-800 font-bold block uppercase tracking-wider">
              Menunggu Supervisor
            </span>

            <span className="text-xl font-extrabold text-purple-900 mt-1 block">
              {
                caregiverObs.filter((item) =>
                  ['evidence_submitted', 'pending_review'].includes(item.status)
                ).length
              }
            </span>

            <span className="text-[9px] text-purple-700 font-medium">
              Menunggu pemeriksaan bukti
            </span>
          </div>

        </div>

        {/* Additional status */}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-100 text-xs">

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-700 font-bold">
              <Clock className="w-4 h-4 text-sky-600" />
              <span>Deadline Terdekat</span>
            </div>

            <p className="text-slate-900 font-mono font-bold text-sm">
              {nearestDeadlineTask
                ? `${new Date(nearestDeadlineTask.valid_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${nearestDeadlineTask.title}`
                : 'Tidak ada deadline tercatat'}
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-700 font-bold">
              <WifiOff className="w-4 h-4 text-amber-600" />
              <span>Antrean Offline</span>
            </div>

            <p className="text-slate-900 font-mono font-bold text-sm">
              {offlineQueue?.length > 0
                ? `${offlineQueue.length} item menunggu sinkronisasi`
                : 'Tidak ada antrean lokal yang terdeteksi'}
            </p>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-emerald-900 font-bold">
              <span className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Tugas Berikutnya</span>
              </span>

              <span className="text-[9px] bg-emerald-200 text-emerald-900 font-mono px-2 py-0.5 rounded-full">
                Prioritas
              </span>
            </div>

            <p className="text-emerald-950 font-bold text-xs mt-1">
              {nextTask
                ? `${nextTask.title} (${residents.find((resident) => resident.id === nextTask.resident_id)?.full_name || 'Penghuni'})`
                : 'Tidak ada tugas berstatus open/assigned'}
            </p>
          </div>

          <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-slate-800 font-bold">
              <span>Ringkasan Status Tugas</span>

              <span className="text-[9px] bg-slate-200 text-slate-700 font-mono px-2 py-0.5 rounded-full">
                Data tercatat
              </span>
            </div>

            <p className="text-slate-600 text-[11px] leading-snug">
              {
                obligations.filter((item) =>
                  ['closed', 'verified_closed'].includes(item.status)
                ).length
              } tugas memiliki status closed/verified_closed pada data yang dimuat. Ini bukan pernyataan bahwa tidak ada insiden.
            </p>
          </div>

        </div>

        {!userFacilityId && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
            Facility ID akun belum tersedia. Daftar tugas disembunyikan sampai fasilitas dapat diverifikasi.
          </p>
        )}

      </div>

      {/* AI Assistant */}

      <CaregiverAssistantWidget
        currentUser={currentUser}
        residents={residents}
        obligations={obligations}
        onCaptureSubmit={submitCareReport}
        onOpenCapture={(text) => {
          setCaptureInitialText(text || '');
          setIsCaptureOpen(true);
        }}
      />

      {/* Quick Report */}

      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">

        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-700 font-mono uppercase tracking-wider">
            Quick Report ({timeOfDayLabel})
          </h2>

          <span className="text-[10px] text-slate-400 font-mono">
            Template laporan
          </span>
        </div>

        <p className="text-[10px] text-slate-500">
          Template tidak boleh dianggap sebagai bukti kejadian. Periksa dan ubah isi laporan agar sesuai observasi aktual sebelum mengirim.
        </p>

        <div className="flex flex-wrap gap-2">
          {quickChips.map((chip, index) => (
            <button
              key={`${chip.label}-${index}`}
              type="button"
              onClick={() => handleQuickChipClick(chip)}
              className="bg-slate-50 hover:bg-sky-50 hover:border-sky-300 disabled:opacity-50 text-slate-800 border border-slate-200 font-bold px-3 py-2 rounded-xl text-xs transition flex items-center space-x-1.5"
            >
              <span>{chip.label}</span>
            </button>
          ))}
        </div>

        {quickChipFeedback && (
          <div
            className={`p-2.5 rounded-xl text-xs font-bold border ${
              quickChipFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : quickChipFeedback.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : quickChipFeedback.type === 'loading'
                    ? 'bg-sky-50 border-sky-200 text-sky-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {quickChipFeedback.text}
          </div>
        )}

      </div>

      {/* Obligation List */}

      <div className="space-y-3">

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">
            Daftar Tugas Perawatan ({caregiverObs.length})
          </h2>

          <span className="text-xs text-slate-500 font-mono">
            Fasilitas {userFacilityId || 'belum terverifikasi'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {caregiverObs.length === 0 ? (
            <div className="col-span-2 p-6 bg-white border border-slate-200 rounded-2xl text-center text-xs text-slate-500 italic">
              {userFacilityId
                ? 'Tidak ada tugas aktif yang dialokasikan kepada akun ini.'
                : 'Tugas tidak ditampilkan karena facility ID belum terverifikasi.'}
            </div>
          ) : (
            caregiverObs.map((obligation) => (
              <ObligationGraphCard
                key={obligation.id}
                obligation={obligation}
                currentUserRole="caregiver"
                residentName={
                  residents.find(
                    (resident) => resident.id === obligation.resident_id
                  )?.full_name || 'Penghuni'
                }
                roomNumber={
                  residents.find(
                    (resident) => resident.id === obligation.resident_id
                  )?.room_number || '-'
                }
                onOpenEvidenceModal={(item) =>
                  setSelectedObligationForEvidence(item)
                }
                onOpenTraceModal={onOpenTraceModal}
                onOpenVisionModal={(item) =>
                  setSelectedObligationForVision(item)
                }
              />
            ))
          )}

        </div>
      </div>

      {/* WhatsApp Simulator */}

      {showWhatsAppSim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 text-white border border-slate-700 rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4">

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center font-bold text-xs">
                  WA
                </div>

                <div>
                  <h3 className="text-sm font-bold">
                    SambungJaga WhatsApp Test Simulator
                  </h3>

                  <p className="text-[10px] text-amber-300 font-mono">
                    Simulasi lokal — bukan koneksi WhatsApp live
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowWhatsAppSim(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto p-2 bg-slate-950 rounded-2xl border border-slate-800/80">
              {waChatHistory.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender === 'caregiver'
                      ? 'justify-end'
                      : 'justify-start'
                  }`}
                >
                  <div
                    className={`p-3 rounded-2xl text-xs max-w-[80%] ${
                      message.sender === 'caregiver'
                        ? 'bg-emerald-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                    }`}
                  >
                    <p>{message.text}</p>

                    <span className="text-[9px] text-slate-400 block text-right mt-1 font-mono">
                      {message.timestamp}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleSendWhatsAppSim}
              className="flex gap-2"
            >
              <input
                value={waInputText}
                onChange={(event) => setWaInputText(event.target.value)}
                placeholder="Ketik laporan untuk simulasi..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
              />

              <button
                type="submit"
                disabled={!waInputText.trim() || isWaSending}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs"
              >
                {isWaSending
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Send size={14} />
                }
              </button>
            </form>

          </div>
        </div>
      )}

      {/* Browser Voice Input */}

      <FloatingVoiceMic
        onCaptureSubmit={submitCareReport}
        onOpenCapture={(text) => {
          setCaptureInitialText(text || '');
          setIsCaptureOpen(true);
        }}
        currentUser={currentUser}
      />

      {/* Care Report Modal */}

      <CaregiverCaptureModal
        isOpen={isCaptureOpen}
        onClose={closeCaptureModal}
        residents={residents}
        onCaptureSubmit={submitCareReport}
        currentUser={currentUser}
        initialText={captureInitialText}
        onInitialTextConsumed={() => setCaptureInitialText('')}
      />

      {/* Evidence Upload Modal */}

      {selectedObligationForEvidence && (
        <EvidenceUploadModal
          isOpen={Boolean(selectedObligationForEvidence)}
          onClose={() => setSelectedObligationForEvidence(null)}
          obligation={selectedObligationForEvidence}
          onSubmitEvidence={onSubmitEvidence}
          currentUser={currentUser}
        />
      )}

      {/* Vision Camera Modal */}

      {selectedObligationForVision && (
        <VisionCameraModal
          isOpen={Boolean(selectedObligationForVision)}
          onClose={() => setSelectedObligationForVision(null)}
          obligation={selectedObligationForVision}
          onSubmitEvidence={onSubmitEvidence}
          currentUser={currentUser}
        />
      )}

    </div>
  );
}