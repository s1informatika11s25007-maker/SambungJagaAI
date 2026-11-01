import React, { useEffect, useMemo, useState } from 'react';
import { Users, LockKeyhole, Heart, Eye, ChevronDown, ClipboardList, CalendarClock } from 'lucide-react';
import Badge from '../../components/common/Badge';
import { filterFamilyPortalData } from '../../services/auth/consentDisclosureService';

export default function FamilyPortalPage({ residents = [], obligations = [] }) {
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [disclosureData, setDisclosureData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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

  useEffect(() => {
    let active = true;
    async function loadFilteredData() {
      if (!familyResident) return;
      setIsLoading(true);
      try {
        const result = await filterFamilyPortalData(familyResident, residentObligations);
        if (active) setDisclosureData(result);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadFilteredData();
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

  return (
    <section className="space-y-6">
      <header className="sj-page-intro">
        <div><span className="sj-eyebrow">RUANG KELUARGA</span><h1>Portal Keluarga</h1><p>Lihat ringkasan yang memang diizinkan oleh fasilitas. Informasi rinci tetap berada pada tim perawatan.</p></div>
        <Badge variant="info"><LockKeyhole size={13} /> Ringkasan terkontrol</Badge>
      </header>

      {residents.length > 1 && <label className="sj-field max-w-sm">
        <span>Pilih anggota keluarga</span>
        <span className="sj-input-wrap"><Users size={17} /><select value={selectedResidentId} onChange={(event) => setSelectedResidentId(event.target.value)} aria-label="Pilih penghuni" className="w-full min-w-0 bg-transparent py-3 text-xs text-slate-800 outline-none">{residents.map((resident) => <option key={resident.id} value={resident.id}>{resident.full_name} · Kamar {resident.room_number}</option>)}</select><ChevronDown size={15} /></span>
      </label>}

      {familyResident && <article className="sj-work-card flex flex-col sm:flex-row sm:items-center gap-4 p-5">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600"><Heart size={25} /></div>
        <div className="min-w-0 flex-1"><span className="sj-eyebrow">PROFIL TERHUBUNG</span><h2 className="mt-1 text-lg font-extrabold text-slate-800">{familyResident.full_name}</h2><p className="mt-1 text-xs text-slate-500">Kamar {familyResident.room_number || 'Belum dicatat'}</p></div>
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-800"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Terhubung ke akun Anda</span>
      </article>}

      <div className="flex items-center justify-between gap-3"><div><span className="sj-eyebrow">PEMBARUAN</span><h2 className="mt-1 text-base font-extrabold text-slate-800">Aktivitas perawatan yang dibagikan</h2></div><span className="text-[10px] font-semibold text-slate-400">{residentObligations.length} catatan terkait</span></div>

      {isLoading ? <div className="sj-empty-state"><CalendarClock className="animate-pulse" size={25} /><h3>Menyiapkan ringkasan</h3><p>Data yang diizinkan sedang disiapkan.</p></div> : visibleObligations.length ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {visibleObligations.map((obligation) => <article key={obligation.id} className="sj-work-card p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-sm font-bold text-slate-800">{obligation.title || 'Aktivitas perawatan diperbarui'}</h3><p className="mt-2 text-xs leading-relaxed text-slate-500">{obligation.friendlyDescription || 'Ada pembaruan aktivitas yang dibagikan fasilitas.'}</p></div><Badge variant={obligation.status === 'verified_closed' ? 'success' : 'info'}>{obligation.status === 'verified_closed' ? 'Selesai' : obligation.status === 'escalated' ? 'Ditinjau tim' : 'Berjalan'}</Badge></div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400"><span className="inline-flex items-center gap-1.5"><ClipboardList size={13} /> Pembaruan yang dibagikan</span><span>{(obligation.updated_at || obligation.sys_created_at || obligation.valid_from) ? new Date(obligation.updated_at || obligation.sys_created_at || obligation.valid_from).toLocaleDateString('id-ID') : ''}</span></div>
          </article>)}
        </div>
      ) : <div className="sj-empty-state"><Eye size={25} /><h3>Belum ada pembaruan yang dibagikan</h3><p>Aktivitas akan muncul setelah fasilitas mencatat dan mengizinkan informasi untuk dibagikan kepada keluarga.</p></div>}

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900"><LockKeyhole size={17} className="mt-0.5 shrink-0" /><p className="text-[10px] leading-relaxed">{disclosureData?.pdpComplianceNote || 'Portal ini hanya menampilkan informasi yang lolos pembatasan akses. Portal bukan pengganti komunikasi langsung dengan tenaga perawatan.'}</p></div>
    </section>
  );
}
