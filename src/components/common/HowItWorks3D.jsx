import React, { useState, useEffect } from 'react';
import {
  MessageSquareText,
  Cpu,
  ClipboardCheck,
  Upload,
  ShieldCheck,
  UserCheck,
  Lock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Zap,
  Play,
  Pause,
  ArrowRight,
  X,
  User,
  Shield,
  Smartphone,
  Layers,
  FileCheck2
} from 'lucide-react';

const workflowNodes = [
  {
    step: '01',
    role: 'Caregiver (Pengasuh)',
    roleIcon: User,
    feature: 'Ruang Kerja Pengasuh / Care Capture',
    featureIcon: Smartphone,
    title: '1. Membuat Laporan',
    detail: 'Aplikasi mencocokkan identitas penghuni secara deterministik.',
    badge: 'Deterministic ID Match',
    badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    pipeline: 'Input Teks/Suara → L0 Deterministic ID Matcher',
    saran: 'Pilih nama/kamar lansia. Sistem mencocokkan data secara 100% akurat tanpa risiko tertukar.',
    mascotQuote: 'Saya bantu mencocokkan laporan Anda ke lansia yang tepat secara 100% deterministik!'
  },
  {
    step: '02',
    role: 'Asisten AI & Caregiver',
    roleIcon: Cpu,
    feature: 'AI Note Compiler & Pipeline',
    featureIcon: Cpu,
    title: '2. Menyusun Catatan AI',
    detail: 'Gemini Nano digunakan jika tersedia. Jika tidak, jalur cloud menjalankan Llama Prompt Guard 2 → Qwen 3.8 → GPT-OSS Safeguard 20B.',
    badge: 'Gemini Nano / Cloud Hybrid',
    badgeStyle: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    pipeline: 'Gemini Nano (Lokal HP) ⚡ Cloud Fallback: Llama Guard 2 → Qwen 3.8 → GPT-OSS 20B',
    saran: 'Catat laporan secara alami. AI lokal memproses di HP, atau dialihkan ke pengaman cloud jika dibutuhkan.',
    mascotQuote: 'Gemini Nano memproses di HP Anda. Jika offline/terbatas, cloud safeguard siap melindungi!'
  },
  {
    step: '03',
    role: 'Sistem Kernel AI',
    roleIcon: Shield,
    feature: 'Atomic RPC Task Engine',
    featureIcon: Layers,
    title: '3. Membentuk Tugas',
    detail: 'Fakta dan usulan kewajiban dikirim melalui RPC dan baru dianggap tersimpan setelah server memberikan konfirmasi.',
    badge: 'Atomic RPC Acknowledgment',
    badgeStyle: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    pipeline: 'RPC Gateway → Bitemporal Kernel → Server Confirmation ACK',
    saran: 'Tugas resmi aktif setelah mendapat konfirmasi hijau dari server (Atomic RPC).',
    mascotQuote: 'Tugas perawatan hanya resmi tersimpan setelah server membalas konfirmasi RPC secara aman!'
  },
  {
    step: '04',
    role: 'Caregiver (Pengasuh)',
    roleIcon: User,
    feature: 'Penyimpanan Bukti privat',
    featureIcon: Upload,
    title: '4. Mengunggah Bukti',
    detail: 'Bukti disimpan di Supabase Storage privat.',
    badge: 'Supabase Private Storage',
    badgeStyle: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    pipeline: 'Foto/Bukti → Enkripsi SHA-256 → Supabase Storage Privat',
    saran: 'Unggah foto tindakan medis. File dienkripsi secara privat untuk menjaga privasi pasien.',
    mascotQuote: 'Foto bukti Anda dienkripsi dan disimpan di folder privat steril yang aman.'
  },
  {
    step: '05',
    role: 'Supervisor Klinis',
    roleIcon: ShieldCheck,
    feature: 'Pusat Supervisor (Review Queue)',
    featureIcon: ShieldCheck,
    title: '5. Verifikasi Supervisor',
    detail: 'AI dapat membantu pemeriksaan awal. Keputusan akhir tetap berada pada supervisor.',
    badge: 'Human-in-the-Loop',
    badgeStyle: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    pipeline: 'AI Initial Screening → Verifikasi & Otorisasi Manual Supervisor',
    saran: 'AI menandai laporan prioritas, namun persetujuan akhir 100% diputuskan oleh Supervisor.',
    mascotQuote: 'Saya menyaring anomali awal, tetapi keputusan klinis akhir 100% tetap di tangan Supervisor!'
  },
  {
    step: '06',
    role: 'Caregiver Shift (Pengirim & Penerima)',
    roleIcon: UserCheck,
    feature: 'Modul Serah Terima Shift (Handover)',
    featureIcon: UserCheck,
    title: '6. Menerima Handover',
    detail: 'GPT-OSS 120B membantu analisis ketika layanan tersedia. Pengirim dan penerima tetap mengonfirmasi secara terpisah.',
    badge: 'Two-Sided Handover Contract',
    badgeStyle: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    pipeline: 'GPT-OSS 120B Summary → Dual Signature (Caregiver Pengirim & Penerima)',
    saran: 'Periksa ringkasan AI, lalu perawat lama dan baru menandatangani konfirmasi secara terpisah.',
    mascotQuote: 'Informasi shift tidak pernah tercecer! Kedua perawat mengonfirmasi serah terima secara terpisah.'
  },
  {
    step: '07',
    role: 'Admin & Platform Keamanan',
    roleIcon: Lock,
    feature: 'Audit Trail Ledger',
    featureIcon: FileCheck2,
    title: '7. Pencatatan Audit Trail',
    detail: 'Proses penting dicatat agar dapat ditelusuri.',
    badge: 'Immutable SHA-256 Audit',
    badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    pipeline: 'Event Log → SHA-256 Hash Chain → Append-Only Ledger',
    saran: 'Seluruh riwayat tersimpan permanen di audit trail untuk transparansi & penelusuran.',
    mascotQuote: 'Seluruh aksi dicatat dalam rantai enkripsi SHA-256 append-only yang tidak bisa dimanipulasi!'
  }
];

export default function HowItWorks3DModal({ isOpen, onClose }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !isAutoPlaying) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % workflowNodes.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isOpen, isAutoPlaying]);

  if (!isOpen) return null;

  const currentNode = workflowNodes[activeIndex];
  const CurrentRoleIcon = currentNode.roleIcon;
  const CurrentFeatureIcon = currentNode.featureIcon;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-950 border border-teal-500/40 rounded-3xl shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-100 font-sans"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-teal-900/60 flex items-center justify-between gap-3 bg-slate-950 shrink-0">
          <div className="space-y-0.5 text-left">
            <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
              <Sparkles size={12} className="text-amber-400 animate-pulse" /> ALUR PANDUAN INTERAKTIF SAMBUNGJAGA AI
            </span>
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              Alur Cara Kerja SambungJaga AI (7 Langkah)
            </h3>
            <p className="text-xs text-teal-300 font-medium hidden sm:block">
              Peran Spesifik & Pemetaan Fitur Platform Laporan Perawatan Lansia
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Modal"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-left scrollbar-thin scrollbar-thumb-teal-800">

          {/* Top Control Strip */}
          <div className="flex items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono text-teal-300 font-bold">
                Langkah {activeIndex + 1} dari {workflowNodes.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 border border-slate-700 text-slate-200 hover:bg-teal-900/40 transition flex items-center gap-1"
              >
                {isAutoPlaying ? <Pause size={12} className="text-amber-400" /> : <Play size={12} className="text-teal-400" />}
                <span>{isAutoPlaying ? "Auto-Play On" : "Auto-Play Off"}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveIndex((prev) => (prev > 0 ? prev - 1 : workflowNodes.length - 1))}
                className="p-1 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setActiveIndex((prev) => (prev + 1) % workflowNodes.length)}
                className="p-1 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Draw.io Style Responsive Node Grid (7 Steps) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {workflowNodes.map((node, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={node.step}
                  type="button"
                  onClick={() => {
                    setActiveIndex(idx);
                    setIsAutoPlaying(false);
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between ${
                    isActive
                      ? 'bg-slate-900 border-teal-400 shadow-lg shadow-teal-500/20 ring-2 ring-teal-400/50 scale-[1.02]'
                      : 'bg-slate-900/60 border-slate-800 hover:border-teal-500/40 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                      isActive ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {node.step}
                    </span>
                    <span className="text-[9px] font-mono font-semibold text-teal-400 truncate max-w-[80px]">
                      {node.role.split(' ')[0]}
                    </span>
                  </div>

                  <h4 className={`text-xs font-extrabold leading-tight ${isActive ? 'text-white' : 'text-slate-300'}`}>
                    {node.title}
                  </h4>

                  <div className="mt-2 pt-1.5 border-t border-slate-800/80">
                    <span className={`text-[8px] font-mono font-semibold px-1.5 py-0.5 rounded border block truncate ${node.badgeStyle}`}>
                      {node.badge}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Node Inspector Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

            {/* Mascot Avatar & Tip (4 cols) */}
            <div className="lg:col-span-4 p-4 rounded-2xl bg-slate-900 border border-teal-500/30 shadow-lg flex flex-col items-center text-center space-y-3">
              <div className="relative w-36 h-36 rounded-2xl bg-slate-950/90 border border-teal-400/30 p-2.5 shadow-md flex items-center justify-center">
                <img
                  src="/mascot.png"
                  onError={(e) => { e.currentTarget.src = '/Friendly Futuristic Robot Mascot.png'; }}
                  alt="Maskot SambungJaga AI"
                  className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(20,184,166,0.3)] animate-sj-float"
                />
                <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-slate-950 border border-teal-500/40 text-[8px] font-bold text-emerald-400 shadow-sm whitespace-nowrap">
                  Maskot Asisten AI
                </span>
              </div>

              {/* Mascot Bubble */}
              <div className="w-full bg-slate-800/90 border border-teal-500/40 rounded-xl p-3 text-left relative">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-slate-800 border-t border-l border-teal-500/40 rotate-45" />
                <span className="text-[9px] font-mono font-bold text-amber-400 uppercase tracking-wider block mb-0.5">
                  Panduan Maskot • Langkah {currentNode.step}
                </span>
                <p className="text-xs text-teal-100 font-medium italic leading-relaxed">
                  "{currentNode.mascotQuote}"
                </p>
              </div>
            </div>

            {/* Role, Feature & Details Inspector (8 cols) */}
            <div className="lg:col-span-8 p-5 rounded-2xl bg-slate-900 border border-teal-500/30 shadow-lg space-y-3 text-left">
              {/* Role & Feature Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <CurrentRoleIcon size={16} className="text-teal-400 shrink-0" />
                  <div>
                    <span className="text-[9px] font-mono text-slate-400 uppercase block">Peran (Role)</span>
                    <strong className="text-xs text-slate-100">{currentNode.role}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <CurrentFeatureIcon size={16} className="text-amber-400 shrink-0" />
                  <div>
                    <span className="text-[9px] font-mono text-slate-400 uppercase block">Modul / Fitur</span>
                    <strong className="text-xs text-slate-100">{currentNode.feature}</strong>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <span>{currentNode.title}</span>
                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${currentNode.badgeStyle}`}>
                    {currentNode.badge}
                  </span>
                </h3>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {currentNode.detail}
                </p>
              </div>

              {/* Tech Pipeline */}
              <div className="p-2.5 rounded-xl bg-teal-950/50 border border-teal-800/50 text-[10px] font-mono text-teal-200 flex items-center gap-2">
                <Zap size={14} className="text-amber-400 shrink-0" />
                <div>
                  <strong className="text-teal-400 font-sans block">Alur Teknis:</strong>
                  <span>{currentNode.pipeline}</span>
                </div>
              </div>

              {/* Practical Advice */}
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-100 flex items-start gap-2">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-emerald-400 font-mono text-[10px] uppercase block">Saran Praktis Caregiver:</strong>
                  <span>{currentNode.saran}</span>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-teal-900/60 bg-slate-950 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            SambungJaga AI — Alur Perawatan Terintegrasi
          </span>

          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={() => setActiveIndex((prev) => (prev + 1) % workflowNodes.length)}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-md"
            >
              <span>Langkah Berikutnya</span>
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
