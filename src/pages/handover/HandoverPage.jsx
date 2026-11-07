import React, {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  FileSignature,
  ShieldCheck,
  CheckCircle2,
  Plus,
  FileCheck,
  Clock,
  LockKeyhole,
  RefreshCw
} from 'lucide-react';

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

  const activeContracts = handoverContracts;

  const currentStaffProfileId =
    currentUser?.staff_id ||
    currentUser?.staffProfileId ||
    currentUser?.id ||
    null;

  const pendingCount = activeContracts.filter(
    (contract) =>
      contract.contract_status !== 'confirmed'
  ).length;

  const confirmedCount = activeContracts.filter(
    (contract) =>
      contract.contract_status === 'confirmed'
  ).length;

  const openObligationsCount = obligations.filter(
    (item) =>
      item.assigned_caregiver_id === currentStaffProfileId &&
      ['open', 'in_progress', 'escalated'].includes(item.status)
  ).length;

  const onDutyCaregivers = useMemo(
    () =>
      staff.filter(
        (person) =>
          person.role === 'caregiver' &&
          person.shift_status === 'on_duty' &&
          person.id !== currentStaffProfileId
      ),
    [staff, currentStaffProfileId]
  );

  const digestCount = activeContracts.filter(
    (contract) =>
      /^[a-f0-9]{64}$/i.test(contract.hash_signature || '')
  ).length;

  /*
   * Keep recipient selection valid.
   */

  useEffect(() => {
    if (
      !onDutyCaregivers.some(
        (person) => person.id === incomingStaffId
      )
    ) {
      setIncomingStaffId(
        onDutyCaregivers[0]?.id || ''
      );
    }
  }, [
    onDutyCaregivers,
    incomingStaffId
  ]);

  /*
   * Create contract.
   */

  const handleCreateContract = async () => {
    if (
      isCreating ||
      !incomingStaffId ||
      !String(shiftName || '').trim() ||
      typeof onCreateContract !== 'function'
    ) {
      setToastMessage(
        'Nama shift dan petugas penerima wajib dipilih.'
      );
      return;
    }

    if (!currentUser?.id && !currentUser?.staff_id) {
      setToastMessage(
        'Profil petugas yang sedang login tidak tersedia.'
      );
      return;
    }

    setIsCreating(true);
    setToastMessage('');

    try {
      const result = await onCreateContract({
        incomingStaffId,
        shiftName,

        // Keep both aliases for existing call sites.
        incoming_staff_id: incomingStaffId,
        shift_name: shiftName
      });

      setToastMessage(
        result?.success
          ? result.message || 'Draf kontrak berhasil dibuat.'
          : result?.error || 'Kontrak belum tersimpan.'
      );

      if (result?.success) {
        setShiftName('');
      }

    } catch (error) {
      setToastMessage(
        error?.message ||
        'Gagal membuat kontrak serah terima.'
      );

    } finally {
      setIsCreating(false);
    }

    window.setTimeout(
      () => setToastMessage(''),
      6500
    );
  };

  return (
    <div className="w-full space-y-6 text-left font-sans">

      {/* Header */}

      <header className="sj-page-intro">
        <div>
          <span className="sj-eyebrow">
            KOORDINASI ANTAR-SHIFT • TWO-SIDED HANDOVER CONTRACT AGENT
          </span>

          <h1>Serah Terima Shift</h1>

          <p>
            Buat kontrak berdasarkan tugas aktif, lalu minta pengirim dan penerima menandatangani dari akun masing-masing.
          </p>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-xs">
          <LockKeyhole size={15} />
          Tanda tangan per akun
        </span>
      </header>

      {/* Notification */}

      {toastMessage && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-xs font-semibold text-emerald-900 shadow-xs"
        >
          <span>{toastMessage}</span>

          <button
            type="button"
            onClick={() => setToastMessage('')}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
            aria-label="Tutup pesan"
          >
            ×
          </button>
        </div>
      )}

      {/* Metrics */}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <article className="sj-metric-card group">
          <div className="flex items-center justify-between">
            <span>Kontrak tercatat</span>

            <div className="p-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-100/80 group-hover:bg-sky-100 transition-colors">
              <FileCheck size={18} />
            </div>
          </div>

          <strong>{activeContracts.length}</strong>

          <small>Data database</small>
        </article>

        <article className="sj-metric-card group">
          <div className="flex items-center justify-between">
            <span>Menunggu tanda tangan</span>

            <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100/80 group-hover:bg-amber-100 transition-colors">
              <Clock size={18} />
            </div>
          </div>

          <strong>{pendingCount}</strong>

          <small>Belum terkonfirmasi</small>
        </article>

        <article className="sj-metric-card group">
          <div className="flex items-center justify-between">
            <span>Terkonfirmasi</span>

            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100/80 group-hover:bg-emerald-100 transition-colors">
              <CheckCircle2 size={18} />
            </div>
          </div>

          <strong>{confirmedCount}</strong>

          <small>Kedua pihak menandatangani</small>
        </article>

        <article className="sj-metric-card group">
          <div className="flex items-center justify-between">
            <span>SHA-256 tersedia</span>

            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100/80 group-hover:bg-indigo-100 transition-colors">
              <ShieldCheck size={18} />
            </div>
          </div>

          <strong>
            {digestCount}/{activeContracts.length}
          </strong>

          <small>Digest dibuat database</small>
        </article>

      </section>

      {/* Create Contract */}

      <section className="sj-work-card space-y-5 p-5 sm:p-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">

          <div className="flex items-start gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-2xs">
              <FileSignature size={22} />
            </span>

            <div>
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Buat Kontrak Serah Terima
              </h2>

              <p className="mt-1 text-xs leading-relaxed text-slate-500 max-w-2xl">
                Autonomous Handover Agent mengambil tugas terbuka, memetakan risiko, memeriksa bukti, dan mencocokkan petugas penerima.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const dateStr = new Date().toLocaleDateString(
                'id-ID',
                {
                  day: 'numeric',
                  month: 'short'
                }
              );

              setShiftName(
                `Serah Terima Otonom Shift ${dateStr}`
              );

              if (onDutyCaregivers[0]?.id) {
                setIncomingStaffId(
                  onDutyCaregivers[0].id
                );
              }

              setToastMessage(
                'Draf awal disiapkan. Periksa nama shift dan tugas sebelum menyimpan.'
              );
            }}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/90 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
          >
            ⚡ Siapkan Draf Shift
          </button>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">

          <label className="sj-field md:col-span-5">
            <span>Nama shift / serah terima</span>

            <input
              value={shiftName}
              onChange={(event) =>
                setShiftName(event.target.value)
              }
              maxLength={160}
              placeholder="Contoh: Serah terima shift sore"
            />
          </label>

          <label className="sj-field md:col-span-4">
            <span>Petugas penerima (on-duty)</span>

            <select
              value={incomingStaffId}
              onChange={(event) =>
                setIncomingStaffId(event.target.value)
              }
              disabled={!onDutyCaregivers.length}
            >
              <option value="">
                {onDutyCaregivers.length
                  ? 'Pilih petugas penerima'
                  : 'Belum ada petugas penerima yang aktif'
                }
              </option>

              {onDutyCaregivers.map((person) => (
                <option
                  key={person.id}
                  value={person.id}
                >
                  {person.full_name}
                </option>
              ))}
            </select>
          </label>

          <div className="md:col-span-3">
            <button
              type="button"
              onClick={handleCreateContract}
              disabled={
                isCreating ||
                !incomingStaffId ||
                !String(shiftName || '').trim() ||
                (!currentUser?.id && !currentUser?.staff_id)
              }
              className="sj-primary-button w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating
                ? <RefreshCw size={17} className="animate-spin" />
                : <Plus size={17} />
              }

              Buat draf kontrak
            </button>
          </div>

        </div>

        <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500 bg-slate-50/80 px-3.5 py-2.5 rounded-xl border border-slate-200/60">
          <LockKeyhole size={14} className="text-slate-400 shrink-0" />

          <span>
            Membuat draf belum berarti tanda tangan sudah dilakukan. Pengirim dan penerima masing-masing perlu mengonfirmasi melalui akun mereka sendiri.
          </span>
        </div>

      </section>

      {/* Contract History */}

      <div className="space-y-4 pt-2">

        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="sj-eyebrow">
              RIWAYAT KONTRAK
            </span>

            <h2 className="mt-0.5 text-base font-extrabold text-slate-900 tracking-tight">
              Daftar serah terima
            </h2>
          </div>

          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 border border-slate-200/80">
            {activeContracts.length} kontrak
          </span>
        </div>

        {activeContracts.length === 0 ? (
          <div className="sj-empty-state">
            <FileCheck size={32} />

            <h3>Belum ada kontrak</h3>

            <p>
              Buat draf di atas untuk memulai serah terima dari data tugas yang tersedia.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeContracts.map((contract) => (
              <HandoverContractCard
                key={contract.id}
                contract={contract}
                onSignContract={onSignContract}
                currentUserRole={currentUserRole}
                currentUser={currentUser}
                staff={staff}
                obligations={obligations}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}