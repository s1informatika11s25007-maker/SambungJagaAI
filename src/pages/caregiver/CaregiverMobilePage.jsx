import React, { useState } from 'react';
import { Smartphone, Mic, Plus, WifiOff, Clock, Activity, Loader2, MessageSquare, Send, Camera, CheckCircle2 } from 'lucide-react';
import ObligationGraphCard from '../../components/dashboard/ObligationGraphCard';
import CaregiverCaptureModal from '../../components/caregiver/CaregiverCaptureModal';
import EvidenceUploadModal from '../../components/caregiver/EvidenceUploadModal';
import VisionCameraModal from '../../components/caregiver/VisionCameraModal';
import FloatingVoiceMic from '../../components/common/FloatingVoiceMic';
import CaregiverAssistantWidget from '../../components/caregiver/CaregiverAssistantWidget';
import Badge from '../../components/common/Badge';
import { processWhatsAppVoiceReport } from '../../services/caregiver/whatsappBotService';
import { speakTextNative } from '../../services/ai/nativeChromeService';

export default function CaregiverMobilePage({
  residents = [],
  obligations = [],
  onCaptureSubmit,
  onSubmitEvidence,
  onOpenTraceModal,
  isOffline,
  offlineQueue,
  currentUser
}) {
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [selectedObligationForEvidence, setSelectedObligationForEvidence] = useState(null);
  const [selectedObligationForVision, setSelectedObligationForVision] = useState(null);

  const res1Name = residents?.[0]?.full_name || 'Penghuni';
  const res2Name = residents?.[1]?.full_name || 'Penghuni';

  // WhatsApp Voice Bot Simulator state
  const [showWhatsAppSim, setShowWhatsAppSim] = useState(false);
  const [waInputText, setWaInputText] = useState(`Laporan perawatan ${res1Name}: tensi normal, obat diminumkan.`);
  const [waChatHistory, setWaChatHistory] = useState([]);
  const [isWaSending, setIsWaSending] = useState(false);

  // Quick Chips Notification State
  const [quickChipFeedback, setQuickChipFeedback] = useState(null);

  // Filter tasks strictly for current caregiver and facility (No unassigned dumping)
  const userFacilityId = currentUser?.facility_id || 'FAC-001';
  const caregiverObs = obligations.filter(o =>
    (o.assigned_caregiver_id === currentUser?.id || o.assigned_caregiver_id === currentUser?.staff_id)
    && (o.facility_id ? o.facility_id === userFacilityId : true)
  );

  // Dynamic Time-Based Quick Chips
  const currentHour = new Date().getHours();
  let timeOfDayLabel = 'Shift Pagi (06:00 - 11:00)';
  let quickChips = [
    { label: `🥣 ${res1Name} Sarapan Selesai`, text: `${res1Name} sarapan pagi selesai dihabiskan 1 porsi penuh.` },
    { label: `💊 ${res2Name} Obat Tensi`, text: `${res2Name} obat tensi sudah diminumkan tepat waktu.` },
    { label: '🌡️ Ukur Suhu Pagi Lansia', text: 'Suhu lansia pagi hari ini normal rata-rata 36.5 derajat Celcius.' }
  ];

  if (currentHour >= 11 && currentHour < 16) {
    timeOfDayLabel = 'Shift Siang (11:00 - 16:00)';
    quickChips = [
      { label: '🍲 Makan Siang Lansia Selesai', text: 'Makan siang seluruh lansia selesai diberikan tepat waktu.' },
      { label: `💉 Insulin Post-Prandial ${res1Name}`, text: `Gula darah ${res1Name} stabil, insulin post-prandial sudah diberikan.` },
      { label: '🛏️ Istirahat Siang & Cek Vital', text: 'Seluruh lansia istirahat siang, kondisi aman dan tenang.' }
    ];
  } else if (currentHour >= 16 || currentHour < 6) {
    timeOfDayLabel = 'Shift Malam (16:00 - 06:00)';
    quickChips = [
      { label: '🍚 Makan Malam Lansia Selesai', text: 'Makan malam lansia telah selesai disajikan dan diminumkan obat.' },
      { label: `💊 Obat Malam ${res2Name}`, text: `Obat malam ${res2Name} sudah diminumkan tepat waktu.` },
      { label: '🌙 Cek Posisi Tidur & Keamanan', text: 'Posisi tidur lansia telah diperiksa, pagar tempat tidur terkunci aman.' }
    ];
  }

  const handleQuickChipClick = async (chip) => {
    speakTextNative(`Tercatat: ${chip.label}`);
    setQuickChipFeedback(`✅ ${chip.label} berhasil dilaporkan.`);

    if (typeof onCaptureSubmit === 'function') {
      await onCaptureSubmit(chip.text);
    }

    setTimeout(() => setQuickChipFeedback(null), 4000);
  };

  const handleSendWhatsAppSim = async (e) => {
    e.preventDefault();
    if (!waInputText.trim() || isWaSending) return;

    const userMsg = {
      id: `msg-${Date.now()}`,
      sender: 'caregiver',
      text: waInputText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setWaChatHistory(prev => [...prev, userMsg]);
    setIsWaSending(true);
    const inputTextToProcess = waInputText;
    setWaInputText('');

    const botResult = await processWhatsAppVoiceReport({
      messageText: inputTextToProcess,
      senderName: currentUser?.name || currentUser?.full_name || 'Pengasuh (WhatsApp)',
      context: { residents, activeObligations: obligations },
      onCaptureSubmit
    });

    setIsWaSending(false);

    const botMsg = {
      id: `bot-${Date.now()}`,
      sender: 'bot',
      text: botResult.replyMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setWaChatHistory(prev => [...prev, botMsg]);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Offline Status Warning Bar */}
      {isOffline && (
        <div className="bg-amber-500 text-white px-4 py-3 rounded-2xl flex items-center justify-between shadow-md font-mono text-xs animate-pulse">
          <div className="flex items-center space-x-2">
            <WifiOff size={18} />
            <span className="font-bold">MODALITAS OFFLINE-FIRST AKTIF</span>
          </div>
          <span className="bg-amber-600 px-2.5 py-1 rounded-lg text-[10px] font-bold">
            {offlineQueue?.length || 0} Antrean Disimpan Lokal
          </span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-sky-900 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 bg-sky-500/30 text-sky-200 border border-sky-400/40 rounded-full text-[11px] font-mono font-bold">
              Caregiver Assistant Terminal
            </span>
            <span className="text-slate-400 text-xs font-mono">• {timeOfDayLabel}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            Caregiver Mobile Interface
          </h1>
          <p className="text-slate-300 text-xs mt-1">
            Ketik atau ucapkan laporan — AI mengurus penugasan, matching lansia, &amp; verifikasi bukti.
          </p>
        </div>

        <button
          onClick={() => setIsCaptureOpen(true)}
          className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-5 py-3 rounded-2xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-sky-500/20 transition transform active:scale-95"
        >
          <Mic size={18} />
          <span>Buat Laporan Baru</span>
        </button>
      </div>

      {/* Caregiver Daily Command Center (8 Explicit Command Dimensions) */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-sky-600" />
            <h2 className="text-sm font-bold text-slate-900">Caregiver Daily Command Center</h2>
          </div>
          <span className="text-[10px] bg-sky-50 text-sky-800 border border-sky-200 font-mono px-2.5 py-1 rounded-lg font-bold">
            Pusat Komando Shift Caregiver
          </span>
        </div>

        {/* Top 4 Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 1. Pekerjaan Prioritas Hari Ini */}
          <div className="p-3 bg-sky-50 border border-sky-100 rounded-2xl">
            <span className="text-[10px] text-sky-800 font-bold block uppercase tracking-wider">1. Pekerjaan Prioritas</span>
            <span className="text-xl font-extrabold text-sky-900 mt-1 block">
              {caregiverObs.filter(o => ['critical', 'emergency', 'important'].includes(o.priority)).length}
            </span>
            <span className="text-[9px] text-sky-700 font-medium">Dari {caregiverObs.length} total tugas shift</span>
          </div>

          {/* 2. Penghuni Yang Perlu Ditangani */}
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
            <span className="text-[10px] text-indigo-800 font-bold block uppercase tracking-wider">2. Penghuni Ditangani</span>
            <span className="text-xl font-extrabold text-indigo-900 mt-1 block">
              {new Set(caregiverObs.map(o => o.resident_id)).size}
            </span>
            <span className="text-[9px] text-indigo-700 font-medium">Lansia terdaftar shift ini</span>
          </div>

          {/* 4. Tugas Yang Belum Memiliki Bukti */}
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl">
            <span className="text-[10px] text-amber-800 font-bold block uppercase tracking-wider">4. Belum Memiliki Bukti</span>
            <span className="text-xl font-extrabold text-amber-900 mt-1 block">
              {caregiverObs.filter(o => !o.evidence_submitted && o.required_evidence_grade && o.required_evidence_grade !== 'E0').length}
            </span>
            <span className="text-[9px] text-amber-700 font-medium">Memerlukan foto E1-E3</span>
          </div>

          {/* 5. Tugas Yang Menunggu Supervisor */}
          <div className="p-3 bg-purple-50 border border-purple-100 rounded-2xl">
            <span className="text-[10px] text-purple-800 font-bold block uppercase tracking-wider">5. Menunggu Supervisor</span>
            <span className="text-xl font-extrabold text-purple-900 mt-1 block">
              {caregiverObs.filter(o => ['evidence_submitted', 'pending_review'].includes(o.status)).length}
            </span>
            <span className="text-[9px] text-purple-700 font-medium">Review &amp; approval A3</span>
          </div>
        </div>

        {/* Middle Status Grid: Deadline, Offline Outbox, Next Recommendation, Previous Shift Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-100 text-xs">
          {/* 3. Deadline Terdekat */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-700 font-bold">
              <Clock className="w-4 h-4 text-sky-600" />
              <span>3. Deadline Terdekat:</span>
            </div>
            <p className="text-slate-900 font-mono font-bold text-sm">
              {caregiverObs.find(o => o.valid_until)?.valid_until
                ? `${new Date(caregiverObs.find(o => o.valid_until).valid_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${caregiverObs.find(o => o.valid_until).title}`
                : 'Tidak ada deadline aktif saat ini'}
            </p>
          </div>

          {/* 6. Pekerjaan Tertunda Karena Jaringan (Offline Queue) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
            <div className="flex items-center space-x-1.5 text-slate-700 font-bold">
              <WifiOff className="w-4 h-4 text-amber-600" />
              <span>6. Tertunda Jaringan (Offline Outbox):</span>
            </div>
            <p className="text-slate-900 font-mono font-bold text-sm">
              {offlineQueue?.length > 0
                ? `${offlineQueue.length} laporan tertunda tersimpan lokal`
                : '0 antrean — seluruh data tersinkronisasi'}
            </p>
          </div>

          {/* 7. Rekomendasi Penugasan Berikutnya (AI Next Task Recommendation) */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-emerald-900 font-bold">
              <span className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>7. Rekomendasi Penugasan Berikutnya:</span>
              </span>
              <span className="text-[9px] bg-emerald-200 text-emerald-900 font-mono px-2 py-0.5 rounded-full">AI Smart Suggest</span>
            </div>
            <p className="text-emerald-950 font-bold text-xs mt-1">
              {caregiverObs.find(o => o.status === 'open' || o.status === 'assigned')
                ? `👉 ${caregiverObs.find(o => o.status === 'open' || o.status === 'assigned').title} (${residents.find(r => r.id === caregiverObs.find(o => o.status === 'open' || o.status === 'assigned').resident_id)?.full_name || 'Lansia'})`
                : 'Seluruh tugas aktif shift saat ini telah selesai dilaksanakan!'}
            </p>
          </div>

          {/* 8. Ringkasan Shift Sebelumnya */}
          <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-slate-800 font-bold">
              <span>8. Ringkasan Shift Sebelumnya:</span>
              <span className="text-[9px] bg-slate-200 text-slate-700 font-mono px-2 py-0.5 rounded-full">Handover Log</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-snug">
              Shift sebelumnya menyelesaikan {obligations.filter(o => o.status === 'closed' || o.status === 'verified_closed').length} tugas secara aman tanpa insiden klinis.
            </p>
          </div>
        </div>
      </div>

      {/* Caregiver Autonomous Assistant Widget */}
      <CaregiverAssistantWidget
        currentUser={currentUser}
        residents={residents}
        obligations={obligations}
      />

      {/* Time-Based Quick Action Chips */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-700 font-mono uppercase tracking-wider">
            Quick Report Chips ({timeOfDayLabel})
          </h2>
          <span className="text-[10px] text-slate-400 font-mono">Tap-to-Report Instant</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickChipClick(chip)}
              className="bg-slate-50 hover:bg-sky-50 hover:border-sky-300 text-slate-800 border border-slate-200 font-bold px-3 py-2 rounded-xl text-xs transition flex items-center space-x-1.5"
            >
              <span>{chip.label}</span>
            </button>
          ))}
        </div>

        {quickChipFeedback && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold">
            {quickChipFeedback}
          </div>
        )}
      </div>

      {/* Caregiver Task List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">
            Daftar Tugas Perawatan Dialokasikan ({caregiverObs.length})
          </h2>
          <span className="text-xs text-slate-500 font-mono">Isolasi Fasilitas {userFacilityId}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {caregiverObs.length === 0 ? (
            <div className="col-span-2 p-6 bg-white border border-slate-200 rounded-2xl text-center text-xs text-slate-500 italic">
              Tidak ada tugas aktif dialokasikan khusus untuk Anda saat ini.
            </div>
          ) : (
            caregiverObs.map((ob) => (
              <ObligationGraphCard
                key={ob.id}
                obligation={ob}
                residentName={residents.find(r => r.id === ob.resident_id)?.full_name || 'Penghuni'}
                roomNumber={residents.find(r => r.id === ob.resident_id)?.room_number || '-'}
                onOpenEvidenceModal={(o) => setSelectedObligationForEvidence(o)}
                onOpenVisionModal={(o) => setSelectedObligationForVision(o)}
              />
            ))
          )}
        </div>
      </div>

      {/* WhatsApp Voice Bot Modal */}
      {showWhatsAppSim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 text-white border border-slate-700 rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center font-bold text-xs">
                  WA
                </div>
                <div>
                  <h3 className="text-sm font-bold">SambungJaga WhatsApp Assistant</h3>
                  <p className="text-[10px] text-emerald-400 font-mono">Online • Bot Laporan Suara</p>
                </div>
              </div>
              <button onClick={() => setShowWhatsAppSim(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto p-2 bg-slate-950 rounded-2xl border border-slate-800/80">
              {waChatHistory.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'caregiver' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-2xl text-xs max-w-[80%] ${msg.sender === 'caregiver' ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'}`}>
                    <p>{msg.text}</p>
                    <span className="text-[9px] text-slate-400 block text-right mt-1 font-mono">{msg.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendWhatsAppSim} className="flex gap-2">
              <input
                value={waInputText}
                onChange={e => setWaInputText(e.target.value)}
                placeholder="Ketik laporan WhatsApp..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={!waInputText.trim() || isWaSending}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs"
              >
                {isWaSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Mic Button */}
      <FloatingVoiceMic onCaptureClick={() => setIsCaptureOpen(true)} />

      {/* Modals */}
      <CaregiverCaptureModal
        isOpen={isCaptureOpen}
        onClose={() => setIsCaptureOpen(false)}
        residents={residents}
        onSubmit={onCaptureSubmit}
      />

      {selectedObligationForEvidence && (
        <EvidenceUploadModal
          isOpen={Boolean(selectedObligationForEvidence)}
          onClose={() => setSelectedObligationForEvidence(null)}
          obligation={selectedObligationForEvidence}
          onSubmitEvidence={onSubmitEvidence}
        />
      )}

      {selectedObligationForVision && (
        <VisionCameraModal
          isOpen={Boolean(selectedObligationForVision)}
          onClose={() => setSelectedObligationForVision(null)}
          obligation={selectedObligationForVision}
          onSubmitEvidence={onSubmitEvidence}
        />
      )}
    </div>
  );
}
