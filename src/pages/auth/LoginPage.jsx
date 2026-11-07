import React, { useEffect, useState } from 'react';
import {
  Heart, LockKeyhole, Mail, ArrowRight, ArrowLeft, ShieldCheck,
  Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, UserRound
} from 'lucide-react';
import { signInWithEmailPassword, getAuthErrorMessage } from '../../services/auth/authService';
import { fetchDemoAccountsPerRole, formatDemoOptionLabel } from '../../services/dashboard/staffService';

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
        if (active) {
          setDemoAccounts(accounts || []);
        }
      } catch (loadError) {
        if (active) {
          setDemoAccounts([]);
          setAccountsError('Gagal memuat akun demo dari database.');
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

    const account = demoAccounts.find(
      (item) => item.key === accountKey || item.role === accountKey || item.id === accountKey
    );
    if (account) {
      setEmail(account.email || '');
      setPassword(account.password || '');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsLoggingIn(true);
    try {
      const account = await signInWithEmailPassword(email, password);
      setSuccess('Identitas terverifikasi. Menyiapkan ruang kerja…');
      onLoginSuccess(account.role, account);
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <main className="sj-auth-shell">
      <section className="sj-auth-visual sj-auth-visual-login">
        <img
          src="/Tua.jpeg"
          onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/Orangtua.jpeg'; }}
          alt="Pemandangan kegiatan perawatan lansia"
          className="sj-auth-photo"
        />
        <div className="sj-auth-visual-top-container">
          <div className="sj-auth-visual-top">
            <button type="button" onClick={onGoToLanding} className="sj-brand-lockup sj-brand-light">
              <span className="sj-brand-mark"><Heart size={21} fill="currentColor" /></span>
              <span><strong>Sambung<span>Jaga</span></strong><small>Platform Kesinambungan Perawatan</small></span>
            </button>
            <button type="button" onClick={onGoToLanding} className="sj-back-link"><ArrowLeft size={16} /> Beranda</button>
          </div>
          <div className="sj-auth-badge-wrap animate-fade-up">
            <span className="sj-eyebrow sj-eyebrow-light"><ShieldCheck size={14} /> PERAWATAN TERHUBUNG</span>
          </div>
        </div>

        <div className="sj-auth-visual-bottom animate-fade-up">
          <div className="sj-auth-visual-bottom-text">
            <h2>Setiap pergantian tugas, tetap <em>tersambung.</em></h2>
            <p>Satukan alur perawatan dan koordinasi tim dalam satu platform terpadu.</p>
          </div>
          <div className="sj-auth-visual-footer">
            <span>Ruang kerja perawatan teratur</span>
            <span>01 / 02</span>
          </div>
        </div>
      </section>

      <section className="sj-auth-panel">
        <div className="sj-auth-panel-inner animate-fade-up">
          <div className="sj-auth-mobile-brand sj-brand-lockup">
            <span className="sj-brand-mark"><Heart size={20} fill="currentColor" /></span>
            <span><strong>Sambung<span>Jaga</span></strong><small>Platform Kesinambungan Perawatan</small></span>
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
                {demoAccounts.map((account, index) => (
                  <option key={account.key || account.role} value={account.role || account.key}>
                    {formatDemoOptionLabel(account, index)}
                  </option>
                ))}
                <option value="manual">Tidak ada akun yang dipilih (Masuk manual)</option>
              </select>
              <small>
                {isFetchingAccounts
                  ? 'Memuat akun demo dari database…'
                  : 'Akun demo ditarik secara dinamis dari database (1 per role).'}
              </small>
            </label>

            <label className="sj-field">
              <span>Email</span>
              <span className="sj-input-wrap"><Mail size={18} /><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@organisasi.id" /></span>
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
          <p className="sj-auth-footnote"><ShieldCheck size={15} /> Pemilihan akun demo otomatis terisi dari hasil database. Kata sandi diverifikasi oleh Supabase.</p>
        </div>
      </section>
    </main>
  );
}

