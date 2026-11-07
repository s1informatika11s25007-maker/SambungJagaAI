import React, { useState, useEffect } from 'react';
import { ShieldCheck, Check, X, RefreshCw, Cpu, Activity, Award, CheckCircle2 } from 'lucide-react';
import { fetchSupervisorIntelligenceDashboard, executeSupervisorDecision } from '../../services/caregiver/supervisorIntelligenceCenter';

export default function AutonomousSupervisorCenterModal({
  isOpen,
  onClose,
  obligations = [],
  residents = [],
  staff = []
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [notes, setNotes] = useState('');
  const [actionFeedback, setActionFeedback] = useState('');

  const refreshDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetchSupervisorIntelligenceDashboard({ obligations, residents, staff });
      setData(res);
      if (res.reviewQueue?.length > 0 && !selectedItem) {
        setSelectedItem(res.reviewQueue[0]);
      }
    } catch (err) {
      console.warn('Failed to load supervisor center dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshDashboard();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDecision = async (decision) => {
    if (!selectedItem || loading) return;

    setLoading(true);
    try {
      const res = await executeSupervisorDecision({
        reviewItem: selectedItem,
        decision, // 'APPROVED' | 'REJECTED'
        supervisorNotes: notes
      });

      setActionFeedback(`✅ ${res.message}`);
      setNotes('');
      setSelectedItem(null);
      await refreshDashboard();
    } catch (err) {
      setActionFeedback(`❌ Gagal: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto text-slate-100 p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-xl">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold font-mono tracking-tight">Autonomous Supervisor Intelligence Center</h2>
              <p className="text-xs text-slate-400">Pusat Keputusan Pengecualian &amp; Review Klinis Terpusat</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
          >
            Tutup
          </button>
        </div>

        {/* Feedback Banner */}
        {actionFeedback && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-xs font-mono text-emerald-200 flex items-center justify-between">
            <span>{actionFeedback}</span>
            <button onClick={() => setActionFeedback('')} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Clinical Overview Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-1">
            <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
              <span>Clinical Quality Index (CQI)</span>
              <Award size={14} />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">
              {data?.clinicalQuality?.clinicalQualityIndex || 95}% ({data?.clinicalQuality?.grade || 'EXCELLENT'})
            </div>
            <span className="text-[10px] text-slate-400">SLA Rate: {data?.clinicalQuality?.SLAComplianceRate || 100}%</span>
          </div>

          <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-1">
            <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
              <span>Assignment Quality Index</span>
              <Activity size={14} />
            </div>
            <div className="text-xl font-bold font-mono text-sky-400">
              {data?.assignmentQuality?.overallQualityScore || 92}% ({data?.assignmentQuality?.status || 'EXCELLENT'})
            </div>
            <span className="text-[10px] text-slate-400">Match Rate: {data?.assignmentQuality?.competencyMatchRate || 100}%</span>
          </div>

          <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-1">
            <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
              <span>Unified Review Inbox</span>
              <Cpu size={14} />
            </div>
            <div className="text-xl font-bold font-mono text-amber-400">
              {data?.pendingReviewCount || 0} Antrean Review
            </div>
            <span className="text-[10px] text-slate-400">Prioritas Klinis Terurut</span>
          </div>
        </div>

        {/* Main 2-Column Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Column 1: Unified Priority Review Inbox Queue List */}
          <div className="lg:col-span-5 space-y-3">
            <h3 className="text-sm font-bold font-mono text-slate-300">Unified Clinical Review Queue ({data?.pendingReviewCount || 0})</h3>
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {data?.reviewQueue?.length === 0 ? (
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-center text-xs text-slate-400 italic">
                  ✅ Tidak ada kasus pengecualian yang membutuhkan perhatian supervisor saat ini.
                </div>
              ) : (
                data?.reviewQueue?.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                      selectedItem?.id === item.id ? 'bg-sky-950/80 border-sky-500 shadow-md' : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{item.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        item.priority === 'emergency' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {item.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{item.subtitle}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 2: Selected Review Rationale & 1-Tap Decision Controls */}
          <div className="lg:col-span-7 space-y-4 bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
            {selectedItem ? (
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <span className="text-[10px] font-mono text-sky-400 uppercase">Tipe Pengecualian: {selectedItem.type}</span>
                  <h3 className="text-base font-bold text-slate-100">{selectedItem.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedItem.subtitle}</p>
                </div>

                {/* AI Rationale & Context Payload Box */}
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
                  <span className="font-mono text-xs font-bold text-slate-300 flex items-center">
                    <Cpu size={14} className="mr-1.5 text-sky-400" />
                    Rekomendasi &amp; Konteks AI Superagent
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    AI telah menganalisis fakta, tingkat bukti, dan sertifikasi. Kasus ini memerlukan pertimbangan profesional supervisor sebelum tindakan administratif dieksekusi.
                  </p>
                  <pre className="text-[10px] bg-slate-950 p-2 rounded border border-slate-800 font-mono text-slate-400 overflow-x-auto">
                    {JSON.stringify(selectedItem.payload, null, 2)}
                  </pre>
                </div>

                {/* Decision Form Notes */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-400">Catatan/Alasan Keputusan Supervisor (Opsional)</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Tuliskan catatan arahan klinis atau instruksi tindak lanjut..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-sky-500"
                  />
                </div>

                {/* 1-Tap Decision Buttons */}
                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    onClick={() => handleDecision('REJECTED')}
                    disabled={loading}
                    className="px-4 py-2 bg-rose-900/80 hover:bg-rose-800 border border-rose-700 text-rose-200 font-bold rounded-xl text-xs font-mono flex items-center space-x-1.5 transition"
                  >
                    <X size={14} />
                    <span>Tolak / Minta Tinjauan Ulang</span>
                  </button>

                  <button
                    onClick={() => handleDecision('APPROVED')}
                    disabled={loading}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs font-mono flex items-center space-x-1.5 transition shadow-lg shadow-emerald-900/40"
                  >
                    <Check size={14} />
                    <span>Setujui &amp; Eksekusi Konsekuensi</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <CheckCircle2 size={28} className="mx-auto text-slate-600" />
                <p>Pilih salah satu item antrean di sebelah kiri untuk meninjau konteks dan memberikan keputusan.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <button
            onClick={refreshDashboard}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono flex items-center space-x-2 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Review Queue</span>
          </button>
        </div>
      </div>
    </div>
  );
}
