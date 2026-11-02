import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  Heart,
  Plus,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Activity,
  UserCheck,
  Check,
  FileText,
  Users,
  FileSignature
} from 'lucide-react';
import ObligationGraphCard from '../../components/dashboard/ObligationGraphCard';
import CareDebtAlert from '../../components/dashboard/CareDebtAlert';
import EvidenceUploadModal from '../../components/caregiver/EvidenceUploadModal';
import Modal from '../../components/common/Modal';

// Administrative workflow templates only; clinical decisions remain with authorized staff.
const CLINICAL_PRESETS = [
  { title: 'Dokumentasikan observasi terjadwal', desc: 'Catat hasil observasi sesuai rencana perawatan yang telah disetujui fasilitas.', priority: 'routine', grade: 'E1' },
  { title: 'Tinjau perubahan kondisi bersama supervisor', desc: 'Teruskan laporan kepada supervisor untuk penilaian dan tindak lanjut oleh petugas berwenang.', priority: 'important', grade: 'E1' },
  { title: 'Verifikasi kelengkapan bukti tugas', desc: 'Periksa kecocokan bukti dengan kriteria tugas sebelum status dapat ditutup.', priority: 'important', grade: 'E2' },
  { title: 'Dokumentasikan serah terima shift', desc: 'Rangkum tugas terbuka, penanggung jawab, dan catatan yang perlu diketahui petugas berikutnya.', priority: 'routine', grade: 'E1' }
];

export default function SupervisorDashboardPage({
  obligations = [],
  residents = [],
  staff = [],
  currentUser,
  onSubmitEvidence,
  onApproveAction,
  onCreateObligation,
  onOpenTraceModal,
  setActiveTab,
  onRunAutopilot,
  autopilotPlan = []
}) {
  const [selectedObligationForEvidence, setSelectedObligationForEvidence] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTriageFilter, setSelectedTriageFilter] = useState('all'); // 'all', 'critical', 'important', 'routine'

  // Notification feedback
  const [dispatchNotification, setDispatchNotification] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newResidentId, setNewResidentId] = useState(residents[0]?.id || '');
  const [newCaregiverId, setNewCaregiverId] = useState(staff.filter(s => s.role === 'caregiver')[0]?.id || '');
  const [newPriority, setNewPriority] = useState('critical');
  const [newEvidenceGrade, setNewEvidenceGrade] = useState('E1');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (!newResidentId && residents[0]?.id) setNewResidentId(residents[0].id);
    if (!newCaregiverId && staff.find((person) => person.role === 'caregiver' && person.shift_status === 'on_duty')?.id) {
      setNewCaregiverId(staff.find((person) => person.role === 'caregiver' && person.shift_status === 'on_duty').id);
    }
  }, [residents, staff, newResidentId, newCaregiverId]);

  // Filter obligations based on Triage Selection
  const filteredObligations = obligations.filter(o => {
    if (selectedTriageFilter === 'critical') return o.priority === 'critical' || o.priority === 'emergency';
    if (selectedTriageFilter === 'important') return o.priority === 'important';
    if (selectedTriageFilter === 'routine') return o.priority === 'routine';
    return true;
  });

  // Priority tasks list
  const priorityTasks = filteredObligations
    .filter(o => o.status === 'open' || o.status === 'in_progress')
    .slice(0, 4)
    .map(o => ({
      id: o.id,
      title: o.title,
      resident: o.resident_name || 'Penghuni',
      priority: o.priority,
      time: new Date(o.valid_until || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      status: o.status === 'open' ? 'Menunggu' : 'Sedang Berlangsung',
      statusColor: o.status === 'open' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
    }));

  // Run the same database-backed Autopilot used by the global command center.
  const handleAutoDispatch = async () => {
    if (isDispatching) return;
    if (typeof onRunAutopilot !== 'function') {
      setDispatchNotification('Autopilot belum terhubung. Periksa konfigurasi workspace.');
      return;
    }
    setIsDispatching(true);
    setDispatchNotification('Memeriksa rencana dan menjalankan tindakan yang diizinkan…');
    try {
      const result = await onRunAutopilot();
      setDispatchNotification(result?.summary || 'Autopilot selesai. Periksa log eksekusi untuk detail.');
    } catch (error) {
      setDispatchNotification(error?.message || 'Autopilot gagal dijalankan. Tidak ada perubahan yang diklaim berhasil.');
    } finally {
      setIsDispatching(false);
      window.setTimeout(() => setDispatchNotification(''), 6500);
    }
  };

  // Apply Quick Clinical Preset
  const handleApplyPreset = (preset) => {
    setNewTitle(preset.title);
    setNewDesc(preset.desc);
    setNewPriority(preset.priority);
    setNewEvidenceGrade(preset.grade);
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    if (!newTitle.trim() || !newResidentId || isCreating) return;
    setIsCreating(true);
    setCreateError('');
    const resident = residents.find((item) => item.id === newResidentId);
    const caregiver = staff.find((item) => item.id === newCaregiverId);
    const outcome = await onCreateObligation({
      resident_id: newResidentId,
      resident_name: resident?.full_name || 'Penghuni',
      title: newTitle.trim(),
      description: newDesc,
      priority: newPriority,
      required_evidence_grade: newEvidenceGrade,
      assigned_caregiver_id: newCaregiverId || null,
      assigned_caregiver_name: caregiver?.full_name || null
    }, currentUser?.full_name || 'Supervisor');
    setIsCreating(false);
    if (!outcome?.success) {
      setCreateError(outcome?.error || 'Tugas belum tersimpan.');
      return;
    }
    setNewTitle(''); setNewDesc(''); setIsCreateOpen(false);
  };

  return (
    <div className="space-y-4 w-full text-left font-sans max-w-7xl mx-auto">

      {/* Care Debt & Cascade Detector Bar */}
      <CareDebtAlert obligations={obligations} />

      {/* DISPATCH NOTIFICATION TOAST */}
      {dispatchNotification && (
        <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md border border-emerald-500 text-xs font-bold flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span>{dispatchNotification}</span>
          </div>
          <button onClick={() => setDispatchNotification('')} className="text-white hover:text-emerald-100 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* CLINICAL TRIAGE FILTER BAR (Compact Viewport Optimized) */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-sky-600" />
          <h3 className="text-xs font-bold text-slate-900 tracking-tight">Triage Matriks Risiko Medis:</h3>
        </div>

        <div className="flex items-center space-x-1.5 flex-wrap gap-1">
          <button
            onClick={() => setSelectedTriageFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedTriageFilter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({obligations.length})
          </button>
          <button
            onClick={() => setSelectedTriageFilter('critical')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedTriageFilter === 'critical' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            Darurat ({obligations.filter(o => o.priority === 'critical' || o.priority === 'emergency').length})
          </button>
          <button
            onClick={() => setSelectedTriageFilter('important')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedTriageFilter === 'important' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            Urgent ({obligations.filter(o => o.priority === 'important').length})
          </button>
          <button
            onClick={() => setSelectedTriageFilter('routine')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedTriageFilter === 'routine' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Rutin ({obligations.filter(o => o.priority === 'routine').length})
          </button>
        </div>

        {/* 1-Click Auto Dispatch Button */}
        <button
          onClick={handleAutoDispatch}
          disabled={isDispatching || !(autopilotPlan?.length)}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm transition-all duration-200 flex items-center space-x-1.5 cursor-pointer ml-auto"
          title="Jalankan tindakan operasional yang tersedia berdasarkan rencana Autopilot"
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>{isDispatching ? 'Menjalankan…' : 'Jalankan Autopilot'}</span>
        </button>
      </div>

      {/* Main Grid: 7 Cols Left (Tugas Prioritas & Graph), 5 Cols Right (Otomasi Control Panel & Kondisi Penghuni) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full items-start">

        {/* Left Column (7 Cols): Compact Priority List & Obligation Graph */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-extrabold text-slate-900 tracking-tight uppercase">Tugas Prioritas Triage</h3>
                <span className="text-[10px] bg-sky-50 text-sky-700 font-bold px-2 py-0.5 rounded-full border border-sky-200">
                  {priorityTasks.length} Tugas
                </span>
              </div>

              <button
                onClick={() => setIsCreateOpen(true)}
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs px-3 py-1.5 rounded-xl font-bold transition flex items-center space-x-1 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Tugas</span>
              </button>
            </div>

            {/* List Items */}
            <div className="space-y-2.5">
              {priorityTasks.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">Tidak ada tugas aktif dalam kategori triage ini.</p>
              ) : (
                priorityTasks.map((t) => (
                  <div key={t.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between hover:bg-slate-100/70 transition">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="truncate">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{t.title}</h4>
                        <p className="text-[11px] text-slate-500">{t.resident}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-xs font-mono shrink-0 ml-2">
                      <span className="text-slate-500 font-semibold">{t.time}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${t.statusColor}`}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Care Obligation Graph Cards (Compact Scroll Container) */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Care Obligation Graph ({filteredObligations.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
              {filteredObligations.map(ob => (
                <ObligationGraphCard
                  key={ob.id}
                  obligation={ob}
                  currentUserRole="supervisor"
                  onOpenEvidenceModal={(o) => setSelectedObligationForEvidence(o)}
                  onOpenTraceModal={onOpenTraceModal}
                  onApproveAction={onApproveAction}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (5 Cols): Otomasi Control Panel & Kondisi Penghuni Cards */}
        <div className="lg:col-span-5 space-y-4">

          {/* Workforce Intelligence Agent (P0) — Absence Rebalancing Widget */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Workforce Intelligence Agent (P0)</h3>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                Shift & Capacity
              </span>
            </div>

            <p className="text-xs text-slate-600 font-normal leading-relaxed">
              Mempertimbangkan jadwal shift, absensi, kompetensi aktif, beban durasi/kompleksitas, tingkat perawatan lansia, serta ketersediaan perawat pengganti.
            </p>

            <button
              type="button"
              onClick={() => {
                const absentStaff = staff.find(s => s.role === 'caregiver');
                if (absentStaff && typeof onRunAutopilot === 'function') {
                  setDispatchNotification(`Workforce Agent mendeteksi kompetensi ${absentStaff.full_name} & mengalokasikan tugas ulang secara optimal.`);
                  onRunAutopilot();
                }
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Simulasi Absensi & Re-Alokasi Pengganti Otomatis</span>
            </button>
          </div>

          {/* Clean Otomasi Control Panel Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Otomasi Alokasi & Pengawasan</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab && setActiveTab('execution_trace')}
                className="text-[11px] text-sky-600 font-bold hover:underline cursor-pointer"
              >
                Log Sistem
              </button>
            </div>

            <p className="text-xs text-slate-600 font-normal leading-relaxed">
              Sistem memantau <strong className="text-slate-900">{obligations.filter(o => o.status === 'open' || o.status === 'in_progress').length} kewajiban aktif</strong> dan melakukan pencocokan kualifikasi perawat secara otomatis.
            </p>

            <button
              type="button"
              onClick={handleAutoDispatch}
              disabled={isDispatching || !(autopilotPlan?.length)}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{isDispatching ? 'Menjalankan Autopilot…' : 'Jalankan Autopilot'}</span>
            </button>
          </div>

          {/* Serah Terima Shift Agent Widget Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <FileSignature className="w-4 h-4 text-sky-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Serah Terima Shift Agent</h3>
              </div>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                Pagi ➔ Siang
              </span>
            </div>

            <p className="text-xs text-slate-600 font-normal leading-relaxed">
              Penjaminan keberlanjutan perawatan presisi: <strong>{obligations.filter(o => o.priority === 'critical' || o.priority === 'important').length} tugas kritis & urgent</strong> diserahterimakan dengan verifikasi kriptografis.
            </p>

            <button
              type="button"
              onClick={() => setActiveTab && setActiveTab('handover_contract')}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <span>Buka Workspace Handover Agent</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Kondisi Penghuni Interactive Summary Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Kondisi Penghuni</h3>
              <button
                type="button"
                onClick={() => setActiveTab && setActiveTab('family_portal')}
                className="text-[11px] text-sky-600 font-bold hover:underline cursor-pointer"
              >
                Detail
              </button>
            </div>

            <div className="space-y-2 text-xs font-semibold text-slate-700">
              <div
                onClick={() => setSelectedTriageFilter('routine')}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                  selectedTriageFilter === 'routine' ? 'bg-emerald-100 border-emerald-400 ring-1 ring-emerald-500/30' : 'bg-emerald-50/60 border-emerald-200 text-emerald-900 hover:bg-emerald-100/80'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Normal</span>
                </div>
                <span className="font-bold font-mono">{residents?.length || 0} Pasien</span>
              </div>

              <div
                onClick={() => setSelectedTriageFilter('important')}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                  selectedTriageFilter === 'important' ? 'bg-amber-100 border-amber-400 ring-1 ring-amber-500/30' : 'bg-amber-50/60 border-amber-200 text-amber-900 hover:bg-amber-100/80'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Perlu Perhatian (Urgent)</span>
                </div>
                <span className="font-bold font-mono">{obligations.filter(o => o.priority === 'important' && o.status !== 'verified_closed').length} Pasien</span>
              </div>

              <div
                onClick={() => setSelectedTriageFilter('critical')}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                  selectedTriageFilter === 'critical' ? 'bg-rose-100 border-rose-400 ring-1 ring-rose-500/30' : 'bg-rose-50/60 border-rose-200 text-rose-900 hover:bg-rose-100/80'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>Darurat (Critical)</span>
                </div>
                <span className="font-bold font-mono">{obligations.filter(o => (o.priority === 'critical' || o.priority === 'emergency') && o.status !== 'verified_closed').length} Pasien</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Modal Evidence */}
      <EvidenceUploadModal
        isOpen={!!selectedObligationForEvidence}
        onClose={() => setSelectedObligationForEvidence(null)}
        obligation={selectedObligationForEvidence}
        onSubmitEvidence={onSubmitEvidence}
        currentUser={currentUser}
      />

      {/* Modal Create Obligation */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Tambah Care Obligation Baru">
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-left">

          {/* Quick Presets Row */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Preset SOP Klinis Siap Pakai (1-Klik Auto Fill):</label>
            <div className="grid grid-cols-2 gap-2">
              {CLINICAL_PRESETS.map((p, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleApplyPreset(p)}
                  className="p-2.5 text-left bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 rounded-xl transition text-[11px] cursor-pointer"
                >
                  <p className="font-bold text-slate-900 truncate">{p.title}</p>
                  <p className="text-sky-700 font-mono text-[10px]">Grade {p.grade} • {p.priority}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 font-semibold mb-1">Penghuni / Pasien</label>
            <select
              value={newResidentId}
              onChange={(e) => setNewResidentId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium"
            >
              {residents.map(r => (
                <option key={r.id} value={r.id}>{r.full_name} ({r.room_number})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-600 font-semibold mb-1">Pengasuh yang Ditugaskan (Caregiver)</label>
            <select
              value={newCaregiverId}
              onChange={(e) => setNewCaregiverId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium"
            >
              {staff.filter(s => s.role === 'caregiver').map(s => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-600 font-semibold mb-1">Judul Kewajiban Perawatan</label>
            <input
              type="text"
              required
              placeholder="Contoh: Pemberian Obat Hipertensi Amlodipine 5mg"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-600 font-semibold mb-1">Deskripsi & Catatan Klinis</label>
            <textarea
              rows={2}
              placeholder="Catatan tambahan..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-600 font-semibold mb-1">Tingkat Prioritas</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
              >
                <option value="routine">Routine</option>
                <option value="important">Important</option>
                <option value="critical">Critical (Perlu A3 Approval)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-600 font-semibold mb-1">Wajib Bukti (Evidence Grade)</label>
              <select
                value={newEvidenceGrade}
                onChange={(e) => setNewEvidenceGrade(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
              >
                <option value="E0">E0 - Klaim Verbal</option>
                <option value="E1">E1 - Artefak Foto/QR</option>
                <option value="E2">E2 - Konfirmasi Orang Kedua</option>
                <option value="E3">E3 - Sensor System</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="bg-slate-100 text-slate-700 text-xs px-4 py-2 rounded-xl font-semibold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs px-4 py-2 rounded-xl font-bold shadow-md shadow-sky-600/20 cursor-pointer"
            >
              Simpan & Terbitkan Obligation
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
