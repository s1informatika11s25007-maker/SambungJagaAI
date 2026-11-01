import React, { useState } from 'react';
import { supabase } from '../../supabase/client/client';
import { runRuleReplayAnalysis } from '../../services/rule/ruleReplayService';
import {
  BookOpen,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  Edit3,
  Archive,
  RefreshCw,
  Play,
  FileText,
  AlertTriangle,
  X,
  History,
  Layers,
  Lock
} from 'lucide-react';
import Badge from '../../components/common/Badge';

// Reusable administrative templates. These are workflow drafts, not clinical protocols.
const SOP_TEMPLATES = [
  { code: 'FLOW-OBS-001', title: 'Dokumentasi observasi terjadwal', expression: 'WHEN (ObservationWindow = due) REQUIRE (RecordObservation) WITH GRADE (E1)', priority: 'routine', evidence_grade: 'E1', description: 'Kerangka pencatatan observasi sesuai rencana yang telah disahkan fasilitas. Supervisor wajib menyesuaikan prosedur lokal.' },
  { code: 'FLOW-REVIEW-002', title: 'Tinjauan laporan oleh supervisor', expression: 'WHEN (Report.status = pending_review) REQUIRE (SupervisorReview) WITH GRADE (E1)', priority: 'important', evidence_grade: 'E1', description: 'Memastikan laporan yang membutuhkan perhatian diteruskan kepada petugas berwenang.' },
  { code: 'FLOW-EVIDENCE-003', title: 'Pemeriksaan kelengkapan bukti', expression: 'WHEN (Evidence.submitted) REQUIRE (EvidenceGradeCheck) WITH GRADE (E2)', priority: 'important', evidence_grade: 'E1', description: 'Memeriksa kelengkapan bukti terhadap kriteria tugas. Status selesai tetap memerlukan verifikasi.' },
  { code: 'FLOW-HANDOVER-004', title: 'Serah terima tugas antar-shift', expression: 'WHEN (ShiftChange) REQUIRE (OpenTasksReview AND ReceiverAcknowledgement) WITH GRADE (E1)', priority: 'routine', evidence_grade: 'E1', description: 'Membantu petugas merangkum tugas terbuka serta memastikan penerima mengetahui tindak lanjutnya.' }
];

export default function RuleLibraryPage({
  rules = [],
  setRules,
  activeRole = 'supervisor',
  currentUser,
  obligations = [],
  epistemicFacts = []
}) {
  const isSupervisor = activeRole === 'supervisor' || activeRole === 'admin_hr' || currentUser?.role === 'supervisor' || currentUser?.role === 'admin_hr';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('active'); // 'all', 'active', 'archived'

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReplayRunning, setIsReplayRunning] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  // Form state for Create / Edit
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    expression: '',
    priority: 'important',
    evidence_grade: 'E1',
    description: '',
    approved_by: null
  });

  // Filtered Rules list
  const filteredRules = rules.filter(r => {
    const matchesSearch = (r.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (r.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (r.description || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (filterStatus === 'active') return matchesSearch && r.status !== 'archived';
    if (filterStatus === 'archived') return matchesSearch && r.status === 'archived';
    return matchesSearch;
  });

  // Handle open Create Modal
  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormData({
      code: `RULE-${Date.now().toString().slice(-4)}`,
      title: '',
      expression: '',
      priority: 'important',
      evidence_grade: 'E1',
      description: '',
      approved_by: null
    });
    setShowCreateModal(true);
  };

  // Handle Select Template
  const handleSelectTemplate = (template) => {
    setEditingRule(null);
    setFormData({
      code: template.code,
      title: template.title,
      expression: template.expression,
      priority: template.priority,
      evidence_grade: template.evidence_grade,
      description: template.description,
      approved_by: null
    });
    setShowTemplateModal(false);
    setShowCreateModal(true);
  };

  // Handle Open Edit Modal (Bitemporal Versioning)
  const handleOpenEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      code: rule.code,
      title: rule.title,
      expression: rule.expression,
      priority: rule.priority || 'important',
      evidence_grade: rule.evidence_grade || 'E1',
      description: rule.description || '',
      approved_by: null
    });
    setShowCreateModal(true);
  };

  // Persist every rule revision. Editing archives the previous row and creates a new version.
  const handleSaveRule = async (event) => {
    event.preventDefault();
    if (!formData.title.trim() || !formData.expression.trim() || isSaving) return;
    setIsSaving(true);
    setActionMessage('');
    let archivedPrevious = false;
    try {
      const now = new Date().toISOString();
      let version = 'v1.0.0';
      let supersedesId = null;
      if (editingRule) {
        if (!/^[0-9a-f-]{36}$/i.test(editingRule.id) || editingRule.status === 'derived') {
          throw new Error('Aturan ini hanya ringkasan lama dan tidak dapat diedit. Buat aturan baru yang tersimpan di database.');
        }
        const parts = String(editingRule.version || 'v1.0.0').replace(/^v/, '').split('.');
        version = `v${Number(parts[0] || 1)}.${Number(parts[1] || 0) + 1}.${Number(parts[2] || 0)}`;
        supersedesId = editingRule.id;
        const { error: archiveError } = await supabase.from('care_rules').update({ status: 'archived', updated_at: now }).eq('id', editingRule.id);
        if (archiveError) throw archiveError;
        archivedPrevious = true;
      }
      const payload = {
        code: (formData.code || `RULE-${Date.now()}`).trim(),
        version,
        title: formData.title.trim(),
        expression: formData.expression.trim(),
        priority: formData.priority,
        evidence_grade: formData.evidence_grade,
        description: formData.description.trim(),
        status: 'active',
        effective_from: now,
        approved_by: null,
        created_by: currentUser?.id || null,
        supersedes_id: supersedesId,
        updated_at: now
      };
      const { data, error } = await supabase.from('care_rules').insert(payload).select('*').single();
      if (error) throw error;
      if (setRules) setRules([data, ...rules.map((rule) => rule.id === supersedesId ? { ...rule, status: 'archived', updated_at: now } : rule)]);
      setShowCreateModal(false);
      setEditingRule(null);
      setActionMessage(`Aturan ${data.code} ${data.version} berhasil disimpan.`);
    } catch (error) {
      if (archivedPrevious && editingRule?.id) {
        await supabase.from('care_rules').update({ status: 'active' }).eq('id', editingRule.id);
      }
      setActionMessage(error?.message || 'Aturan belum tersimpan. Periksa akses database dan coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  // Archive changes the persisted database record; no local-only success state.
  const handleToggleArchive = async (ruleId) => {
    const target = rules.find((rule) => rule.id === ruleId);
    if (!target || !/^[0-9a-f-]{36}$/i.test(ruleId)) {
      setActionMessage('Ringkasan turunan tidak dapat diarsipkan.');
      return;
    }
    const nextStatus = target.status === 'archived' ? 'active' : 'archived';
    const { data, error } = await supabase.from('care_rules').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', ruleId).select('*').single();
    if (error) {
      setActionMessage(error.message || 'Perubahan status belum tersimpan.');
      return;
    }
    if (setRules) setRules(rules.map((rule) => rule.id === ruleId ? data : rule));
    setActionMessage(nextStatus === 'archived' ? 'Aturan berhasil diarsipkan.' : 'Aturan berhasil diaktifkan kembali.');
  };

  // Replay only reports what the configured engine can actually verify.
  const handleRunSimulation = async (rule) => {
    if (isReplayRunning) return;
    setIsReplayRunning(true);
    try {
      const result = await runRuleReplayAnalysis(7, obligations, rule.version || 'v1.0.0');
      setSimulationResult({ rule, result, timestamp: new Date().toLocaleTimeString('id-ID') });
      setShowSimulationModal(true);
    } catch (error) {
      setActionMessage(error?.message || 'Layanan replay belum tersedia.');
    } finally {
      setIsReplayRunning(false);
    }
  };

  return (
    <div className="w-full space-y-6 text-left font-sans">

      {/* HEADER BAR & GOVERNANCE ROLE BANNER */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Rule & Policy Library <span className="text-xs font-semibold text-sky-600 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full ml-2">P1 Temporal Kernel</span>
            </h2>
          </div>
          <p className="text-xs text-slate-600">
            Kelola alur administratif, standar bukti, dan revisi aturan yang tersimpan di database.
          </p>
        </div>

        {/* RBAC Action Area */}
        <div className="flex items-center space-x-2 shrink-0">
          {isSupervisor ? (
            <>
              <button
                onClick={() => setShowTemplateModal(true)}
                className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-all duration-200 flex items-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <FileText className="w-4 h-4 text-sky-600" />
                <span>Template Alur Kerja</span>
              </button>

              <button
                onClick={handleOpenCreate}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-md transition-all duration-200 flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Aturan Baru</span>
              </button>
            </>
          ) : (
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-medium border border-slate-200">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Mode Baca (Akses Terbatas)</span>
            </div>
          )}
        </div>
      </div>

      {/* SEARCH & FILTER CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan kode aturan, judul, atau kata kunci..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              filterStatus === 'active' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Aktif ({rules.filter(r => r.status !== 'archived').length})
          </button>
          <button
            onClick={() => setFilterStatus('archived')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              filterStatus === 'archived' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Diarsip ({rules.filter(r => r.status === 'archived').length})
          </button>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              filterStatus === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua ({rules.length})
          </button>
        </div>
      </div>

      {actionMessage && <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700" role="status">{actionMessage}</div>}

      {/* RULES LIST */}
      <div className="space-y-4 w-full">
        {filteredRules.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">Belum Ada Aturan Tersimpan</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery ? 'Coba ubah kata kunci pencarian Anda.' : 'Buat aturan baru atau mulai dari template alur kerja. Data turunan tidak akan ditampilkan sebagai aturan resmi.'}
            </p>
          </div>
        ) : (
          filteredRules.map(rule => (
            <div
              key={rule.id}
              className={`bg-white border rounded-2xl p-5 shadow-sm transition-all duration-200 hover:shadow-md space-y-3.5 w-full ${
                rule.status === 'archived' ? 'border-amber-200/80 bg-amber-50/20 opacity-80' : 'border-slate-200'
              }`}
            >
              {/* Header Info */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs text-sky-700 font-bold bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                    {rule.code}
                  </span>
                  <Badge variant="kernel">{rule.version || 'v1.0.0-clinical'}</Badge>
                  {rule.priority && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      rule.priority === 'critical' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                      rule.priority === 'important' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                      'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {rule.priority}
                    </span>
                  )}
                  {rule.evidence_grade && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Grade {rule.evidence_grade}
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] font-bold flex items-center px-2.5 py-0.5 rounded border ${
                    rule.status === 'archived'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}>
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {rule.status === 'archived' ? 'Diarsip' : 'Aktif'}
                  </span>

                  {/* Actions for Supervisor */}
                  {isSupervisor && rule.status !== 'derived' && (
                    <div className="flex items-center space-x-1 pl-2 border-l border-slate-200">
                      <button
                        onClick={() => handleRunSimulation(rule)}
                        className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                        title="Periksa replay dengan data yang tersedia"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleOpenEdit(rule)}
                        className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                        title="Buat revisi aturan baru"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleToggleArchive(rule.id)}
                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                        title={rule.status === 'archived' ? 'Aktifkan Kembali Aturan' : 'Arsipkan Aturan'}
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <h3 className="text-sm font-bold text-slate-900">{rule.title}</h3>
                {rule.description && (
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{rule.description}</p>
                )}
              </div>

              {/* Logical Expression Code Box */}
              <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 font-mono text-xs text-sky-300 font-medium overflow-x-auto">
                {rule.expression}
              </div>

              {/* Metadata Footer */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2.5">
                <span>Diperbarui: <strong className="text-slate-700">{rule.updated_at || rule.created_at || rule.effective_from ? new Date(rule.updated_at || rule.created_at || rule.effective_from).toLocaleDateString('id-ID') : 'Belum tercatat'}</strong></span>
                <span>Versi: <strong className="text-slate-800">{rule.version || 'Belum diberi versi'}</strong></span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE / EDIT RULE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-left border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingRule ? `Edit Aturan (Bitemporal Versioning ${editingRule.code})` : 'Tambah Aturan Alur Kerja'}
                </h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kode Aturan</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tingkat Bukti Wajib (Evidence Grade)</label>
                  <select
                    value={formData.evidence_grade}
                    onChange={(e) => setFormData({ ...formData, evidence_grade: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-sky-500"
                  >
                    <option value="E0">E0 - Klaim Verbal Laporan</option>
                    <option value="E1">E1 - Artefak Foto / QR Lokasi</option>
                    <option value="E2">E2 - Verifikasi Perawat Ke-2 (Dual Sign)</option>
                    <option value="E3">E3 - Sensor IoT / Alat Medis</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Judul Aturan / Alur Kerja</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Dokumentasi observasi terjadwal"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ekspresi Aturan (IF ... THEN REQUIRE ...)</label>
                <textarea
                  rows={2}
                  required
                  placeholder='WHEN (ObservationWindow = due) REQUIRE (RecordObservation) WITH GRADE (E1)'
                  value={formData.expression}
                  onChange={(e) => setFormData({ ...formData, expression: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs font-mono text-sky-300 outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi Aturan</label>
                <textarea
                  rows={2}
                  placeholder="Penjelasan detail petunjuk operasional bagi pengasuh..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Prioritas Risiko</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-sky-500"
                  >
                    <option value="routine">Routine (Rutin)</option>
                    <option value="important">Important (Penting)</option>
                    <option value="critical">Critical (Kritis)</option>
                  </select>
                </div>
<div className="flex items-center text-[11px] leading-relaxed text-slate-500">Penyimpanan membuat revisi aturan. Persetujuan prosedur tetap dilakukan melalui tata kelola fasilitas di luar editor ini.</div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl shadow-md transition"
                >
                  {isSaving ? 'Menyimpan…' : editingRule ? 'Simpan revisi baru' : 'Simpan aturan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRESET SOP TEMPLATES MODAL */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-left border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">Template Alur Administratif</h3>
              </div>
              <button onClick={() => setShowTemplateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Template ini hanya kerangka alur administrasi, bukan instruksi medis. Sesuaikan dengan SOP fasilitas dan minta persetujuan supervisor sebelum digunakan.
            </p>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {SOP_TEMPLATES.map((tmpl, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectTemplate(tmpl)}
                  className="p-4 border border-slate-200 rounded-xl hover:border-sky-500 hover:bg-sky-50/40 transition cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-sky-700 font-bold bg-sky-100 px-2 py-0.5 rounded">
                      {tmpl.code}
                    </span>
                    <span className="text-[10px] font-bold text-sky-600 group-hover:translate-x-1 transition-transform">
                      Gunakan Template →
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">{tmpl.title}</h4>
                  <p className="text-[11px] text-slate-600">{tmpl.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* P4 RETROACTIVE RULE REPLAY SIMULATION MODAL */}
      {showSimulationModal && simulationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Play className="w-5 h-5 text-sky-600 fill-sky-600" />
                <h3 className="text-base font-bold text-slate-900">Hasil Simulasi Replay Aturan (P4)</h3>
              </div>
              <button onClick={() => setShowSimulationModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs space-y-1">
              <p className="font-bold text-sky-900">{simulationResult.rule.code} — {simulationResult.rule.title}</p>
              <p className="text-sky-700 font-mono text-[11px]">{simulationResult.rule.expression}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-[11px] text-slate-500 font-bold">Catatan pada rentang 7 hari</p>
                <p className="text-lg font-black text-slate-900 mt-0.5">{simulationResult.result.replayedRecords ?? '—'}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="text-[11px] text-slate-500 font-bold">Konflik terverifikasi</p>
                <p className="text-lg font-black text-slate-900 mt-0.5">{simulationResult.result.verified ? simulationResult.result.discrepanciesFound : 'Belum diverifikasi'}</p>
              </div>
            </div>

            <div className={`p-3 rounded-xl text-xs border ${simulationResult.result.verified ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-950'}`}>
              <p className="font-bold">{simulationResult.result.verified ? 'Hasil replay tervalidasi' : 'Replay penuh belum tersedia'}</p>
              <p className="mt-1 text-[11px] leading-relaxed">{simulationResult.result.analysis}</p>
            </div>

            <button
              onClick={() => setShowSimulationModal(false)}
              className="w-full bg-slate-900 text-white font-bold text-xs py-2.5 rounded-xl hover:bg-slate-800 transition"
            >
              Tutup Hasil Simulasi
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
