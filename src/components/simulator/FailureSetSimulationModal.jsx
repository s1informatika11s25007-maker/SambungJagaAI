import React, { useState } from 'react';
import { Play, ShieldCheck, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { runFailureSetSimulation } from '../../services/simulator/failureSetSimulator';
import Modal from '../common/Modal';

export default function FailureSetSimulationModal({ isOpen, onClose, staff = [], obligations = [] }) {
  const [results, setResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleRunSimulation = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setError('');
    try {
      setResults(await runFailureSetSimulation(staff, obligations));
    } catch (err) {
      setResults(null);
      setError(err?.message || 'Analisis tidak dapat dijalankan.');
    } finally {
      setIsRunning(false);
    }
  };

  const isInsufficient = results?.status === 'insufficient_data';
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Analisis Cakupan Kompetensi">
      <div className="space-y-4 text-slate-900">
        <p className="text-xs leading-relaxed text-slate-600">
          Uji skenario absensi satu atau dua petugas terhadap tugas prioritas tinggi berdasarkan kompetensi yang tercatat. Ini alat bantu penjadwalan, bukan penilaian klinis atau jaminan keselamatan.
        </p>
        <button onClick={handleRunSimulation} disabled={isRunning} className="w-full rounded-xl bg-amber-600 px-4 py-3 text-xs font-bold text-white transition hover:bg-amber-700 disabled:opacity-50">
          <span className="inline-flex items-center justify-center gap-2">{isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{isRunning ? 'Menganalisis data aktif…' : 'Jalankan analisis skenario'}</span>
        </button>
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
        {results && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className={`rounded-xl border p-3 text-xs ${isInsufficient ? 'border-amber-200 bg-amber-50 text-amber-900' : results.minimalFailureSets.length ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
              <div className="mb-1 flex items-center gap-2 font-bold">{isInsufficient ? <Info size={15} /> : results.minimalFailureSets.length ? <AlertTriangle size={15} /> : <ShieldCheck size={15} />}{isInsufficient ? 'Data belum cukup' : results.minimalFailureSets.length ? 'Skenario perlu ditinjau' : 'Tidak ada celah pada model yang diuji'}</div>
              <p>{results.recommendation}</p>
              <p className="mt-2 text-[10px] opacity-80">Sumber: {results.source === 'server_analysis' ? 'Analisis server terverifikasi' : 'Analisis aturan lokal'} · Skenario diuji: {results.scenariosTested ?? '—'} · Tugas tanpa data kompetensi: {results.unassessableObligations ?? 0}</p>
            </div>
            {results.minimalFailureSets.map((set, index) => (
              <article key={`${set.size}-${index}`} className="rounded-xl border border-rose-200 bg-white p-3 text-xs">
                <div className="flex items-center justify-between gap-2"><strong>Skenario {index + 1} · {set.size} petugas tidak tersedia</strong><span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-800">{set.riskLevel}</span></div>
                <p className="mt-1 text-slate-600">Petugas: <strong className="text-slate-800">{set.absentStaff.join(', ')}</strong></p>
                <p className="mt-2 font-semibold text-slate-700">Tugas yang kehilangan cakupan kompetensi:</p>
                <ul className="mt-1 list-inside list-disc text-slate-600">{set.abandonedObligations.map((item) => <li key={item.id}>{item.title} ({item.resident_name || 'Penghuni'})</li>)}</ul>
              </article>
            ))}
            {results.limitations?.length > 0 && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] text-slate-600"><strong>Batas analisis</strong><ul className="mt-1 list-inside list-disc">{results.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>}
          </div>
        )}
      </div>
    </Modal>
  );
}
