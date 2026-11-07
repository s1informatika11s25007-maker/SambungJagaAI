import React, {
  useState,
  useEffect
} from 'react';

import {
  FileCheck,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  UserCheck,
  Volume2,
  Download,
  ShieldAlert,
  Activity
} from 'lucide-react';

import Badge from '../common/Badge';

import {
  runHandoverAnalysis
} from '../../services/handover/handoverContractService';

import {
  speakTextNative,
  exportCareEvidencePackNative
} from '../../services/ai/nativeChromeService';


export default function HandoverContractCard({
  contract,
  onSignContract,
  currentUserRole,
  currentUser,
  staff = [],
  obligations = []
}) {
  const isConfirmed =
    contract.contract_status === 'confirmed';

  const currentStaffProfileId =
    currentUser?.staff_id ||
    currentUser?.staffProfileId ||
    currentUser?.id ||
    null;

  /*
   * Signing is enabled only for the authenticated staff account
   * assigned to the relevant side.
   */

  const signerRole =
    !contract.outgoing_signed_at &&
    currentStaffProfileId === contract.outgoing_staff_id
      ? 'outgoing'
      : contract.outgoing_signed_at &&
        !contract.incoming_signed_at &&
        currentStaffProfileId === contract.incoming_staff_id
          ? 'incoming'
          : null;

  const [isSigning, setIsSigning] = useState(false);
  const [signMessage, setSignMessage] = useState('');

  const outgoingStaff = staff.find(
    (person) =>
      person.id === contract.outgoing_staff_id
  );

  const incomingStaff = staff.find(
    (person) =>
      person.id === contract.incoming_staff_id
  );

  const outgoingName =
    outgoingStaff?.full_name ||
    'Profil pengirim tidak tersedia';

  const incomingName =
    incomingStaff?.full_name ||
    'Profil penerima tidak tersedia';

  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const [exportStatus, setExportStatus] = useState(null);

  const contractObligations =
    contract.open_obligations_summary || [];

  /*
   * Load handover analysis.
   */

  useEffect(() => {
    let isMounted = true;

    async function fetchAiAnalysis() {
      setIsLoadingAi(true);

      try {
        const result = await runHandoverAnalysis(
          contract,
          outgoingStaff,
          incomingStaff,
          contractObligations
        );

        if (isMounted) {
          setAiAnalysis(result);
        }

      } catch (error) {
        console.warn(
          '[Handover] Analysis unavailable:',
          error
        );

      } finally {
        if (isMounted) {
          setIsLoadingAi(false);
        }
      }
    }

    fetchAiAnalysis();

    return () => {
      isMounted = false;
    };
  }, [
    contract.id,
    contract.contract_status
  ]);

  /*
   * Sign contract.
   *
   * Correct signature:
   * onSignContract(contractId, signerRole)
   */

  const handleSign = async () => {
    if (
      !signerRole ||
      isSigning ||
      typeof onSignContract !== 'function'
    ) {
      return;
    }

    setIsSigning(true);
    setSignMessage('');

    try {
      const result = await onSignContract(
        contract.id,
        signerRole
      );

      setSignMessage(
        result?.success
          ? result.message || 'Tanda tangan tersimpan.'
          : result?.error || 'Tanda tangan belum tercatat.'
      );

    } catch (error) {
      setSignMessage(
        error?.message ||
        'Gagal menandatangani kontrak.'
      );

    } finally {
      setIsSigning(false);
    }
  };

  /*
   * Read summary aloud.
   */

  const handleSpeakSummary = () => {
    if (aiAnalysis?.summaryAnalysis) {
      speakTextNative(
        `Ringkasan Serah Terima Shift: ${aiAnalysis.summaryAnalysis}`
      );
    } else {
      speakTextNative(
        `Kontrak serah terima shift ${contract.shift_name} antara ${outgoingName} dan ${incomingName}.`
      );
    }
  };

  /*
   * Export evidence package.
   */

  const handleExportEvidencePack = async () => {
    setExportStatus('Menyiapkan...');

    const validDigest =
      /^[a-f0-9]{64}$/i.test(
        contract.hash_signature || ''
      );

    const evidencePack = {
      system:
        'SambungJaga Agent Otorisasi Shift',

      contract_id:
        contract.id,

      shift_name:
        contract.shift_name,

      outgoing_staff:
        outgoingName,

      incoming_staff:
        incomingName,

      status:
        contract.contract_status,

      clinical_analysis:
        aiAnalysis,

      obligations_transferred:
        contractObligations,

      exported_by:
        currentUser?.full_name ||
        currentUser?.name ||
        'Pengguna terautentikasi',

      exported_at:
        new Date().toISOString(),

      integrity_digest:
        validDigest
          ? contract.hash_signature
          : null,

      integrity_status:
        validDigest
          ? 'database_digest_available'
          : 'not_available'
    };

    try {
      const result = await exportCareEvidencePackNative(
        evidencePack,

        `Evidence_Pack_${String(
          contract.shift_name || 'Shift'
        ).replace(/[^a-zA-Z0-9]/g, '_')}.json`
      );

      setExportStatus(
        result?.success
          ? 'Terunduh!'
          : 'Gagal ekspor'
      );

    } catch {
      setExportStatus('Gagal ekspor');
    }

    window.setTimeout(
      () => setExportStatus(null),
      3000
    );
  };

  const validDigest =
    /^[a-f0-9]{64}$/i.test(
      contract.hash_signature || ''
    );

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 space-y-3.5 text-left font-sans">

      {/* Header */}

      <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
        <div className="flex items-center space-x-2">

          <div className="p-2 bg-sky-50 text-sky-700 rounded-xl border border-sky-200/80">
            <FileCheck className="w-4 h-4" />
          </div>

          <div>
            <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm tracking-tight">
              {contract.shift_name}
            </h3>

            <p className="text-[10px] text-slate-500 font-mono">
              ID: {contract.id} • SHA-256:{' '}
              {validDigest
                ? `${contract.hash_signature.slice(0, 16)}…`
                : 'belum tersedia'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-1">

          <button
            type="button"
            onClick={handleSpeakSummary}
            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200 flex items-center space-x-1 transition"
          >
            <Volume2 className="w-3.5 h-3.5 text-sky-600" />
            <span>Suara Shift</span>
          </button>

          <button
            type="button"
            onClick={handleExportEvidencePack}
            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-200 flex items-center space-x-1 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>{exportStatus || 'Ekspor Evidence Pack'}</span>
          </button>

          <Badge
            variant={isConfirmed ? 'success' : 'warning'}
          >
            {isConfirmed
              ? 'TERKONFIRMASI'
              : 'MENUNGGU VERIFIKASI'
            }
          </Badge>

        </div>
      </div>

      {/* Two-sided signature */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center bg-slate-50/90 p-3.5 rounded-xl border border-slate-200">

        <div className="space-y-0.5">
          <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider block">
            Pengirim
          </span>

          <p className="text-xs font-bold text-slate-900">
            {outgoingName}
          </p>

          <span
            className={`text-[10px] font-medium flex items-center pt-0.5 ${
              contract.outgoing_signed_at
                ? 'text-emerald-700'
                : 'text-amber-700'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 mr-1 shrink-0" />

            {contract.outgoing_signed_at
              ? `Ditandatangani: ${new Date(contract.outgoing_signed_at).toLocaleString('id-ID')}`
              : 'Menunggu tanda tangan pengirim'
            }
          </span>
        </div>

        <div className="flex flex-col items-center justify-center text-slate-400 my-1 sm:my-0">

          <div className="hidden sm:flex items-center space-x-1 px-2 py-0.5 bg-sky-100 text-sky-800 rounded-full border border-sky-200 text-[10px] font-extrabold">
            <FileCheck className="w-3 h-3 text-sky-600" />
            <span>Ringkasan tugas</span>
          </div>

          <ArrowRight className="w-4 h-4 text-sky-600 hidden sm:block mt-1" />
        </div>

        <div className="space-y-0.5">
          <span className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider block">
            Penerima
          </span>

          <p className="text-xs font-bold text-slate-900">
            {incomingName}
          </p>

          {isConfirmed ? (
            <span className="text-[10px] text-emerald-700 font-medium flex items-center pt-0.5">
              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600 shrink-0" />

              Ditandatangani:{' '}
              {contract.incoming_signed_at
                ? new Date(contract.incoming_signed_at).toLocaleString('id-ID')
                : 'Waktu tidak tersedia'
              }
            </span>
          ) : (
            <span className="text-[10px] text-amber-800 font-semibold flex items-center pt-0.5">
              <ShieldAlert className="w-3 h-3 mr-1 text-amber-600 shrink-0" />

              {contract.outgoing_signed_at
                ? 'Menunggu tanda tangan penerima'
                : 'Menunggu pengirim menandatangani'
              }
            </span>
          )}
        </div>

      </div>

      {/* AI analysis */}

      {isLoadingAi && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Activity className="w-4 h-4 animate-spin" />
          Menganalisis ringkasan tugas...
        </div>
      )}

      {aiAnalysis && (
        <div className="p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 space-y-1">

          <div className="flex items-center justify-between">

            <div className="flex items-center space-x-2 font-bold text-xs text-sky-300">
              <ShieldCheck className="w-4 h-4 text-sky-400" />

              <span>
                {aiAnalysis.source === 'local_workload_summary'
                  ? 'Ringkasan tugas lokal'
                  : 'Analisis layanan serah terima'
                }
              </span>
            </div>

            <span
              className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase font-mono ${
                aiAnalysis.riskLevel === 'HIGH'
                  ? 'bg-rose-500 text-white'
                  : aiAnalysis.riskLevel === 'MEDIUM'
                    ? 'bg-amber-500 text-slate-950'
                    : aiAnalysis.riskLevel === 'UNASSESSED'
                      ? 'bg-slate-600 text-white'
                      : 'bg-emerald-500 text-slate-950'
              }`}
            >
              Risiko: {aiAnalysis.riskLevel || 'UNASSESSED'}
            </span>

          </div>

          <p className="text-[11px] leading-relaxed text-slate-200 font-normal pt-0.5">
            {aiAnalysis.summaryAnalysis}
          </p>

          {aiAnalysis.criticalNotes?.length > 0 && (
            <div className="text-[10px] text-amber-300 pt-1 font-mono font-medium border-t border-slate-800/80 mt-1">
              • {aiAnalysis.criticalNotes.join(' • ')}
            </div>
          )}

        </div>
      )}

      {/* Transferred obligations */}

      <div>
        <div className="flex items-center justify-between mb-1.5">

          <h4 className="text-xs font-bold text-slate-800 tracking-tight">
            Kewajiban Perawatan yang Diserahterimakan ({contractObligations.length}):
          </h4>

          <span className="text-[10px] text-slate-500 font-medium">
            Snapshot saat kontrak dibuat
          </span>
        </div>

        <div className="space-y-1.5">

          {contractObligations.length === 0 ? (
            <div className="p-2.5 bg-slate-50 text-slate-500 text-xs text-center rounded-lg border border-slate-200">
              Tidak ada tugas terbuka yang tercatat untuk pengirim pada saat draf dibuat.
            </div>
          ) : (
            contractObligations.map((obligation, index) => (
              <div
                key={obligation.id || index}
                className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs font-medium hover:bg-slate-100/80 transition"
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <Activity className="w-3.5 h-3.5 text-sky-600 shrink-0" />

                  <span className="text-slate-900 font-bold truncate">
                    {obligation.title}
                  </span>

                  {obligation.resident_name && (
                    <span className="text-[10px] text-slate-500 font-normal shrink-0">
                      ({obligation.resident_name})
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2 shrink-0 ml-2">

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      obligation.priority === 'critical' ||
                      obligation.priority === 'emergency'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-sky-100 text-sky-800 border border-sky-300'
                    }`}
                  >
                    {obligation.priority || 'routine'}
                  </span>

                  <span className="text-[10px] font-mono bg-slate-200 text-slate-800 px-2 py-0.5 rounded border border-slate-300 font-bold">
                    Grade {obligation.grade || obligation.required_evidence_grade || 'E1'}
                  </span>
                </div>
              </div>
            ))
          )}

        </div>
      </div>

      {/* Account-bound signature */}

      {!isConfirmed && signerRole && (
        <div className="border-t border-slate-100 pt-3">

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

            <p className="text-[11px] text-slate-500">
              Anda masuk sebagai {signerRole === 'outgoing' ? 'pengirim' : 'penerima'} yang terdaftar pada kontrak ini.
            </p>

            <button
              type="button"
              onClick={handleSign}
              disabled={isSigning}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50"
            >
              {isSigning
                ? <Activity className="h-4 w-4 animate-spin" />
                : <UserCheck className="h-4 w-4" />
              }

              {isSigning
                ? 'Menyimpan tanda tangan…'
                : signerRole === 'incoming'
                  ? 'Konfirmasi & Tanda Tangan Penerima Shift'
                  : 'Konfirmasi & Tanda Tangan Pengirim Shift'
              }
            </button>

          </div>

          {signMessage && (
            <p
              role="status"
              className="mt-2 text-[11px] text-slate-600"
            >
              {signMessage}
            </p>
          )}

        </div>
      )}

    </div>
  );
}