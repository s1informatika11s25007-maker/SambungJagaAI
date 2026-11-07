import React, { useEffect } from 'react';
import {
  X,
  ArrowDown,
  ShieldCheck,
  Lock,
  CheckCircle2,
  GitCommit,
  Cpu,
  Database,
  Smartphone,
  Users,
  FileCheck
} from 'lucide-react';

export default function ArchitectureModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const title = "SambungJaga AI — Care Superagent Architecture (Obligation Kernel, versi final)";
  const subtitle = "Evidence-Verified Care Continuity: dari laporan pengasuh menjadi kewajiban yang terlacak, ditindaklanjuti, dan diverifikasi";
  const sha256 = "d6506a84281d93e8507c11e762aaf0beb7dba593";

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl max-w-7xl w-full max-h-[94vh] flex flex-col overflow-hidden text-slate-100 font-sans"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950 shrink-0">
          <div className="space-y-1 text-left">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] font-mono font-bold">
                Spesifikasi Diagram Alur 100% (Draw.io Lossless)
              </span>
              <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                SHA256: {sha256.substring(0, 16)}...
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight text-white">
              {title}
            </h3>
            <p className="text-xs text-sky-300 font-medium">
              {subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Modal Arsitektur"
            className="p-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition focus:outline-none shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Diagram Canvas Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left scrollbar-thin scrollbar-thumb-slate-700">

          {/* MAIN DRAW.IO ARCHITECTURE CANVAS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* LEFT / CENTER COLUMN (8 COLS): MAIN EXECUTION PIPELINE (LAYER 0 - 7) */}
            <div className="lg:col-span-8 space-y-5">

              {/* LAYER 0: AKTOR */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-blue-500/40 bg-blue-950/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-blue-400 uppercase tracking-wider flex items-center">
                    <Users className="w-4 h-4 mr-1.5 text-blue-400" /> AKTOR
                  </span>
                  <span className="text-[10px] font-mono text-blue-300 bg-blue-900/50 px-2 py-0.5 rounded border border-blue-700">Layer 0</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-center text-xs">
                  <div className="bg-blue-900/40 border border-blue-700/60 p-2.5 rounded-xl font-bold text-blue-100">
                    Pengasuh<br/><span className="text-[9px] font-normal text-blue-300">(Suara, Teks, WA)</span>
                  </div>
                  <div className="bg-blue-900/40 border border-blue-700/60 p-2.5 rounded-xl font-bold text-blue-100 flex items-center justify-center">
                    Supervisor
                  </div>
                  <div className="bg-blue-900/40 border border-blue-700/60 p-2.5 rounded-xl font-bold text-blue-100">
                    Keluarga<br/><span className="text-[9px] font-normal text-blue-300">(Sesuai Izin)</span>
                  </div>
                  <div className="bg-blue-900/40 border border-blue-700/60 p-2.5 rounded-xl font-bold text-blue-100">
                    Mobile PWA<br/><span className="text-[9px] font-normal text-blue-300">(Offline-First)</span>
                  </div>
                  <div className="bg-blue-900/40 border border-blue-700/60 p-2.5 rounded-xl font-bold text-blue-100 flex items-center justify-center">
                    Admin / HR
                  </div>
                </div>
              </div>

              <div className="flex justify-center my-1 text-slate-500">
                <ArrowDown className="w-5 h-5 animate-bounce text-sky-400" />
              </div>

              {/* LAYER 1: AKSES DAN INGESTI */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-purple-500/40 bg-purple-950/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-purple-400 uppercase tracking-wider flex items-center">
                    <Smartphone className="w-4 h-4 mr-1.5 text-purple-400" /> 1 · AKSES DAN INGESTI (Offline-First, Konteks Indonesia)
                  </span>
                  <span className="text-[10px] font-mono text-purple-300 bg-purple-900/50 px-2 py-0.5 rounded border border-purple-700">Layer 1</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <div className="bg-purple-900/40 border border-purple-700/60 p-2.5 rounded-xl font-semibold text-purple-100">
                    Identity, RBAC & Consent Gateway <strong className="text-amber-400 font-mono">[A]</strong>
                  </div>
                  <div className="bg-purple-900/40 border border-purple-700/60 p-2.5 rounded-xl font-semibold text-purple-100">
                    Kanal Capture: Voice STT, Teks, WhatsApp
                  </div>
                  <div className="bg-purple-950 border-2 border-purple-400 p-2.5 rounded-xl font-bold text-purple-100 shadow-md">
                    P5 · Offline Hash-Chain Ledger <span className="text-[9px] block text-purple-300 font-normal">(Atestasi Perangkat, Anti-Backdate)</span>
                  </div>
                  <div className="bg-purple-900/40 border border-purple-700/60 p-2.5 rounded-xl font-semibold text-purple-100">
                    Event Gateway & Durable Queue <span className="text-[9px] block text-purple-300 font-normal">(Idempotency Key)</span>
                  </div>
                  <div className="bg-purple-900/40 border border-purple-700/60 p-2.5 rounded-xl font-semibold text-purple-100 sm:col-span-2">
                    Filter Prompt-Injection & PII Minimisasi Data
                  </div>
                </div>
              </div>

              <div className="flex justify-center my-1 text-slate-500">
                <ArrowDown className="w-5 h-5 animate-bounce text-emerald-400" />
              </div>

              {/* LAYER 2: PERSEPSI DAN PENGETAHUAN */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-950/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-emerald-400 uppercase tracking-wider flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-400" /> 2 · PERSEPSI DAN PENGETAHUAN (P3 Epistemic Fact Ledger)
                  </span>
                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-900/50 px-2 py-0.5 rounded border border-emerald-700">Layer 2</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <div className="bg-emerald-900/40 border border-emerald-700/60 p-2.5 rounded-xl font-semibold text-emerald-100">
                    Rule & Policy Library <span className="text-[9px] block text-emerald-300 font-normal">(Berversi, Human Approved)</span>
                  </div>
                  <div className="bg-emerald-950 border-2 border-emerald-400 p-2.5 rounded-xl font-bold text-emerald-100 sm:col-span-2 shadow-md">
                    P3 · Epistemic Fact Ledger
                    <span className="text-[10px] block text-emerald-300 font-normal mt-0.5">
                      (Diamati / Dilaporkan / Disimpulkan / Dikontradiksi / Basi)
                    </span>
                  </div>
                  <div className="bg-emerald-900/40 border border-emerald-700/60 p-2.5 rounded-xl font-semibold text-emerald-100">
                    Resident Context & Provenance Engine
                  </div>
                  <div className="bg-emerald-900/40 border border-emerald-700/60 p-2.5 rounded-xl font-semibold text-emerald-100">
                    Minimal-Question Clarification <span className="text-[9px] block text-emerald-300 font-normal">(1 pertanyaan terinformasi)</span>
                  </div>
                  <div className="bg-emerald-900/40 border border-emerald-700/60 p-2.5 rounded-xl font-semibold text-emerald-100">
                    Perception & Structured Extraction
                  </div>
                </div>
              </div>

              <div className="flex justify-center my-1 text-slate-500">
                <ArrowDown className="w-5 h-5 animate-bounce text-amber-400" />
              </div>

              {/* LAYER 3: OBLIGATION KERNEL */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-amber-500/40 bg-amber-950/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-amber-400 uppercase tracking-wider flex items-center">
                    <GitCommit className="w-4 h-4 mr-1.5 text-amber-400" /> 3 · OBLIGATION KERNEL (P1) — Inovasi Inti
                  </span>
                  <span className="text-[10px] font-mono text-amber-300 bg-amber-900/50 px-2 py-0.5 rounded border border-amber-700">Layer 3</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <div className="bg-amber-900/40 border border-amber-700/60 p-2.5 rounded-xl font-semibold text-amber-100">
                    Temporal Rules Compiler
                  </div>
                  <div className="bg-amber-950 border-2 border-amber-400 p-2.5 rounded-xl font-bold text-amber-100 shadow-md">
                    P1 · Bitemporal Obligation Ledger
                    <span className="text-[9px] block text-amber-300 font-normal">(Valid Time vs Transaction Time)</span>
                  </div>
                  <div className="bg-amber-950 border-2 border-amber-400 p-2.5 rounded-xl font-bold text-amber-100 shadow-md">
                    Care Obligation Graph
                    <span className="text-[9px] block text-amber-300 font-normal">(kejadian, aturan, kewajiban, bukti)</span>
                  </div>
                  <div className="bg-amber-900/40 border border-amber-700/60 p-2.5 rounded-xl font-semibold text-amber-100">
                    Negative-Obligation & Precondition Checker
                  </div>
                  <div className="bg-amber-900/40 border border-amber-700/60 p-2.5 rounded-xl font-semibold text-amber-100">
                    Cascade & Care Debt Detector
                  </div>
                  <div className="bg-amber-900/40 border border-amber-700/60 p-2.5 rounded-xl font-semibold text-amber-100">
                    Expected-but-Absent Obligation Detector
                  </div>
                </div>
              </div>

              <div className="flex justify-center my-1 text-slate-500">
                <ArrowDown className="w-5 h-5 animate-bounce text-rose-400" />
              </div>

              {/* LAYER 4: SUPERAGENT ORCHESTRATION & AUTHORITY ENVELOPE */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-rose-500/40 bg-rose-950/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-rose-400 uppercase tracking-wider flex items-center">
                    <Cpu className="w-4 h-4 mr-1.5 text-rose-400" /> 4 · SUPERAGENT: Care Mission Orchestrator + Authority Envelope (P6)
                  </span>
                  <span className="text-[10px] font-mono text-rose-300 bg-rose-900/50 px-2 py-0.5 rounded border border-rose-700">Layer 4</span>
                </div>

                <div className="space-y-2">
                  <div className="bg-rose-950 border-2 border-rose-400 p-3 rounded-xl font-bold text-rose-100 text-center shadow-md">
                    CARE MISSION ORCHESTRATOR (Agen Induk)
                    <span className="text-[10px] block text-rose-300 font-normal mt-0.5">
                      1 Mission ID • 1 State • 1 Audit Trail — Mencegah konflik kewajiban terbuka antar agen
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5 text-center text-[10px]">
                    <div className="bg-rose-900/40 border border-rose-700/60 p-2 rounded-lg font-bold text-rose-200">Care Capture Agent</div>
                    <div className="bg-rose-900/40 border border-rose-700/60 p-2 rounded-lg font-bold text-rose-200">Handover Contract Agent</div>
                    <div className="bg-rose-900/40 border border-rose-700/60 p-2 rounded-lg font-bold text-rose-200">Cross-Shift Investigation</div>
                    <div className="bg-rose-900/40 border border-rose-700/60 p-2 rounded-lg font-bold text-rose-200">Autonomous Recovery Agent</div>
                    <div className="bg-rose-900/40 border border-rose-700/60 p-2 rounded-lg font-bold text-rose-200">Competency Coverage Agent</div>
                    <div className="bg-rose-900/40 border border-rose-700/60 p-2 rounded-lg font-bold text-rose-200">Consent Disclosure Agent</div>
                  </div>

                  <div className="bg-rose-950 border-2 border-rose-400 p-2.5 rounded-xl font-bold text-rose-100 text-xs text-center">
                    ACTION CONTRACT BUILDER → P6 AUTHORITY ENVELOPE (A0–A3) & POLICY GATE → TOOL REGISTRY <strong className="text-amber-400 font-mono">[A]</strong>
                  </div>
                </div>
              </div>

              <div className="flex justify-center my-1 text-slate-500">
                <ArrowDown className="w-5 h-5 animate-bounce text-orange-400" />
              </div>

              {/* LAYER 5: EKSEKUSI TERKONTROL */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-orange-500/40 bg-orange-950/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-orange-400 uppercase tracking-wider flex items-center">
                    <Database className="w-4 h-4 mr-1.5 text-orange-400" /> 5 · EKSEKUSI TERKONTROL
                  </span>
                  <span className="text-[10px] font-mono text-orange-300 bg-orange-900/50 px-2 py-0.5 rounded border border-orange-700">Layer 5</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <div className="bg-orange-900/40 border border-orange-700/60 p-2.5 rounded-xl font-semibold text-orange-100">
                    Signed Evidence Storage <span className="text-[9px] block text-orange-300 font-normal">(Foto privasi tanpa wajah, QR)</span>
                  </div>
                  <div className="bg-orange-900/40 border border-orange-700/60 p-2.5 rounded-xl font-semibold text-orange-100">
                    Supabase PostgreSQL <span className="text-[9px] block text-orange-300 font-normal">(RLS; Skema Resident & HR terpisah)</span>
                  </div>
                  <div className="bg-orange-900/40 border border-orange-700/60 p-2.5 rounded-xl font-semibold text-orange-100">
                    Tool Execution Gateway <strong className="text-amber-400 font-mono">[A]</strong> <span className="text-[9px] block text-orange-300 font-normal">(Idempotent dry-run diff)</span>
                  </div>
                  <div className="bg-orange-900/40 border border-orange-700/60 p-2.5 rounded-xl font-semibold text-orange-100 sm:col-span-2">
                    Notification, Task & Scheduling Services
                  </div>
                  <div className="bg-orange-900/40 border border-orange-700/60 p-2.5 rounded-xl font-semibold text-orange-100">
                    Integrasi WhatsApp API
                  </div>
                </div>
              </div>

              <div className="flex justify-center my-1 text-slate-500">
                <ArrowDown className="w-5 h-5 animate-bounce text-sky-400" />
              </div>

              {/* LAYER 6: VERIFIKASI BUKTI (P2) DAN PENUTUPAN MISI */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-sky-500/40 bg-sky-950/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-sky-400 uppercase tracking-wider flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-1.5 text-sky-400" /> 6 · VERIFIKASI BUKTI (P2) DAN PENUTUPAN MISI
                  </span>
                  <span className="text-[10px] font-mono text-sky-300 bg-sky-900/50 px-2 py-0.5 rounded border border-sky-700">Layer 6</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <div className="bg-sky-900/40 border border-sky-700/60 p-2.5 rounded-xl font-semibold text-sky-100">
                    Caregiver Evidence Upload <span className="text-[9px] block text-sky-300 font-normal">(foto, QR, dual signoff)</span>
                  </div>
                  <div className="bg-sky-950 border-2 border-sky-400 p-2.5 rounded-xl font-bold text-sky-100 shadow-md">
                    P2 · Evidence-Grade Verifier <strong className="text-amber-400 font-mono">[A]</strong>
                    <span className="text-[9px] block text-sky-300 font-normal mt-0.5">(E0 Klaim • E1 Artefak • E2 Orang Kedua • E3 Sensor)</span>
                  </div>
                  <div className="bg-sky-950 border-2 border-sky-400 p-2.5 rounded-xl font-bold text-sky-100 shadow-md">
                    Spot Challenge Engine
                    <span className="text-[9px] block text-sky-300 font-normal mt-0.5">(sampel acak & verifikasi ulang)</span>
                  </div>
                  <div className="bg-sky-900/40 border border-sky-700/60 p-2.5 rounded-xl font-semibold text-sky-100 sm:col-span-3">
                    Postcondition Verifier <strong className="text-amber-400 font-mono">[A]</strong> → EVALUASI MISI:
                    <span className="font-bold text-emerald-400 ml-2">Verified Closure</span> •
                    <span className="font-bold text-amber-400 ml-2">Recovery & Eskalasi [A]</span> •
                    <span className="font-bold text-sky-400 ml-2">Human Review</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center my-1 text-slate-500">
                <ArrowDown className="w-5 h-5 animate-bounce text-slate-400" />
              </div>

              {/* LAYER 7: PLATFORM AUDIT & KEAMANAN */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-slate-600 bg-slate-950 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-slate-300 uppercase tracking-wider flex items-center">
                    <Lock className="w-4 h-4 mr-1.5 text-slate-400" /> 7 · PLATFORM: AUDIT, OBSERVABILITAS, KEAMANAN
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Layer 7</span>
                </div>

                <div className="bg-slate-900 border-2 border-slate-500 p-3 rounded-xl font-bold text-slate-100 text-xs shadow-md">
                  Append-Only Hash-Chained Audit Trail <strong className="text-amber-400 font-mono">[A]</strong>
                  <span className="text-[10px] block text-slate-400 font-normal mt-0.5">
                    (Pencatan rantai SHA-256 immutable untuk semua gerbang, eksekusi tool, verifier, penolakan, dan keputusan manusia)
                  </span>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN (4 COLS): ASYNCHRONOUS LAB (LAYER 8) + OUTPUTS (LAYER 9) + LEGENDA */}
            <div className="lg:col-span-4 space-y-5">

              {/* LEGENDA DAN PRINSIP KUNCI BOX */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-xl">
                <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-black text-sky-400 uppercase tracking-wider">Legenda & Prinsip Sistem</h4>
                </div>

                <div className="text-[11px] text-slate-300 space-y-2 leading-relaxed font-medium">
                  <p><strong className="text-amber-400 font-mono">[A]</strong> = Menulis ke Append-Only Audit Trail SHA-256</p>
                  <p><strong className="text-sky-400 font-mono">P1–P6</strong> = Enam Inovasi Kernel Utama Sistem</p>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-[10px] space-y-1.5 text-slate-300">
                    <span className="font-bold text-emerald-400 block uppercase">Prinsip Aksiologi Inti:</span>
                    <p>• AI tidak pernah menutup kewajiban tanpa bukti fisik sesuai tingkat risiko.</p>
                    <p>• Decision A3 & penerimaan SDM tetap kedaulatan manusia.</p>
                    <p>• Larangan medis ditegakkan oleh Policy Gate backend, bukan prompt.</p>
                  </div>
                </div>
              </div>

              {/* LAYER 8: ANALISIS DAN JAMINAN (P4) ASINKRON */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-pink-500/40 bg-pink-950/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-pink-400 uppercase tracking-wider flex items-center">
                    <Cpu className="w-4 h-4 mr-1.5 text-pink-400" /> 8 · ANALISIS & JAMINAN (P4 Asinkron)
                  </span>
                  <span className="text-[10px] font-mono text-pink-300 bg-pink-900/50 px-2 py-0.5 rounded border border-pink-700">Layer 8</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="bg-pink-950 border-2 border-pink-400 p-2.5 rounded-xl font-bold text-pink-100 shadow-md">
                    P4 · Failure-Set Search Simulator
                    <span className="text-[9px] block text-pink-300 font-normal mt-0.5">(Kombinasi kegagalan terkecil)</span>
                  </div>
                  <div className="bg-pink-900/40 border border-pink-700/60 p-2 rounded-xl text-pink-200">
                    Competency Gap Report → Ekspor HR/ATS
                  </div>
                  <div className="bg-pink-900/40 border border-pink-700/60 p-2 rounded-xl text-pink-200">
                    Retroactive Rule Replay (Putar ulang N hari)
                  </div>
                  <div className="bg-pink-900/40 border border-pink-700/60 p-2 rounded-xl text-pink-200">
                    Agent Replay, Benchmark & Adversarial Lab
                  </div>
                </div>
              </div>

              {/* LAYER 9: KELUARAN, SERAH TERIMA, DAN BUKTI */}
              <div className="p-4 rounded-2xl border-2 border-dashed border-indigo-500/40 bg-indigo-950/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-indigo-400 uppercase tracking-wider flex items-center">
                    <FileCheck className="w-4 h-4 mr-1.5 text-indigo-400" /> 9 · KELUARAN, SERAH TERIMA & BUKTI
                  </span>
                  <span className="text-[10px] font-mono text-indigo-300 bg-indigo-900/50 px-2 py-0.5 rounded border border-indigo-700">Layer 9</span>
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="bg-indigo-900/40 border border-indigo-700/60 p-2.5 rounded-xl font-semibold text-indigo-100">
                    Two-Sided Handover Contract <span className="text-[9px] block text-indigo-300 font-normal">(Konfirmasi dua belah pihak)</span>
                  </div>
                  <div className="bg-indigo-900/40 border border-indigo-700/60 p-2.5 rounded-xl font-semibold text-indigo-100">
                    Realtime Supervisor Dashboard
                  </div>
                  <div className="bg-indigo-900/40 border border-indigo-700/60 p-2.5 rounded-xl font-semibold text-indigo-100">
                    Consent Output Filter & Family Portal
                  </div>
                  <div className="bg-indigo-900/40 border border-indigo-700/60 p-2.5 rounded-xl font-semibold text-indigo-100">
                    Explainable Execution Trace Viewer
                  </div>
                  <div className="bg-indigo-900/40 border border-indigo-700/60 p-2.5 rounded-xl font-bold text-sky-300">
                    Care Evidence Pack (.json ekspor audit)
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-medium">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Format: Draw.io Lossless Architecture Diagram • 100% Validated</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md shadow-sky-600/20 transition"
          >
            Tutup Diagram Alur
          </button>
        </div>

      </div>
    </div>
  );
}
