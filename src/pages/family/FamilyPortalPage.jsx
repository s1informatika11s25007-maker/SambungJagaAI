import React, { useEffect, useMemo, useState } from 'react';
import { Users, LockKeyhole, Heart, Eye, ChevronDown, ClipboardList, CalendarClock, Calendar, MessageSquare, Send, CheckCircle2, ShieldAlert, Bell, Settings, Check } from 'lucide-react';
import Badge from '../../components/common/Badge';
import { filterFamilyPortalData } from '../../services/auth/consentDisclosureService';
import {
  submitFamilyVisitRequest,
  submitFamilyComplaint,
  fetchFamilyVisitRequests,
  fetchFamilyComplaints,
  confirmDisclosureReceipt,
  getFamilyNotificationPreferences,
  updateFamilyNotificationPreferences
} from '../../services/ai/familyLiaisonAgent';

export default function FamilyPortalPage({ currentUser, residents = [], obligations = [] }) {
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [disclosureData, setDisclosureData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('activities'); // 'activities' | 'visits' | 'complaints' | 'preferences'

  // Async Visit & Complaint Lists
  const [existingVisits, setExistingVisits] = useState([]);
  const [existingComplaints, setExistingComplaints] = useState([]);
  const [receiptConfirmed, setReceiptConfirmed] = useState(false);

  // Visit Request Form State
  const [visitDate, setVisitDate] = useState('');
  const [visitTime, setVisitTime] = useState('10:00');
  const [visitorCount, setVisitorCount] = useState(2);
  const [visitNotes, setVisitNotes] = useState('');
  const [visitFeedback, setVisitFeedback] = useState(null);

  // Complaint Form State
  const [complaintCategory, setComplaintCategory] = useState('clinical');
  const [complaintText, setComplaintText] = useState('');
  const [complaintFeedback, setComplaintFeedback] = useState(null);

  // Preferences State
  const familyUserId = currentUser?.authUserId || currentUser?.user_id || currentUser?.id || null;
  const [pref, setPref] = useState(() => familyUserId ? getFamilyNotificationPreferences(familyUserId) : { inApp: true, whatsapp: true, email: true, sms: false, push: true, quietHoursEnabled: false });
  const [prefSavedMsg, setPrefSavedMsg] = useState('');

  useEffect(() => {
    if (!residents.length) {
      setSelectedResidentId('');
      setDisclosureData(null);
      setIsLoading(false);
      return;
    }
    if (!residents.some((resident) => resident.id === selectedResidentId)) {
      setSelectedResidentId(residents[0].id);
    }
  }, [residents, selectedResidentId]);

  const familyResident = residents.find((resident) => resident.id === selectedResidentId) || null;
  const residentObligations = useMemo(
    () => familyResident ? obligations.filter((obligation) => obligation.resident_id === familyResident.id) : [],
    [familyResident?.id, obligations]
  );

  // Asynchronous Loading for Filtered Data, Visits, and Complaints
  useEffect(() => {
    let active = true;
    async function loadData() {
      if (!familyResident) return;
      setIsLoading(true);
      try {
        const result = await filterFamilyPortalData(familyResident, residentObligations);
        const visits = await fetchFamilyVisitRequests(familyResident.id);
        const complaints = await fetchFamilyComplaints(familyResident.id);

        if (active) {
          setDisclosureData(result);
          setExistingVisits(visits || []);
          setExistingComplaints(complaints || []);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadData();
    return () => { active = false; };
  }, [familyResident?.id, residentObligations.length, residentObligations.map((item) => `${item.id}:${item.status}`).join('|')]);

  if (!residents.length) {
    return (
      <section className="space-y-5">
        <header className="sj-page-intro">
          <div><span className="sj-eyebrow">RUANG KELUARGA</span><h1>Portal Keluarga</h1><p>Informasi perawatan yang dibagikan fasilitas akan ditampilkan di sini.</p></div>
          <Badge variant="info"><LockKeyhole size={13} /> Akses terbatas</Badge>
        </header>
        <div className="sj-empty-state">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><LockKeyhole size={22} /></span>
          <h3>Belum ada penghuni yang terhubung</h3>
          <p>Akun keluarga belum memiliki relasi akses ke profil penghuni. Minta administrator fasilitas menghubungkan akun Anda sebelum informasi perawatan ditampilkan.</p>
        </div>
      </section>
    );
  }

  const visibleObligations = disclosureData?.filteredObligations || [];

  const handleVisitSubmit = async (e) => {
    e.preventDefault();
    if (!visitDate || !familyResident) return;

    const result = await submitFamilyVisitRequest({
      familyUserId,
      residentId: familyResident.id,
      residentName: familyResident.full_name,
      proposedDate: visitDate,
      proposedTime: visitTime,
      visitorCount: Number(visitorCount),
      notes: visitNotes
    });

    setVisitFeedback({ ok: result.success, msg: result.message });
    if (result.success) {
      setVisitDate('');
      setVisitNotes('');
      // Reload visits
      const updatedVisits = await fetchFamilyVisitRequests(familyResident.id);
      setExistingVisits(updatedVisits || []);
    }
    setTimeout(() => setVisitFeedback(null), 5000);
  };

  const handleComplaintSubmit = async (e) => {
    e.preventDefault();
    if (!complaintText.trim() || !familyResident) return;

    const result = await submitFamilyComplaint({
      familyUserId,
      residentId: familyResident.id,
      facilityId: familyResident.facility_id || currentUser?.facility_id,
      residentName: familyResident.full_name,
      category: complaintCategory,
      complaintText
    });

    setComplaintFeedback({ ok: result.success, msg: result.message });
    if (result.success) {
      setComplaintText('');
      // Reload complaints
      const updatedComplaints = await fetchFamilyComplaints(familyResident.id);
      setExistingComplaints(updatedComplaints || []);
    }
    setTimeout(() => setComplaintFeedback(null), 5000);
  };

  const handleConfirmReceipt = async () => {
    if (!familyResident) return;
    const res = await confirmDisclosureReceipt({
      digestId: `daily-${familyResident.id}-${new Date().toISOString().slice(0, 10)}`,
      familyUserId,
      residentId: familyResident.id,
      facilityId: familyResident.facility_id || currentUser?.facility_id
    });
    if (res.success) {
      setReceiptConfirmed(true);
      setTimeout(() => setReceiptConfirmed(false), 5000);
    }
  };

  const handleSavePref = async (e) => {
    e.preventDefault();
    const result = await updateFamilyNotificationPreferences(familyUserId, {
      ...pref,
      facilityId: familyResident?.facility_id || currentUser?.facility_id
    });
    setPrefSavedMsg(result?.success ? 'Preferensi notifikasi berhasil disimpan.' : (result?.error || 'Preferensi belum tersimpan.'));
    setTimeout(() => setPrefSavedMsg(''), 5000);
  };

  return (
    <section className="space-y-6">
      <header className="sj-page-intro">
        <div>
          <span className="sj-eyebrow">RUANG KELUARGA (SUPERAGENT KOMUNIKASI KELUARGA P1)</span>
          <h1>Portal Komunikasi Keluarga 2-Arah</h1>
          <p>Portal interaktif: lihat perkembangan perawatan, ajukan kunjungan otomatis, dan sampaikan pengaduan terkontrol.</p>
        </div>
        <Badge variant="info"><LockKeyhole size={13} /> Data sesuai tingkat akses</Badge>
      </header>

      {residents.length > 1 && <label className="sj-field max-w-sm">
        <span>Pilih anggota keluarga</span>
        <span className="sj-input-wrap"><Users size={17} /><select value={selectedResidentId} onChange={(event) => setSelectedResidentId(event.target.value)} aria-label="Pilih penghuni" className="w-full min-w-0 bg-transparent py-3 text-xs text-slate-800 outline-none">{residents.map((resident) => <option key={resident.id} value={resident.id}>{resident.full_name} · Kamar {resident.room_number}</option>)}</select><ChevronDown size={15} /></span>
      </label>}

      {familyResident && <article className="sj-work-card flex flex-col sm:flex-row sm:items-center gap-4 p-5">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600"><Heart size={25} /></div>
        <div className="min-w-0 flex-1">
          <span className="sj-eyebrow">PROFIL TERHUBUNG</span>
          <h2 className="mt-1 text-lg font-extrabold text-slate-800">{familyResident.full_name}</h2>
          <p className="mt-1 text-xs text-slate-500">Kamar {familyResident.room_number || 'Belum dicatat'}</p>
        </div>
        <div className="flex flex-col items-end space-y-1">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-800"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Akses Keluarga Terbatas</span>
          <button
            onClick={handleConfirmReceipt}
            disabled={receiptConfirmed}
            className="text-[11px] font-bold text-sky-700 hover:text-sky-800 underline flex items-center space-x-1"
          >
            {receiptConfirmed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" /> : null}
            <span>{receiptConfirmed ? 'Telah Dikonfirmasi' : 'Konfirmasi Penerimaan Informasi'}</span>
          </button>
        </div>
      </article>}

      {/* 2-Way Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-4 font-bold text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('activities')}
          className={`pb-2.5 transition flex items-center space-x-1.5 border-b-2 whitespace-nowrap ${
            activeTab === 'activities' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Aktivitas Perawatan ({visibleObligations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('visits')}
          className={`pb-2.5 transition flex items-center space-x-1.5 border-b-2 whitespace-nowrap ${
            activeTab === 'visits' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Permintaan Kunjungan ({existingVisits.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('complaints')}
          className={`pb-2.5 transition flex items-center space-x-1.5 border-b-2 whitespace-nowrap ${
            activeTab === 'complaints' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Pengaduan &amp; Masukan ({existingComplaints.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('preferences')}
          className={`pb-2.5 transition flex items-center space-x-1.5 border-b-2 whitespace-nowrap ${
            activeTab === 'preferences' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Preferensi Notifikasi</span>
        </button>
      </div>

      {/* Tab 1: Activities */}
      {activeTab === 'activities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="sj-eyebrow">PEMBARUAN HARI INI</span>
              <h2 className="mt-1 text-base font-extrabold text-slate-800">Aktivitas Perawatan Terkontrol</h2>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">{residentObligations.length} catatan terkait</span>
          </div>

          {isLoading ? (
            <div className="sj-empty-state"><CalendarClock className="animate-pulse" size={25} /><h3>Menyiapkan ringkasan</h3><p>Data yang diizinkan sedang disiapkan.</p></div>
          ) : visibleObligations.length ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {visibleObligations.map((obligation) => (
                <article key={obligation.id} className="sj-work-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-800">{obligation.title || 'Aktivitas perawatan diperbarui'}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">{obligation.friendlyDescription || 'Ada pembaruan aktivitas yang dibagikan fasilitas.'}</p>
                    </div>
                    <Badge variant={obligation.status === 'verified_closed' ? 'success' : 'info'}>
                      {obligation.status === 'verified_closed' ? 'Selesai' : obligation.status === 'escalated' ? 'Ditinjau tim' : 'Berjalan'}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400">
                    <span className="inline-flex items-center gap-1.5"><ClipboardList size={13} /> Pembaruan resmi fasilitas</span>
                    <span>{(obligation.updated_at || obligation.sys_created_at || obligation.valid_from) ? new Date(obligation.updated_at || obligation.sys_created_at || obligation.valid_from).toLocaleDateString('id-ID') : ''}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="sj-empty-state"><Eye size={25} /><h3>Belum ada pembaruan yang dibagikan</h3><p>Aktivitas akan muncul setelah fasilitas mencatat dan mengizinkan informasi untuk dibagikan kepada keluarga.</p></div>
          )}
        </div>
      )}

      {/* Tab 2: Visit Requests */}
      {activeTab === 'visits' && (
        <div className="space-y-4">
          <div className="sj-work-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-sky-600" />
              Ajukan Permintaan Kunjungan Otomatis
            </h3>

            <form onSubmit={handleVisitSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal Kunjungan</label>
                <input
                  type="date"
                  required
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Jam Rencana (Jam Besuk 09:00-17:00)</label>
                <input
                  type="time"
                  required
                  value={visitTime}
                  onChange={(e) => setVisitTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Jumlah Pengunjung</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={visitorCount}
                  onChange={(e) => setVisitorCount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Catatan Tambahan</label>
                <input
                  type="text"
                  placeholder="Contoh: Membawa kue ulang tahun untuk Oma"
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 text-white text-xs px-5 py-2.5 rounded-xl font-bold transition flex items-center space-x-1.5 shadow-md shadow-sky-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Permintaan Kunjungan</span>
                </button>
              </div>
            </form>

            {visitFeedback && (
              <div className={`p-3 rounded-xl text-xs font-bold border ${visitFeedback.ok ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-900 border-rose-300'}`}>
                {visitFeedback.msg}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700">Riwayat Permintaan Kunjungan (Status Tracker):</h4>
            {existingVisits.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Belum ada riwayat kunjungan yang diajukan.</p>
            ) : (
              existingVisits.map(v => {
                const currentStatus = v.status || 'pending_review';
                const steps = [
                  { label: 'Submitted', done: true },
                  { label: 'Received', done: true },
                  { label: 'Processing', done: true },
                  { label: 'Waiting Response', done: currentStatus === 'pending_review' },
                  { label: 'Resolved', done: currentStatus === 'approved' || currentStatus === 'resolved' },
                  { label: 'Closed', done: currentStatus === 'approved' || currentStatus === 'closed' }
                ];

                return (
                  <div key={v.id} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{v.proposed_date} (Jam {v.proposed_time})</span>
                        <p className="text-slate-500 text-[11px]">{v.visitor_count} Pengunjung · {v.notes || 'Tanpa catatan'}</p>
                      </div>
                      <Badge variant={v.status === 'approved' ? 'success' : 'info'}>
                        {v.status === 'approved' ? 'Disetujui' : 'Dalam Proses'}
                      </Badge>
                    </div>

                    {/* 6-Step Visual Lifecycle Bar */}
                    <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100 font-mono text-[9px]">
                      {steps.map((s, idx) => (
                        <div key={idx} className="flex-1 text-center space-y-1">
                          <div className={`h-1.5 rounded-full ${s.done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                          <span className={s.done ? 'text-emerald-700 font-bold' : 'text-slate-400'}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Complaints */}
      {activeTab === 'complaints' && (
        <div className="space-y-4">
          <div className="sj-work-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center">
              <ShieldAlert className="w-4 h-4 mr-2 text-rose-600" />
              Kirim Pengaduan / Masukan (Auto-Categorized AI Agent)
            </h3>

            <form onSubmit={handleComplaintSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori Masukan</label>
                <select
                  value={complaintCategory}
                  onChange={(e) => setComplaintCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                >
                  <option value="clinical">Medis &amp; Perawatan Lansia</option>
                  <option value="service">Layanan &amp; Makanan</option>
                  <option value="facility">Fasilitas &amp; Kebersihan</option>
                  <option value="general">Lain-lain</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Isi Masukan / Pengaduan</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Tuliskan masukan Anda secara jelas. AI Agent akan mengategorikan dan meneruskan ke supervisor..."
                  value={complaintText}
                  onChange={(e) => setComplaintText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:ring-1 focus:ring-sky-500 outline-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs px-5 py-2.5 rounded-xl font-bold transition flex items-center space-x-1.5 shadow-md shadow-rose-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Pengaduan Resmi</span>
                </button>
              </div>
            </form>

            {complaintFeedback && (
              <div className={`p-3 rounded-xl text-xs font-bold border ${complaintFeedback.ok ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-900 border-rose-300'}`}>
                {complaintFeedback.msg}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700">Status Tracking Pengaduan (Status Tracker):</h4>
            {existingComplaints.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Belum ada pengaduan yang dikirim.</p>
            ) : (
              existingComplaints.map(c => {
                const currentStatus = c.status || 'received';
                const complaintSteps = [
                  { label: 'Submitted', done: true },
                  { label: 'Received', done: currentStatus === 'received' || currentStatus === 'processing' || currentStatus === 'resolved' || currentStatus === 'closed' },
                  { label: 'Processing', done: currentStatus === 'processing' || currentStatus === 'resolved' || currentStatus === 'closed' },
                  { label: 'Waiting Response', done: currentStatus === 'processing' || currentStatus === 'waiting_response' },
                  { label: 'Resolved', done: currentStatus === 'resolved' || currentStatus === 'closed' },
                  { label: 'Closed', done: currentStatus === 'closed' }
                ];

                return (
                  <div key={c.id} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 uppercase">Kategori: {c.category}</span>
                      <Badge variant={c.status === 'resolved' || c.status === 'closed' ? 'success' : (c.severity === 'critical' ? 'danger' : 'warning')}>
                        Status: {c.status === 'resolved' ? 'Selesai Ditangani' : c.status}
                      </Badge>
                    </div>
                    <p className="text-slate-600">{c.complaint_text}</p>
                    {c.resolution_notes && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-[11px]">
                        <span className="font-bold">Tanggapan Supervisor:</span> {c.resolution_notes}
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 font-mono">Diarahkan ke: {c.target_role} · Tiket: {c.ticket_number || c.id.slice(0, 8)}</p>

                    {/* 6-Step Visual Lifecycle Bar */}
                    <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100 font-mono text-[9px]">
                      {complaintSteps.map((s, idx) => (
                        <div key={idx} className="flex-1 text-center space-y-1">
                          <div className={`h-1.5 rounded-full ${s.done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                          <span className={s.done ? 'text-emerald-700 font-bold' : 'text-slate-400'}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Preferences */}
      {activeTab === 'preferences' && (
        <form onSubmit={handleSavePref} className="sj-work-card p-5 space-y-4 max-w-lg">
          <h3 className="text-sm font-bold text-slate-800 flex items-center">
            <Bell className="w-4 h-4 mr-2 text-sky-600" />
            Preferensi Notifikasi &amp; Quiet Hours
          </h3>

          <div className="space-y-3 text-xs text-slate-700">
            <label className="flex items-center justify-between">
              <span>Notifikasi In-App</span>
              <input type="checkbox" checked={pref.inApp} onChange={e => setPref({ ...pref, inApp: e.target.checked })} />
            </label>

            <label className="flex items-center justify-between">
              <span>Push Notification HP</span>
              <input type="checkbox" checked={pref.pushNotification} onChange={e => setPref({ ...pref, pushNotification: e.target.checked })} />
            </label>

            <label className="flex items-center justify-between">
              <span>Notifikasi WhatsApp Ringkasan</span>
              <input type="checkbox" checked={pref.whatsapp} onChange={e => setPref({ ...pref, whatsapp: e.target.checked })} />
            </label>

            <div className="border-t border-slate-100 pt-3 space-y-2">
              <span className="font-bold block text-slate-800">Jam Tenang (Quiet Hours):</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500">Mulai</label>
                  <input type="time" value={pref.quietHoursStart} onChange={e => setPref({ ...pref, quietHoursStart: e.target.value })} className="w-full border rounded p-1.5" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500">Selesai</label>
                  <input type="time" value={pref.quietHoursEnd} onChange={e => setPref({ ...pref, quietHoursEnd: e.target.value })} className="w-full border rounded p-1.5" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white text-xs px-4 py-2 rounded-xl font-bold flex items-center space-x-1">
              <Check className="w-3.5 h-3.5" />
              <span>Simpan Preferensi</span>
            </button>
          </div>

          {prefSavedMsg && (
            <p className="p-2 bg-emerald-50 text-emerald-900 text-xs font-bold rounded-lg border border-emerald-300">{prefSavedMsg}</p>
          )}
        </form>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900">
        <LockKeyhole size={17} className="mt-0.5 shrink-0" />
        <p className="text-[10px] leading-relaxed">{disclosureData?.pdpComplianceNote || 'Portal ini hanya menampilkan informasi yang lolos pembatasan akses. Portal bukan pengganti komunikasi langsung dengan tenaga perawatan.'}</p>
      </div>
    </section>
  );
}
