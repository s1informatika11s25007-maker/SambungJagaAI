/**
 * SambungJaga AI — Workforce Continuity Management Page
 *
 * Dedicated Workforce Command Center displaying:
 * - Active caregiver roster & availability status
 * - Competency matching & certification expiration matrix
 * - Acuity-aware staffing ratio validator
 * - Attendance clock-in / clock-out logs
 * - Automated shift schedule draft engine
 */

import React, { useState } from 'react';
import { Users, Clock, Award, ShieldAlert, Calendar, CheckCircle2, UserCheck, AlertTriangle } from 'lucide-react';
import Badge from '../../components/common/Badge';
import { validateAcuityStaffingRatio, getTrainingComplianceMatrix, draftShiftRoster } from '../../services/ai/hrAutonomousAgent';

export default function WorkforcePage({ staff = [], residents = [], obligations = [] }) {
  const [draftResult, setDraftResult] = useState(null);

  const activeStaff = staff.filter(s => s.is_active !== false);
  const onDutyStaff = activeStaff.filter(s => s.shift_status === 'on_duty');
  const offDutyStaff = activeStaff.filter(s => s.shift_status === 'off_duty');
  const onLeaveStaff = activeStaff.filter(s => s.shift_status === 'on_leave');

  const staffingRatio = validateAcuityStaffingRatio(residents, activeStaff);
  const trainingMatrix = getTrainingComplianceMatrix(activeStaff);

  const handleDraftRoster = () => {
    const res = draftShiftRoster(activeStaff, residents);
    setDraftResult(res);
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-600" />
            <span>Workforce Continuity Management</span>
          </h2>
          <p className="text-xs text-slate-500">
            Ketersediaan caregiver, pemetaan kompetensi, rasio staffing berbasis beban kerja lansia, dan jadwal shift operasional.
          </p>
        </div>

        <button
          onClick={handleDraftRoster}
          className="bg-sky-600 hover:bg-sky-700 text-white text-xs px-4 py-2.5 rounded-xl font-bold transition flex items-center space-x-2 shadow-sm shadow-sky-600/20"
        >
          <Calendar className="w-4 h-4" />
          <span>Buat Draf Shift Otomatis</span>
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Total Perawat Aktif</span>
          <p className="text-2xl font-black text-slate-900">{activeStaff.length}</p>
          <span className="text-[11px] text-slate-500 block">Staf Terverifikasi</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Sedang Bertugas</span>
          <p className="text-2xl font-black text-emerald-600">{onDutyStaff.length}</p>
          <span className="text-[11px] text-emerald-600 block">On Duty Shift Ini</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Off Duty / Istirahat</span>
          <p className="text-2xl font-black text-slate-600">{offDutyStaff.length}</p>
          <span className="text-[11px] text-slate-500 block">Istirahat / Off Duty</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Cuti / Izin</span>
          <p className="text-2xl font-black text-amber-600">{onLeaveStaff.length}</p>
          <span className="text-[11px] text-amber-600 block">Status Cuti Disetujui</span>
        </div>
      </div>

      {/* Staffing Ratio Validator Alert */}
      <div className={`p-4 rounded-2xl border ${staffingRatio.isSafe ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' : 'bg-rose-50/80 border-rose-200 text-rose-950'}`}>
        <div className="flex items-start gap-3">
          {staffingRatio.isSafe ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider">Acuity-Aware Staffing Ratio Validation</h3>
            <p className="text-xs font-semibold mt-0.5">{staffingRatio.recommendation}</p>
            <div className="flex items-center gap-4 mt-2 text-[11px] font-medium opacity-80">
              <span>Perawat On Duty: <strong>{staffingRatio.caregiversOnDuty} orang</strong></span>
              <span>Poin Beban Lansia: <strong>{staffingRatio.totalAcuityPoints} poin</strong></span>
              <span>Poin / Perawat: <strong>{staffingRatio.ratioPerNurse}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Automatic Shift Roster Draft Result */}
      {draftResult && (
        <div className="bg-white border border-sky-200 rounded-2xl p-5 shadow-lg shadow-sky-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-sky-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-600" />
              <span>Rancangan Jadwal Shift Operasional ({draftResult.rosterDate})</span>
            </h3>
            <Badge variant="kernel">AI Workforce Draft</Badge>
          </div>
          <p className="text-xs text-slate-600">{draftResult.message}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-sky-50/60 border border-sky-100 rounded-xl space-y-2">
              <span className="font-bold text-sky-900 block">Shift Pagi (07:00 - 15:00)</span>
              <ul className="space-y-1">
                {(draftResult.shiftDistribution.pagi || []).map(p => (
                  <li key={p.id} className="text-slate-700 flex items-center justify-between">
                    <span>{p.full_name}</span>
                    <span className="text-[10px] text-slate-400">Pagi</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl space-y-2">
              <span className="font-bold text-amber-900 block">Shift Siang (15:00 - 23:00)</span>
              <ul className="space-y-1">
                {(draftResult.shiftDistribution.siang || []).map(p => (
                  <li key={p.id} className="text-slate-700 flex items-center justify-between">
                    <span>{p.full_name}</span>
                    <span className="text-[10px] text-slate-400">Siang</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="font-bold text-slate-900 block">Shift Malam (23:00 - 07:00)</span>
              <ul className="space-y-1">
                {(draftResult.shiftDistribution.malam || []).map(p => (
                  <li key={p.id} className="text-slate-700 flex items-center justify-between">
                    <span>{p.full_name}</span>
                    <span className="text-[10px] text-slate-400">Malam</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Staff Roster & Competency Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-sky-600" />
          <span>Daftar Staf, Shift & Kompetensi Terdaftar</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Nama Staf</th>
                <th className="py-2.5 px-3">Peran</th>
                <th className="py-2.5 px-3">Status Shift</th>
                <th className="py-2.5 px-3">Jam Kerja</th>
                <th className="py-2.5 px-3">Kompetensi Tervalidasi</th>
                <th className="py-2.5 px-3">Training Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeStaff.map((person) => {
                const train = trainingMatrix.find(t => t.staffId === person.id) || { complianceRate: 100, isCompliant: true };
                return (
                  <tr key={person.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 font-semibold text-slate-900">{person.full_name}</td>
                    <td className="py-3 px-3 font-medium capitalize text-slate-600">{person.role}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        person.shift_status === 'on_duty' ? 'bg-emerald-100 text-emerald-800' : person.shift_status === 'on_leave' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {person.shift_status === 'on_duty' ? 'On Duty' : person.shift_status === 'on_leave' ? 'Cuti' : 'Off Duty'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{person.shift_start || '07:00'} - {person.shift_end || '15:00'}</td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {(person.competencies || ['Elderly Care', 'Vital Signs']).map((comp, idx) => (
                          <span key={idx} className="bg-sky-50 text-sky-800 text-[10px] px-2 py-0.5 rounded border border-sky-200/60 font-medium">
                            {comp}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`font-bold ${train.isCompliant ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {train.complianceRate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
