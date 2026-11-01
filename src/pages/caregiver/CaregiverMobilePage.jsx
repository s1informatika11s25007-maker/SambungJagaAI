import React, { useState } from 'react';
import { Smartphone, Mic, Plus, WifiOff, Clock, Activity, Loader2, MessageSquare, Send, Camera, CheckCircle2 } from 'lucide-react';
import ObligationGraphCard from '../../components/dashboard/ObligationGraphCard';
import CaregiverCaptureModal from '../../components/caregiver/CaregiverCaptureModal';
import EvidenceUploadModal from '../../components/caregiver/EvidenceUploadModal';
import VisionCameraModal from '../../components/caregiver/VisionCameraModal';
import FloatingVoiceMic from '../../components/common/FloatingVoiceMic';
import Badge from '../../components/common/Badge';
import { processWhatsAppVoiceReport } from '../../services/caregiver/whatsappBotService';
import { speakTextNative } from '../../services/ai/nativeChromeService';

export default function CaregiverMobilePage({
  residents,
  obligations,
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

  const caregiverObs = obligations.filter(o => o.assigned_caregiver_id === currentUser?.id || o.status === 'open');

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
      { label: '🌙 Cek Posisi Tidur & Sisa Cairan', text: 'Pemeriksaan posisi tidur dan cek cairan infus/urin lansia normal.' }
    ];
  }

  const handleQuickChipClick = async (chip) => {
    setQuickChipFeedback({ type: 'loading', text: `Memproses: "${chip.label}"...` });
    const actorName = currentUser?.name || currentUser?.full_name || 'Caregiver';

    const res = await onCaptureSubmit({
      text: chip.text,
      sourceType: 'one_tap_quick_chip',
      actorName
    });

    if (res?.success) {
      setQuickChipFeedback({ type: 'success', text: `✅ [One-Tap Chip Success] ${res.message}` });
      speakTextNative(`Tugas ${chip.label} berhasil dicatat oleh SambungJaga.`);
    } else {
      setQuickChipFeedback({ type: 'error', text: res?.error || 'Gagal memproses chip.' });
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
    <div className="w-full space-y-6 relative pb-20">
      {/* Mobile PWA Container */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-2xl shadow-slate-200/60 space-y-5 w-full">

        {/* Header PWA */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-2xl border border-sky-200">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">{currentUser?.name || currentUser?.full_name || 'Staf Medis'}</h2>
              <p className="text-[10px] text-slate-500 font-medium">{timeOfDayLabel}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowWhatsAppSim(!showWhatsAppSim)}
              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-xl border border-emerald-300 flex items-center space-x-1 transition"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp Bot</span>
            </button>
            <Badge variant={isOffline ? 'warning' : 'success'} className="text-[10px]">
              {isOffline ? `P5 Offline (${offlineQueue.length})` : 'Online Supabase'}
            </Badge>
          </div>
        </div>

        {/* 1. ONE-TAP QUICK ROUTINE CHIPS (USABILITY #4) */}
        <div className="bg-gradient-to-r from-sky-50 to-indigo-50/50 p-4 rounded-2xl border border-sky-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 flex items-center">
              <Activity className="w-4 h-4 mr-1.5 text-sky-600" />
              One-Tap Quick Routine Chips (Zero-Friction)
            </h3>
            <span className="text-[10px] text-sky-700 font-medium bg-sky-100 px-2 py-0.5 rounded-full">
              {timeOfDayLabel}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickChipClick(chip)}
                className="bg-white hover:bg-sky-600 text-slate-800 hover:text-white border border-sky-200 hover:border-sky-600 px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition transform active:scale-95 flex items-center space-x-1"
              >
                <span>{chip.label}</span>
              </button>
            ))}
          </div>

          {quickChipFeedback && (
            <div className={`p-2.5 rounded-xl text-xs font-bold border animate-fade-in ${
              quickChipFeedback.type === 'loading'
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : quickChipFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-rose-50 text-rose-900 border-rose-300'
            }`}>
              {quickChipFeedback.text}
            </div>
          )}
        </div>

        {/* 2. WHATSAPP VOICE BOT SIMULATOR PANEL (USABILITY #2) */}
        {showWhatsAppSim && (
          <div className="bg-emerald-900 text-white rounded-2xl p-4 border border-emerald-700 shadow-xl space-y-3 animate-slide-down">
            <div className="flex items-center justify-between border-b border-emerald-800 pb-2">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-emerald-700 rounded-lg">
                  <MessageSquare className="w-4 h-4 text-emerald-200" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">SambungJaga WhatsApp Care Bot (Zero-App)</h4>
                  <p className="text-[10px] text-emerald-300">Kirim Voice Note / Teks &lt; 2 Detik Realtime Response</p>
                </div>
              </div>
              <button onClick={() => setShowWhatsAppSim(false)} className="text-emerald-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Chat Messages */}
            <div className="bg-emerald-950/70 p-3 rounded-xl max-h-48 overflow-y-auto space-y-2 text-xs border border-emerald-800">
              {waChatHistory.length === 0 ? (
                <p className="text-[11px] text-emerald-400 italic text-center py-3">
                  Simulasi WhatsApp Bot aktif. Ketik atau kirim laporan suara untuk menguji respon AI.
                </p>
              ) : (
                waChatHistory.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'caregiver' ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`max-w-[85%] p-2.5 rounded-xl ${
                      msg.sender === 'caregiver'
                        ? 'bg-emerald-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-emerald-100 border border-emerald-700/50 rounded-bl-none whitespace-pre-line font-mono text-[11px]'
                    }`}>
                      {msg.text}
                    </div>
                    <span className="text-[9px] text-emerald-400 mt-0.5">{msg.timestamp}</span>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendWhatsAppSim} className="flex items-center space-x-2">
              <input
                type="text"
                value={waInputText}
                onChange={(e) => setWaInputText(e.target.value)}
                placeholder="Ketik laporan WhatsApp..."
                className="flex-1 bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-xs text-white placeholder-emerald-500 focus:outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                disabled={isWaSending}
                className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold p-2 rounded-xl transition"
              >
                {isWaSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        )}

        {/* P5 Offline Ledger Notice */}
        {isOffline && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 flex items-start space-x-2.5">
            <WifiOff className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold">Mode Offline-First Aktif (P5 Ledger)</p>
              <p className="text-[11px] opacity-90 mt-0.5">Laporan di-hash & disimpan secara lokal dengan atestasi perangkat anti-backdate. Otomatis sinkronisasi saat terhubung internet.</p>
            </div>
          </div>
        )}

        {/* Quick Modal Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setIsCaptureOpen(true)}
            className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white p-3.5 rounded-2xl font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-sky-500/20 transition"
          >
            <Mic className="w-4 h-4 text-sky-100" />
            <span>Rekam Suara / Teks Modal</span>
          </button>

          <button
            onClick={() => setIsCaptureOpen(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 p-3.5 rounded-2xl font-semibold text-xs flex items-center justify-center space-x-1.5 border border-slate-200 transition"
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>Klarifikasi Minimal</span>
          </button>
        </div>

        {/* Active Obligations Section */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1.5 text-sky-600" />
              Tugas & Kewajiban Saya ({caregiverObs.length})
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Bitemporal Ledger</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {caregiverObs.map(ob => (
              <div key={ob.id} className="relative group">
                <ObligationGraphCard
                  obligation={ob}
                  currentUserRole="caregiver"
                  onOpenEvidenceModal={(o) => setSelectedObligationForEvidence(o)}
                  onOpenTraceModal={onOpenTraceModal}
                  onApproveAction={() => {}}
                />
                {/* Direct Vision Camera Button Shortcut (USABILITY #3) */}
                <button
                  onClick={() => setSelectedObligationForVision(ob)}
                  className="mt-2 w-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-teal-500/20 transition"
                >
                  <Camera className="w-3.5 h-3.5 text-teal-100" />
                  <span>📸 Scan Auto-OCR Kamera (Vision AI E1)</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Hands-Free Voice Microphone (USABILITY #1) */}
      <FloatingVoiceMic
        onCaptureSubmit={onCaptureSubmit}
        currentUser={currentUser}
      />

      {/* Capture Modal */}
      <CaregiverCaptureModal
        isOpen={isCaptureOpen}
        onClose={() => setIsCaptureOpen(false)}
        residents={residents}
        onCaptureSubmit={onCaptureSubmit}
        currentUser={currentUser}
      />

      {/* Evidence Upload Modal */}
      <EvidenceUploadModal
        isOpen={!!selectedObligationForEvidence}
        onClose={() => setSelectedObligationForEvidence(null)}
        obligation={selectedObligationForEvidence}
        onSubmitEvidence={onSubmitEvidence}
        currentUser={currentUser}
      />

      {/* Vision AI Camera OCR Modal */}
      <VisionCameraModal
        isOpen={!!selectedObligationForVision}
        onClose={() => setSelectedObligationForVision(null)}
        obligation={selectedObligationForVision}
        onSubmitEvidence={onSubmitEvidence}
        currentUser={currentUser}
      />
    </div>
  );
}
