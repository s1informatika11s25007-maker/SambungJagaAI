import React from 'react';
import { Clock, User, AlertOctagon, GitCommit } from 'lucide-react';
import Badge from '../common/Badge';

export default function ObligationGraphCard({ obligation, onOpenEvidenceModal, onOpenTraceModal, onApproveAction, currentUserRole }) {
  const isExpired = new Date() > new Date(obligation.valid_until);
  const isClosed = obligation.status === 'verified_closed';
  const isNegative = obligation.is_negative_obligation;

  return (
    <div className={`p-4 rounded-2xl border transition-all ${
      isClosed
        ? 'bg-slate-50/80 border-slate-200 opacity-80'
        : isNegative
        ? 'bg-rose-50/70 border-rose-300 shadow-md shadow-rose-100'
        : obligation.priority === 'critical'
        ? 'bg-amber-50/70 border-amber-300 shadow-md shadow-amber-100'
        : 'bg-white border-slate-200/90 hover:border-sky-300 shadow-md shadow-slate-200/50'
    }`}>
      {/* Header Badges */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center space-x-2">
          {isNegative ? (
            <Badge variant="danger" className="flex items-center space-x-1">
              <AlertOctagon className="w-3 h-3 mr-1" /> Negative Obligation
            </Badge>
          ) : (
            <Badge variant={obligation.priority === 'critical' ? 'danger' : 'info'}>
              Prioritas: {obligation.priority.toUpperCase()}
            </Badge>
          )}

          <Badge variant="kernel" className="font-mono text-[10px]">
            Bukti {obligation.required_evidence_grade}
          </Badge>
        </div>

        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
          isClosed
            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
            : isExpired
            ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
            : 'bg-sky-100 text-sky-800 border-sky-300'
        }`}>
          {isClosed ? 'VERIFIED CLOSED' : isExpired ? 'EXPIRED (CARE DEBT)' : 'OPEN / ACTIVE'}
        </span>
      </div>

      {/* Title & Description */}
      <h4 className="text-sm font-bold text-slate-900 mb-1 leading-snug">{obligation.title}</h4>
      <p className="text-xs text-slate-600 line-clamp-2 mb-3">{obligation.description}</p>

      {/* Patient & Caregiver Meta */}
      <div className="grid grid-cols-2 gap-2 py-2 px-3 bg-slate-50 rounded-xl border border-slate-200 text-xs mb-3">
        <div>
          <span className="text-[10px] text-slate-500 block font-medium">Penghuni / Pasien</span>
          <span className="text-slate-800 font-bold truncate block">{obligation.resident_name}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 block font-medium">Penanggung Jawab</span>
          <span className="text-slate-800 font-bold truncate block flex items-center">
            <User className="w-3 h-3 mr-1 text-sky-600 shrink-0" />
            {obligation.assigned_caregiver_name}
          </span>
        </div>
      </div>

      {/* Bitemporal Period & Kernel Version Footer */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2.5">
        <div className="flex items-center space-x-1 font-mono font-medium">
          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Valid s/d: {new Date(obligation.valid_until).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => onOpenTraceModal?.(obligation)}
            className="text-xs text-sky-600 hover:text-sky-800 flex items-center space-x-1 font-bold hover:underline cursor-pointer"
          >
            <GitCommit className="w-3.5 h-3.5" />
            <span>Trace</span>
          </button>

          {!isClosed && (
            <button
              type="button"
              onClick={() => onOpenEvidenceModal?.(obligation)}
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs px-2.5 py-1 rounded-lg font-semibold shadow-sm transition cursor-pointer"
            >
              Tutup Misi (P2)
            </button>
          )}

          {obligation.priority === 'critical' && !isClosed && currentUserRole === 'supervisor' && (
            <button
              type="button"
              onClick={() => onApproveAction?.(obligation.id)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-2 py-1 rounded-lg font-semibold transition cursor-pointer"
            >
              A3 Human Approval
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
