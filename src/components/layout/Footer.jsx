import React from 'react';
import { Heart, ShieldCheck } from 'lucide-react';

export default function Footer({ onGoToLanding, compact = false }) {
  if (compact) {
    return (
      <footer className="w-full mt-auto px-4 sm:px-8 py-5 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-6xl mx-auto">
        <span>© {new Date().getFullYear()} SambungJaga</span>
        <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Akses mengikuti kebijakan akun dan fasilitas</span>
      </footer>
    );
  }

  return (
    <footer className="border-t border-slate-200/70 bg-white/80 text-slate-500 w-full mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-9 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <button type="button" onClick={onGoToLanding} className="flex items-center gap-2 text-left">
          <Heart className="w-5 h-5 text-emerald-700 fill-emerald-700" />
          <span className="text-base font-extrabold text-slate-900 tracking-tight">Sambung<span className="text-emerald-700">Jaga</span></span>
        </button>
        <p className="max-w-lg text-xs leading-relaxed">Platform koordinasi perawatan lansia yang membantu menjaga kesinambungan informasi, tugas, dan serah terima antarperan.</p>
        <span className="flex items-center gap-1.5 text-xs"><ShieldCheck className="w-4 h-4 text-emerald-700" /> Human-reviewed care workflows</span>
      </div>
      <div className="border-t border-slate-100 py-4 px-6 max-w-6xl mx-auto text-center text-[10px] text-slate-400">© {new Date().getFullYear()} SambungJaga. Informasi hanya tersedia sesuai hak akses yang diberikan.</div>
    </footer>
  );
}
