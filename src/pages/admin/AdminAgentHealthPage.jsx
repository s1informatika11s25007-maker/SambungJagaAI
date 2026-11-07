/**
 * SambungJaga AI — Admin Agent Health Monitor
 *
 * Displays Central Care Orchestrator Status across 8 Unified Agent Groups
 * Registry view only; distributed worker health requires server heartbeat telemetry.
 */

import React from 'react';
import { Cpu, CheckCircle2, Activity } from 'lucide-react';
import Badge from '../../components/common/Badge';
import { getAgentMeshHealthSnapshot } from '../../services/ai/agentMeshOrchestrator';

export default function AdminAgentHealthPage() {
  const snapshot = getAgentMeshHealthSnapshot();

  const UNIFIED_AGENT_GROUPS = [
    { id: '1', name: '1. Care Intake Agent', domain: 'Intake', desc: 'Laporan suara, teks, identifikasi lansia, dan fakta klinis' },
    { id: '2', name: '2. Care Workflow Agent', domain: 'Care', desc: 'Evaluasi aturan & pembentukan obligasi perawatan' },
    { id: '3', name: '3. Workforce Agent', domain: 'Workforce', desc: 'Penyesuaian kompetensi & penugasan caregiver' },
    { id: '4', name: '4. Evidence Agent', domain: 'Evidence', desc: 'Pengunggahan, validasi & verifikasi kepercayaan bukti' },
    { id: '5', name: '5. Supervisor Agent', domain: 'Supervisor', desc: 'Pemeriksaan laporan, pengaduan & persetujuan A3' },
    { id: '6', name: '6. Handover Agent', domain: 'Handover', desc: 'Kontinuitas serah terima shift dua sisi' },
    { id: '7', name: '7. Family Liaison Agent', domain: 'Family', desc: 'Penyampaian informasi PDP & permohonan keluarga' },
    { id: '8', name: '8. HR Operations Agent', domain: 'HR', desc: 'Manajemen shift, presensi & ketersediaan staf' }
  ];

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-sky-600" />
          <span>Central Care Orchestrator — Agent Health Monitor</span>
        </h2>
        <p className="text-xs text-slate-500">
          Registry agent pada proses aplikasi ini. Status worker/server lintas proses belum diverifikasi melalui heartbeat dan tidak diklaim ACTIVE di halaman ini.
        </p>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Status Orchestrator</span>
          <p className="text-lg font-black text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5" />
            <span>REGISTRY ONLY</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Sedang berjalan di proses ini</span>
          <p className="text-2xl font-black text-slate-900">{snapshot.activeCount} / {snapshot.totalAgents}</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Agen Degraded</span>
          <p className="text-2xl font-black text-amber-600">{snapshot.degradedCount}</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Circuit breaker terbuka</span>
          <p className="text-2xl font-black text-rose-600">{snapshot.failedCount}</p>
        </div>
      </div>

      {/* 8 Unified Agent Groups */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-600" />
          <span>8 Kelompok Agent Utama (Central Care Orchestrator)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {UNIFIED_AGENT_GROUPS.map((group) => (
            <div key={group.id} className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-slate-900">{group.name}</h4>
                <Badge variant="warning">BELUM DIVERIFIKASI</Badge>
              </div>
              <p className="text-xs text-slate-600">{group.desc}</p>
              <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-200/60">
                Domain: {group.domain} · Runtime health: belum tersedia
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
