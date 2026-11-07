/**
 * SambungJaga AI — Admin Queue Monitor & Server Scheduler Telemetry
 *
 * Displays real-time Durable Queue stats, Outbox status, DLQ tracking,
 * and explicitly labels data that is not backed by server heartbeat telemetry.
 */

import React, { useState, useEffect } from 'react';
import { Layers, AlertOctagon } from 'lucide-react';
import { getOutboxStats, fetchDeadLetterQueue } from '../../services/automation/eventBus';

export default function AdminQueueMonitorPage() {
  const [outboxStats, setOutboxStats] = useState(getOutboxStats());
  const [dlqItems, setDlqItems] = useState([]);
  const [dlqLoadState, setDlqLoadState] = useState('not_verified');

  useEffect(() => {
    let isMounted = true;
    const loadQueueData = async () => {
      setOutboxStats(getOutboxStats());
      const deadLetters = await fetchDeadLetterQueue();
      if (isMounted) { setDlqItems(deadLetters || []); setDlqLoadState('local_only'); }
    };
    loadQueueData();
    const timer = setInterval(loadQueueData, 10000);
    return () => { isMounted = false; clearInterval(timer); };
  }, []);

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-sky-600" />
          <span>Monitor Antrean Otomasi & Scheduler Server</span>
        </h2>
        <p className="text-xs text-slate-500">
          Tampilan ini memuat antrean proses UI dan DLQ yang dapat diakses. Status scheduler server baru dapat dinyatakan aktif setelah heartbeat backend tersedia.
        </p>
      </div>

      {/* Queue Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Outbox UI Process (lokal)</span>
          <p className="text-2xl font-black text-sky-700">{outboxStats.pendingCount || 0} Jobs</p>
          <span className="text-[11px] text-slate-500 block">Bukan total antrean server terdistribusi</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Dead-Letter Queue (DLQ)</span>
          <p className="text-2xl font-black text-rose-600">{dlqItems.length} Failed</p>
          <span className="text-[11px] text-slate-500 block">{dlqLoadState === 'local_only' ? 'Hanya item DLQ lokal yang tersedia' : 'Data DLQ belum diverifikasi'}</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Persistent Server Scheduler</span>
          <p className="text-base font-black text-amber-600 flex items-center gap-1.5">
            <AlertOctagon className="w-5 h-5" />
            <span>HEARTBEAT BELUM TERVERIFIKASI</span>
          </p>
          <span className="text-[11px] text-slate-500 block">Konfigurasi runtime harus diuji di server deployment</span>
        </div>
      </div>

      {/* Dead-Letter Queue Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-rose-600" />
          <span>Dead-Letter Queue (DLQ) Items</span>
        </h3>

        {dlqItems.length === 0 ? (
          <div className="p-6 bg-amber-50/60 border border-amber-200/80 rounded-xl text-center space-y-1">
            <AlertOctagon className="w-6 h-6 text-amber-600 mx-auto" />
            <p className="text-xs font-bold text-amber-900">Tidak ada data DLQ server yang terverifikasi pada tampilan ini.</p>
            <p className="text-[11px] text-amber-800">Jangan menafsirkan tampilan lokal kosong sebagai antrean server bersih.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">Fasilitas</th>
                  <th className="py-2.5 px-3">Penyebab Kegagalan</th>
                  <th className="py-2.5 px-3">Waktu Kejadian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dlqItems.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="py-3 px-3 font-semibold text-slate-900">{item.event_type}</td>
                    <td className="py-3 px-3 font-mono text-[11px]">{item.facility_id || '—'}</td>
                    <td className="py-3 px-3 text-rose-600 font-medium">{item.failure_reason || 'Unknown error'}</td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">{item.created_at || new Date().toISOString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
