import React, { useEffect, useState } from 'react';
import {
  Heart, LockKeyhole, Mail, ArrowRight, ArrowLeft, ShieldCheck,
  Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, UserRound
} from 'lucide-react';
import { signInWithEmailPassword, getAuthErrorMessage } from '../../services/auth/authService';
import { fetchDemoAccountsPerRole, ROLE_LABELS } from '../../services/dashboard/staffService';

export default function LoginPage({ onLoginSuccess, onGoToRegister, onGoToLanding }) {
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [selectedAccountKey, setSelectedAccountKey] = useState('manual');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isFetchingAccounts, setIsFetchingAccounts] = useState(true);
  const [accountsError, setAccountsError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    async function loadDemoAccounts() {
      setIsFetchingAccounts(true);
      setAccountsError('');
      try {
        const accounts = await fetchDemoAccountsPerRole();
        if (active) setDemoAccounts(accounts);
      } catch (loadError) {
        if (active) {
          setDemoAccounts([]);
          setAccountsError('Dropdown demo belum dapat dimuat. Pastikan migration list_demo_login_accounts sudah diterapkan; login email tetap tersedia.');
        }
      } finally {
        if (active) setIsFetchingAccounts(false);
      }
    }
    loadDemoAccounts();
    return () => { active = false; };
  }, []);

  const handleAccountChange = (accountKey) => {
    setSelectedAccountKey(accountKey);
    setError('');
    setSuccess('');

    if (accountKey === 'manual') {
      setEmail('');
      setPassword('');
      return;
    }

    const account = demoAccounts.find((item) => item.key === accountKey);
    if (account) {
      setEmail(account.email || '');
      setPassword(account.password || 'SambungJaga2026!');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsLoggingIn(true);
    try {
      // Demo selection only pre-fills the verified email address. Every account,
      // including a demo account, must authenticate with its real Supabase password.
      const account = await signInWithEmailPassword(email, password);
      setSuccess('Identitas terverifikasi. Menyiapkan ruang kerja…');
      onLoginSuccess(account.role, account);
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const manualMode = selectedAccountKey === 'manual';

  return (
    <main className="sj-auth-shell">
      <section className="sj-auth-visual sj-auth-visual-login">
        <img
          src="/Tua.jpeg"
          onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/Orangtua.jpeg'; }}
          alt="Pemandangan kegiatan perawatan lansia"
          className="sj-auth-photo"
        />
        <div className="sj-auth-visual-top">
          <button type="button" onClick={onGoToLanding} className="sj-brand-lockup sj-brand-light">
            <span className="sj-brand-mark"><Heart size={21} fill="currentColor" /></span>
            <span><strong>Sambung<span>Jaga</span></strong><small>Care continuity platform</small></span>
          </button>
          <button type="button" onClick={onGoToLanding} className="sj-back-link"><ArrowLeft size={16} /> Beranda</button>
        </div>
        <div className="sj-auth-story animate-fade-up">
          <span className="sj-eyebrow sj-eyebrow-light"><ShieldCheck size={14} /> PERAWATAN TERHUBUNG</span>
          <h1>Setiap pergantian tugas, tetap <em>tersambung.</em></h1>
          <p>Satukan laporan, tugas perawatan, bukti, dan koordinasi tim dalam satu alur kerja yang mudah ditelusuri.</p>
          <div className="sj-trust-list">
            <div><ShieldCheck size={17} /><span>Identitas diverifikasi melalui Supabase Auth</span></div>
            <div><CheckCircle2 size={17} /><span>Aktivitas penting memiliki jejak audit</span></div>
            <div><LockKeyhole size={17} /><span>Akses mengikuti peran akun Anda</span></div>
          </div>
        </div>
        <div className="sj-auth-visual-footer"><span>Ruang kerja perawatan yang lebih teratur.</span><span>01 / 03</span></div>
      </section>

      <section className="sj-auth-panel">
        <div className="sj-auth-panel-inner animate-fade-up">
          <div className="sj-auth-mobile-brand sj-brand-lockup">
            <span className="sj-brand-mark"><Heart size={20} fill="currentColor" /></span>
            <span><strong>Sambung<span>Jaga</span></strong><small>Care continuity platform</small></span>
          </div>
          <div className="sj-auth-heading">
            <span className="sj-eyebrow">SELAMAT DATANG KEMBALI</span>
            <h2>Masuk ke akun Anda</h2>
            <p>Pilih akun demo dari database atau masukkan email dan kata sandi akun Anda.</p>
          </div>

          <form onSubmit={handleSubmit} className="sj-auth-form">
            <label className="sj-field">
              <span><UserRound size={15} /> Pilih akun demo</span>
              <select value={selectedAccountKey} onChange={(event) => handleAccountChange(event.target.value)} disabled={isFetchingAccounts}>
                <option value="manual">Masuk dengan email sendiri</option>
                {demoAccounts.map((account) => (
                  <option key={account.key} value={account.key}>
                    {account.name} — {ROLE_LABELS[account.role] || account.roleTitle}
                  </option>
                ))}
                {!isFetchingAccounts && demoAccounts.length === 0 && (
                  <option value="no-demo" disabled>Belum ada akun demo yang diaktifkan admin</option>
                )}
              </select>
              <small>
                {isFetchingAccounts
                  ? 'Memuat akun demo dari database…'
                  : accountsError || (demoAccounts.length > 0
                    ? 'Akun demo diambil langsung dari database. Email dan kata sandi otomatis diisi.'
                    : 'Belum ada profil yang ditandai sebagai akun demo. Login email tetap tersedia.')}
              </small>
            </label>

            <label className="sj-field">
              <span>Email</span>
              <span className="sj-input-wrap"><Mail size={18} /><input type="email" autoComplete="username" required readOnly={!manualMode} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@organisasi.id" /></span>
            </label>
            <label className="sj-field">
              <span>Kata sandi</span>
              <span className="sj-input-wrap"><LockKeyhole size={18} /><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan kata sandi akun" /><button type="button" className="sj-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
            </label>
            {error && <div role="alert" className="sj-form-alert sj-form-alert-error"><AlertCircle size={17} /><span>{error}</span></div>}
            {success && <div role="status" className="sj-form-alert sj-form-alert-success"><CheckCircle2 size={17} /><span>{success}</span></div>}
            <button type="submit" className="sj-primary-button" disabled={isLoggingIn || !email.trim() || !password}>
              {isLoggingIn ? <><Loader2 size={18} className="animate-spin" /> Memverifikasi…</> : <>Masuk ke ruang kerja <ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="sj-auth-divider"><span>AKUN BARU?</span></div>
          <button type="button" onClick={onGoToRegister} className="sj-secondary-button">Buat akun SambungJaga <ArrowRight size={17} /></button>
          <p className="sj-auth-footnote"><ShieldCheck size={15} /> Pemilihan akun demo tidak melewati autentikasi. Kata sandi diverifikasi oleh Supabase.</p>
        </div>
      </section>
    </main>
  );
}
