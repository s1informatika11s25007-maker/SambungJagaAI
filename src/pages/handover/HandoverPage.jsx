import React, { useEffect, useMemo, useState } from 'react';
import { FileSignature, ShieldCheck, CheckCircle2, Users, Activity, Plus, FileCheck, Clock, LockKeyhole, RefreshCw } from 'lucide-react';
import HandoverContractCard from '../../components/handover/HandoverContractCard';

export default function HandoverPage({
  handoverContracts = [],
  onSignContract,
  onCreateContract,
  currentUserRole = 'supervisor',
  currentUser,
  staff = [],
  obligations = []
}) {
  const [incomingStaffId, setIncomingStaffId] = useState('');
  const [shiftName, setShiftName] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSigningRefresh, setIsSigningRefresh] = useState(false);

  const activeContracts = handoverContracts;
  const pendingCount = activeContracts.filter((contract) => contract.contract_status !== 'confirmed').length;
  const confirmedCount = activeContracts.filter((contract) => contract.contract_status === 'confirmed').length;
  const openObligationsCount = obligations.filter((item) => item.assigned_caregiver_id === currentUser?.id && ['open', 'in_progress', 'escalated'].includes(item.status)).length;
  const onDutyCaregivers = useMemo(
    () => staff.filter((person) => person.role === 'caregiver' && person.shift_status === 'on_duty' && person.id !== currentUser?.id),
    [staff, currentUser?.id]
  );
  const digestCount = activeContracts.filter((contract) => /^[a-f0-9]{64}$/i.test(contract.hash_signature || '')).length;

  useEffect(() => {
    if (!onDutyCaregivers.some((person) => person.id === incomingStaffId)) {
      setIncomingStaffId(onDutyCaregivers[0]?.id || '');
    }
  }, [onDutyCaregivers, incomingStaffId]);

  const handleCreateContract = async () => {
    if (isCreating || !incomingStaffId || typeof onCreateContract !== 'function') return;
    setIsCreating(true);
    const result = await onCreateContract({ incomingStaffId, shiftName });
    setIsCreating(false);
    setToastMessage(result?.success ? result.message : (result?.error || 'Kontrak belum tersimpan.'));
    if (result?.success) setShiftName('');
    window.setTimeout(() => setToastMessage(''), 6500);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 text-left font-sans">
      <header className="sj-page-intro">
        <div>
          <span className="sj-eyebrow">KOORDINASI ANTAR-SHIFT</span>
          <h1>Serah Terima Shift</h1>
          <p>Buat kontrak berdasarkan tugas aktif, lalu minta pengirim dan penerima menandatangani dari akun masing-masing.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800"><LockKeyhole size={14} /> Tanda tangan per akun</span>
      </header>

      {toastMessage && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700 shadow-sm"><span>{toastMessage}</span><button type="button" onClick={() => setToastMessage('')} aria-label="Tutup pesan">×</button></div>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="sj-metric-card"><span>Kontrak tercatat</span><strong>{activeContracts.length}</strong><small>Data database</small></article>
        <article className="sj-metric-card"><span>Menunggu tanda tangan</span><strong>{pendingCount}</strong><small>Belum terkonfirmasi</small></article>
        <article className="sj-metric-card"><span>Terkonfirmasi</span><strong>{confirmedCount}</strong><small>Kedua pihak menandatangani</small></article>
        <article className="sj-metric-card"><span>SHA-256 tersedia</span><strong>{digestCount}/{activeContracts.length}</strong><small>Digest dibuat database</small></article>
      </section>

      <section className="sj-work-card space-y-4 p-5">
        <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><FileSignature size={20} /></span><div><h2 className="text-sm font-extrabold text-slate-800">Buat kontrak serah terima</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">Akun Anda menjadi pengirim. Pilih penerima yang sedang bertugas. Daftar tugas yang ikut diserahterimakan diambil dari tugas yang ditugaskan kepada akun Anda.</p></div></div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.2fr_auto] md:items-end">
          <label className="sj-field"><span>Nama shift / serah terima</span><input value={shiftName} onChange={(event) => setShiftName(event.target.value)} maxLength={160} placeholder="Contoh: Serah terima shift sore" /></label>
          <label className="sj-field"><span>Petugas penerima (on-duty)</span><select value={incomingStaffId} onChange={(event) => setIncomingStaffId(event.target.value)} disabled={!onDutyCaregivers.length}><option value="">{onDutyCaregivers.length ? 'Pilih petugas penerima' : 'Belum ada petugas penerima yang aktif'}</option>{onDutyCaregivers.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
          <button type="button" onClick={handleCreateContract} disabled={isCreating || !incomingStaffId || !currentUser?.id} className="sj-primary-button md:min-w-48 disabled:cursor-not-allowed disabled:opacity-50">{isCreating ? <RefreshCw size={17} className="animate-spin" /> : <Plus size={17} />} Buat draf kontrak</button>
        </div>
        <p className="text-[10px] text-slate-500">Membuat draf belum berarti tanda tangan sudah dilakukan. Pengirim dan penerima masing-masing perlu mengonfirmasi melalui akun mereka sendiri.</p>
      </section>

      <div className="flex items-center justify-between gap-3"><div><span className="sj-eyebrow">RIWAYAT KONTRAK</span><h2 className="mt-1 text-base font-extrabold text-slate-800">Daftar serah terima</h2></div><span className="text-[10px] text-slate-400">{activeContracts.length} kontrak</span></div>

      {activeContracts.length === 0 ? (
        <div className="sj-empty-state"><FileCheck size={28} /><h3>Belum ada kontrak</h3><p>Buat draf di atas untuk memulai serah terima dari data tugas yang tersedia.</p></div>
      ) : (
        <div className="space-y-4">{activeContracts.map((contract) => <HandoverContractCard key={contract.id} contract={contract} onSignContract={onSignContract} currentUserRole={currentUserRole} currentUser={currentUser} staff={staff} obligations={obligations} />)}</div>
      )}
    </div>
  );
}
