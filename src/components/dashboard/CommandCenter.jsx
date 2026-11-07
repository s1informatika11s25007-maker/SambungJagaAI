import React, { useState } from 'react';
import { Send, Loader2, Check, AlertCircle, Activity, ShieldCheck } from 'lucide-react';
import OperationalHealthCenter from './OperationalHealthCenter';
import AutonomousSupervisorCenterModal from './AutonomousSupervisorCenterModal';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 19) return 'Selamat sore';
  return 'Selamat malam';
};

/**
 * One place to act: a single command box (laporan / perintah bebas → Superagent)
 * plus one-tap Autopilot, Operational Health Center, and Supervisor Intelligence Center.
 */
export default function CommandCenter({
  activeRole, currentUser, obligations = [], residents = [], staff = [],
  autopilotPlan = [], onRunAutopilot, onCommand
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(null); // 'cmd' | 'auto'
  const [feedback, setFeedback] = useState(null);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);

  const safeObligations = Array.isArray(obligations) ? obligations : [];
  const safeResidents = Array.isArray(residents) ? residents : [];
  const safeStaff = Array.isArray(staff) ? staff : [];
  const safeAutopilotPlan = Array.isArray(autopilotPlan) ? autopilotPlan : [];

  const name = currentUser?.name || currentUser?.full_name || '';
  const open = safeObligations.filter((o) => o.status === 'open' || o.status === 'in_progress');
  const done = safeObligations.filter((o) => o.status === 'verified_closed');
  const urgent = open.filter((o) => o.priority === 'critical' || o.priority === 'emergency');
  const canCommand = activeRole !== 'family' && typeof onCommand === 'function';

  const stats = [
    ['Tugas aktif', open.length, `${done.length} selesai`],
    ['Perlu perhatian', urgent.length, urgent.length ? 'prioritas tinggi' : 'tidak ada'],
    ['Penghuni', safeResidents.length, 'terdaftar'],
  ];

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy('cmd');
    try {
      const res = await onCommand(text.trim());
      setFeedback({ ok: res?.success !== false, msg: res?.message || res?.error || 'Laporan dipproses.' });
      if (res?.success !== false) setText('');
    } catch (err) {
      setFeedback({ ok: false, msg: 'Gagal memproses. Coba lagi.' });
    } finally { setBusy(null); }
  };

  const runAuto = async () => {
    setBusy('auto');
    try {
      const out = await onRunAutopilot();
      setFeedback({ ok: out.success, msg: out.summary });
    } catch (err) {
      setFeedback({ ok: false, msg: 'Autopilot gagal dijalankan.' });
    } finally { setBusy(null); }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="text-left space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              {greeting()}{name ? `, ${name}` : ''}
            </h2>
            <button
              type="button"
              onClick={() => setShowHealthModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 text-xs font-medium font-mono transition shadow-sm"
              title="Buka Operational Health Center"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>Health 24/7</span>
            </button>

            {(activeRole === 'supervisor' || activeRole === 'admin_hr') && (
              <button
                type="button"
                onClick={() => setShowSupervisorModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-800 text-xs font-medium font-mono transition shadow-sm"
                title="Buka Autonomous Supervisor Intelligence Center"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                <span>Supervisor Review Inbox</span>
              </button>
            )}
          </div>
          <p className="text-sm text-slate-500">Ketik satu kalimat — sisanya diurus Superagent.</p>
        </div>
        <dl className="flex gap-6 text-left">
          {stats.map(([label, value, hint]) => (
            <div key={label}>
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="text-xl font-semibold text-slate-900 tabular-nums leading-tight">{value}</dd>
              <span className="text-xs text-slate-400">{hint}</span>
            </div>
          ))}
        </dl>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 p-3 sm:p-4 space-y-3" aria-live="polite">
        <div className="flex flex-col sm:flex-row gap-3">
          {canCommand && (
            <form onSubmit={submit} className="flex-1 flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 px-3 focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-100 transition">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Contoh: Ibu Aminah suhu 38,5 dan muntah — buat tugas & beri tahu supervisor"
                aria-label="Perintah Superagent"
                className="flex-1 bg-transparent py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none border-0 focus:ring-0 focus:shadow-none"
              />
              <button type="submit" disabled={!text.trim() || busy} aria-label="Kirim perintah" className="p-2 rounded-lg text-sky-700 hover:bg-sky-100 transition">
                {busy === 'cmd' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          )}
          {activeRole !== 'family' && (
            <button
              type="button"
              onClick={runAuto}
              disabled={!!busy || safeAutopilotPlan.length === 0}
              title={safeAutopilotPlan.map((s) => s.label).join(' · ') || 'Tidak ada aksi tertunda (Autopilot Latar Belakang Aktif)'}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition shrink-0"
            >
              {busy === 'auto' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {safeAutopilotPlan.length ? `Jalankan Autopilot (${safeAutopilotPlan.length})` : 'Autopilot Aktif (24/7)'}
            </button>
          )}
        </div>

        {safeAutopilotPlan.length > 0 && !feedback && (
          <p className="text-xs text-slate-500 px-1">Siap sekali tekan: {safeAutopilotPlan.map((s) => s.label).join(' · ')}</p>
        )}
        {feedback && (
          <p className={`text-sm px-1 flex items-start gap-2 ${feedback.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
            {feedback.ok ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>{feedback.msg}</span>
          </p>
        )}
      </div>

      {/* Modals */}
      <OperationalHealthCenter isOpen={showHealthModal} onClose={() => setShowHealthModal(false)} />
      <AutonomousSupervisorCenterModal
        isOpen={showSupervisorModal}
        onClose={() => setShowSupervisorModal(false)}
        obligations={safeObligations}
        residents={safeResidents}
        staff={safeStaff}
      />
    </section>
  );
}

