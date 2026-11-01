import React, { useState } from 'react';
import { ShieldAlert, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { verifyAuditChainIntegrity } from '../../services/audit/auditTrailService';

export default function AuditTrailPage({ auditTrail = [] }) {
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const integrity = verifyAuditChainIntegrity(auditTrail);

  const handleExportEvidencePack = () => {
    const pack = {
      exportTimestamp: new Date().toISOString(),
      integrityStatus: integrity,
      auditTrail
    };
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SambungJaga-Audit-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloadSuccess(true);
    window.setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const statusClass = integrity.verified && integrity.valid
    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
    : integrity.verified && integrity.valid === false
      ? 'bg-rose-50 border-rose-200 text-rose-900'
      : 'bg-amber-50 border-amber-200 text-amber-950';

  return (
    <section className="w-full space-y-6">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-emerald-700" /> Audit Trail</h1>
          <p className="mt-1 text-xs text-slate-600">Jejak aksi sistem dan petugas. Hash SHA-256 dibuat oleh trigger database, bukan browser.</p>
        </div>
        <button onClick={handleExportEvidencePack} className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2">
          <Download className="w-4 h-4" /> Ekspor JSON
        </button>
      </header>

      <div className={`p-4 rounded-2xl border flex items-start gap-3 text-xs ${statusClass}`} role="status">
        {integrity.verified && integrity.valid ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
        <div>
          <p className="font-bold">{integrity.verified ? (integrity.valid ? 'Rantai referensi hash tersambung' : 'Ditemukan rantai yang terputus') : 'Verifikasi hash server belum lengkap'}</p>
          <p className="mt-1 text-[11px] opacity-90">{integrity.reason || `${integrity.totalRecords} entri dengan hash server tersedia.`}</p>
        </div>
      </div>

      {downloadSuccess && <div className="p-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs">File audit berhasil disiapkan.</div>}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs text-slate-800">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr><th className="px-4 py-3">Seq</th><th className="px-4 py-3">Gerbang</th><th className="px-4 py-3">Aksi</th><th className="px-4 py-3">Aktor</th><th className="px-4 py-3">Hash database</th><th className="px-4 py-3">Waktu</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditTrail.length ? auditTrail.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono">{entry.sequence_id ? `#${entry.sequence_id}` : 'Lokal'}</td>
                  <td className="px-4 py-3">{entry.gateway_tag}</td>
                  <td className="px-4 py-3 font-semibold">{entry.action_name}</td>
                  <td className="px-4 py-3">{entry.actor_name || 'Petugas'}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-slate-500 max-w-[220px] truncate">{entry.entry_hash || 'Menunggu sinkronisasi'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{entry.created_at ? new Date(entry.created_at).toLocaleString('id-ID') : '—'}</td>
                </tr>
              )) : <tr><td colSpan="6" className="px-4 py-12 text-center text-slate-500">Belum ada catatan audit di database.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
