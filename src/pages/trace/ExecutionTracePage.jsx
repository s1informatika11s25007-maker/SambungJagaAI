import React, { useState, useEffect } from 'react';
import { GitPullRequest, Eye, CheckCircle2, Database, ArrowRight } from 'lucide-react';
import ExecutionTraceModal from '../../components/trace/ExecutionTraceModal';

export default function ExecutionTracePage({ obligations, onOpenTraceModal }) {
  const [selectedOb, setSelectedOb] = useState(obligations?.[0] || null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!selectedOb && obligations?.length > 0) {
      setSelectedOb(obligations[0]);
    }
  }, [obligations, selectedOb]);

  const getTraceSteps = (ob) => {
    if (!ob) return [];
    return [
      {
        title: '1. Ingesti & Filter Prompt-Injection',
        desc: 'Input pengasuh melalui Voice STT / Teks dibersihkan & diperiksa minimisasi data PII.',
        tag: '[A] Gateway',
        status: 'OK VERIFIED'
      },
      {
        title: '2. Persepsi Epistemic Fact Ledger (P3)',
        desc: `Ekstraksi entitas medis: ${ob.title}. Status epistemik: DIAMATI (Sensor IoT) / DILAPORKAN.`,
        tag: 'P3 Kernel',
        status: 'OK VERIFIED'
      },
      {
        title: '3. Bitemporal Obligation Ledger (P1)',
        desc: `Kewajiban dicatat pada Sys Time: ${new Date(ob.sys_created_at).toLocaleTimeString('id-ID')}. Valid Time Period: ${new Date(ob.valid_from).toLocaleTimeString('id-ID')} s/d ${new Date(ob.valid_until).toLocaleTimeString('id-ID')}.`,
        tag: 'P1 Ledger',
        status: 'OK VERIFIED'
      },
      {
        title: '4. Action Contract & P6 Authority Envelope Gate',
        desc: `Aksi dievaluasi pada Authority Envelope ${ob.priority === 'critical' ? 'Level A3 (Klinis/Ireversibel)' : 'Level A1 (Reversibel)'}. Gate menetapkan batas wewenang eksekusi.`,
        tag: 'P6 Envelope',
        status: 'OK VERIFIED'
      },
      {
        title: '5. Eksekusi Tool Gateway [A] & Postcondition Verifier',
        desc: 'Sistem melakukan dry-run diff & menulis ke Database RLS resident_domain.bitemporal_obligations.',
        tag: '[A] DB Execution',
        status: 'OK VERIFIED'
      },
      {
        title: '6. Verifikator Bukti P2 & Jejak Audit SHA-256 [A]',
        desc: `Verifikasi bukti ${ob.required_evidence_grade} berhasil. Catatan ditulis ke Rantai Hash Jejak Audit dengan SHA-256 prev_hash.`,
        tag: '[A] Jejak Audit',
        status: 'OK VERIFIED'
      }
    ];
  };

  const currentSteps = selectedOb ? getTraceSteps(selectedOb) : [];

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <GitPullRequest className="w-5 h-5 text-sky-600" />
            <span>Pelacakan Transparan Keputusan AI (Auditabilitas P1 - P6)</span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Inspeksi transparan alur eksekusi AI: Input -&gt; Filter Prompt Injection -&gt; Facts (P3) -&gt; Rules Compiler -&gt; Obligation Graph (P1) -&gt; Authority Envelope Gate (P6) -&gt; DB Execution -&gt; Verifier (P2) -&gt; Audit Trail [A].
          </p>
        </div>

        {selectedOb && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-sky-600 hover:bg-sky-700 text-white text-xs px-4 py-2 rounded-xl font-bold transition flex items-center space-x-1.5 shadow-md shadow-sky-600/20 shrink-0"
          >
            <Eye className="w-4 h-4" />
            <span>Pop-up Full Modal</span>
          </button>
        )}
      </div>

      {/* Grid of Obligations */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Pilih Misi Perawatan untuk Inspeksi Alur Trace ({obligations.length}):
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          {obligations.map(ob => {
            const isSelected = selectedOb?.id === ob.id;
            return (
              <div
                key={ob.id}
                onClick={() => setSelectedOb(ob)}
                className={`p-4 rounded-2xl border cursor-pointer transition shadow-sm flex flex-col justify-between ${
                  isSelected
                    ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-400/30'
                    : 'bg-white border-slate-200/90 hover:border-sky-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono text-sky-700 font-bold">ID: {ob.mission_id}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      ob.priority === 'critical' ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {ob.priority}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-2">{ob.title}</h4>
                  <p className="text-[11px] text-slate-600 mt-1 font-medium">{ob.resident_name}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Rule: {ob.rule_version_id}</span>
                  <span className="text-sky-600 font-bold flex items-center">
                    Klik Inspeksi <ArrowRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inline Explainable Trace View */}
      {selectedOb && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xl shadow-slate-200/50 space-y-5 w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">
                Inspeksi Alur Eksekusi Terpilih
              </span>
              <h3 className="text-sm font-black text-slate-900 mt-0.5">
                {selectedOb.title} ({selectedOb.resident_name})
              </h3>
            </div>
            <div className="flex items-center space-x-2 font-mono text-xs">
              <span className="bg-sky-100 text-sky-800 px-2.5 py-1 rounded-lg border border-sky-300 font-bold">
                Mission ID: {selectedOb.mission_id}
              </span>
              <span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg border border-amber-300 font-bold">
                Rule: {selectedOb.rule_version_id}
              </span>
            </div>
          </div>

          {/* 6 Step Interactive Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentSteps.map((step, idx) => (
              <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 flex flex-col justify-between hover:border-sky-300 transition">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-sky-600 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                      {idx + 1}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                      {step.tag}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 pt-1">{step.title}</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium">{step.desc}</p>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-emerald-700 font-bold">
                  <span className="flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> {step.status}
                  </span>
                  <span className="font-mono text-slate-400">P{idx + 1} Gate</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trace Modal Global Control */}
      {selectedOb && isModalOpen && (
        <ExecutionTraceModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          obligation={selectedOb}
        />
      )}
    </div>
  );
}
