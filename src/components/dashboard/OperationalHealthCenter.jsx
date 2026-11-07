import React, { useState, useEffect } from 'react';
import { Activity, Server, AlertTriangle, RefreshCw, CheckCircle2, ShieldAlert, Cpu } from 'lucide-react';
import { getSystemHealthOverview } from '../../services/monitoring/operationalHealthService';
import { processOutboxQueue, replayDeadLetterItem } from '../../services/automation/eventBus';
import { runSlaWatchdogSweep } from '../../services/automation/slaWatchdog';
import { runDataReconciliation } from '../../services/automation/dataReconciler';
import { runStuckProcessRecovery } from '../../services/automation/stuckProcessRecovery';

export default function OperationalHealthCenter({ isOpen, onClose }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const refreshHealth = async () => {
    setLoading(true);
    try {
      const data = await getSystemHealthOverview();
      setHealth(data);
    } catch (err) {
      console.warn('Failed to load operational health:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshHealth();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunRecovery = async () => {
    setLoading(true);
    setActionMessage('Menjalankan pemulihan otomatis...');
    try {
      await runStuckProcessRecovery();
      await runDataReconciliation();
      await runSlaWatchdogSweep({});
      await processOutboxQueue();
      setActionMessage('✅ Pemulihan & Rekonsiliasi Otomatis Sukses!');
      await refreshHealth();
    } catch (err) {
      setActionMessage(`❌ Gagal: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReplayDlq = async (dlqId) => {
    setLoading(true);
    try {
      await replayDeadLetterItem(dlqId);
      setActionMessage('✅ Item DLQ berhasil diputar ulang ke antrean!');
      await refreshHealth();
    } catch (err) {
      setActionMessage(`❌ Gagal memutar ulang DLQ: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto text-slate-100 p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Activity size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold font-mono tracking-tight">SambungJaga Operational Health Center</h2>
              <p className="text-xs text-slate-400">Pusat Pemantauan Mesin Otomasi Server & Agen AI Real-time</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition"
          >
            Tutup
          </button>
        </div>

        {/* Action Message Banner */}
        {actionMessage && (
          <div className="p-3 bg-indigo-950/80 border border-indigo-500/40 rounded-xl text-xs font-mono text-indigo-200">
            {actionMessage}
          </div>
        )}

        {/* System Overview Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-1">
            <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
              <span>Status Sistem</span>
              <Server size={14} />
            </div>
            <div className="text-lg font-bold font-mono flex items-center space-x-2">
              <span className={`w-2.5 h-2.5 rounded-full ${health?.status === 'HEALTHY' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className={health?.status === 'HEALTHY' ? 'text-emerald-400' : 'text-amber-400'}>
                {health?.status || 'HEALTHY'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Uptime: {health?.uptimeSeconds || 0}s | DB Latency: {health?.database?.latencyMs || 0}ms</span>
          </div>

          <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-1">
            <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
              <span>Agent Mesh AI</span>
              <Cpu size={14} />
            </div>
            <div className="text-lg font-bold font-mono text-indigo-400">
              {health?.agentMesh?.activeCount || 7} / {health?.agentMesh?.totalAgents || 7} Aktif
            </div>
            <span className="text-[10px] text-slate-400">Status Mesh: {health?.agentMesh?.overallStatus || 'HEALTHY'}</span>
          </div>

          <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-1">
            <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
              <span>Transactional Outbox</span>
              <RefreshCw size={14} />
            </div>
            <div className="text-lg font-bold font-mono text-blue-400">
              {health?.outboxQueue?.pending || 0} Pending
            </div>
            <span className="text-[10px] text-slate-400">Retrying: {health?.outboxQueue?.retrying || 0}</span>
          </div>

          <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-1">
            <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
              <span>Dead Letter Queue (DLQ)</span>
              <ShieldAlert size={14} />
            </div>
            <div className={`text-lg font-bold font-mono ${health?.deadLetterQueue?.count > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {health?.deadLetterQueue?.count || 0} Items
            </div>
            <span className="text-[10px] text-slate-400">Eror Eksekusi Terisolasi</span>
          </div>
        </div>

        {/* Agent Mesh Detailed Health Table */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold font-mono text-slate-300">Status Seluruh Agen AI dalam Mesh</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-800/80 text-slate-400 font-mono text-[11px] uppercase">
                <tr>
                  <th className="p-3">Nama Agen AI</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Total Eksekusi</th>
                  <th className="p-3">Latency Terakhir</th>
                  <th className="p-3">Circuit Breaker</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(health?.agentMesh?.agents || []).map((agent, i) => (
                  <tr key={i} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-medium text-slate-200">{agent.name}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${agent.state === 'success' || agent.state === 'idle' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
                        {agent.state}
                      </span>
                    </td>
                    <td className="p-3 font-mono">{agent.successfulExecutions} / {agent.totalExecutions}</td>
                    <td className="p-3 font-mono text-slate-400">{agent.lastExecutionTimeMs}ms</td>
                    <td className="p-3 font-mono">{agent.circuitOpen ? '❌ OPEN' : '✅ CLOSED'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* DLQ Management Table */}
        {health?.deadLetterQueue?.items?.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold font-mono text-rose-400 flex items-center space-x-2">
              <AlertTriangle size={16} />
              <span>Daftar Eror Dead Letter Queue (DLQ) yang Memerlukan Tindakan</span>
            </h3>
            <div className="overflow-x-auto rounded-xl border border-rose-900/50 bg-rose-950/20 p-3 space-y-2">
              {health.deadLetterQueue.items.map((dlq, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 text-xs font-mono">
                  <div>
                    <span className="text-rose-300 font-bold">{dlq.event_type}</span>
                    <p className="text-[11px] text-slate-400">{dlq.failure_reason || 'Terjadi kesalahan eksekusi'}</p>
                  </div>
                  <button
                    onClick={() => handleReplayDlq(dlq.id)}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] transition"
                  >
                    Putar Ulang
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual Emergency Recovery Trigger */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <button
            onClick={refreshHealth}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono flex items-center space-x-2 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Health Data</span>
          </button>

          <button
            onClick={handleRunRecovery}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs font-mono flex items-center space-x-2 transition shadow-lg shadow-emerald-900/40"
          >
            <CheckCircle2 size={14} />
            <span>Jalankan Rekonsiliasi & Pemulihan Darurat</span>
          </button>
        </div>
      </div>
    </div>
  );
}
