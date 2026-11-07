import React, { useState } from 'react';
import {
  Heart, UserRound, Mail, Phone, ArrowRight, ArrowLeft, ShieldCheck,
  LockKeyhole, Eye, EyeOff, Loader2, AlertCircle
} from 'lucide-react';
import { signUpWithEmailPassword, getAuthErrorMessage } from '../../services/auth/authService';

const roleOptions = [
  { value: 'caregiver', label: 'Pengasuh / Perawat', hint: 'Mencatat laporan dan menjalankan tugas' },
  { value: 'family', label: 'Keluarga / Wali', hint: 'Melihat informasi yang dibagikan fasilitas' }
];

export default function RegisterPage({ onRegisterSuccess, onGoToLogin, onGoToLanding }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('caregiver');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNeedsConfirmation(false);
    if (password.length < 8) {
      setError('Kata sandi minimal 8 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi belum sama.');
      return;
    }
    setIsRegistering(true);
    try {
      const result = await signUpWithEmailPassword({ fullName, email, phone, role, password });
      if (result.needsEmailConfirmation) {
        setNeedsConfirmation(true);
        return;
      }
      onRegisterSuccess(result.account.role, result.account);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <main className="sj-auth-shell">
      <section className="sj-auth-visual sj-auth-visual-register">
        <img
          src="/gunung.jpeg"
          onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/Tua.jpeg'; }}
          alt="Pemandangan alam untuk halaman pendaftaran SambungJaga"
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
            <span className="sj-eyebrow sj-eyebrow-light"><ShieldCheck size={14} /> MEMULAI DENGAN AMAN</span>
          </div>
        </div>

        <div className="sj-auth-visual-bottom animate-fade-up">
          <div className="sj-auth-visual-bottom-text">
            <h2>Kolaborasi perawatan dengan <em>akses yang tepat.</em></h2>
            <p>Integrasi aman untuk perawat dan keluarga dalam satu platform.</p>
          </div>
          <div className="sj-auth-visual-footer">
            <span>Privasi & keamanan terjamin</span>
            <span>02 / 02</span>
          </div>
        </div>
      </section>

      <section className="sj-auth-panel">
        <div className="sj-auth-panel-inner sj-register-inner animate-fade-up">
          <div className="sj-auth-mobile-brand sj-brand-lockup">
            <span className="sj-brand-mark"><Heart size={20} fill="currentColor" /></span>
            <span><strong>Sambung<span>Jaga</span></strong><small>Platform Kesinambungan Perawatan</small></span>
          </div>
          <div className="sj-auth-heading">
            <span className="sj-eyebrow">PENDAFTARAN AKUN</span>
            <h2>Buat akun baru</h2>
            <p>Isi beberapa detail untuk membuat identitas pengguna.</p>
          </div>

          {needsConfirmation ? (
            <div className="sj-confirmation-card" role="status">
              <span className="sj-confirmation-icon"><Mail size={25} /></span>
              <h3>Periksa email Anda</h3>
              <p>Tautan verifikasi telah diminta untuk <strong>{email}</strong>. Selesaikan verifikasi dari kotak masuk sebelum masuk ke SambungJaga.</p>
              <button type="button" onClick={onGoToLogin} className="sj-primary-button">Kembali ke halaman masuk <ArrowRight size={17} /></button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="sj-auth-form">
              <div className="sj-form-grid">
                <label className="sj-field">
                  <span>Nama lengkap</span>
                  <span className="sj-input-wrap"><UserRound size={17} /><input required autoComplete="name" maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama sesuai identitas" /></span>
                </label>
                <label className="sj-field">
                  <span>Nomor telepon <small>(opsional)</small></span>
                  <span className="sj-input-wrap"><Phone size={17} /><input type="tel" autoComplete="tel" maxLength={24} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xx…" /></span>
                </label>
              </div>
              <div className="sj-form-grid">
                <label className="sj-field">
                  <span>Email</span>
                  <span className="sj-input-wrap"><Mail size={17} /><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" /></span>
                </label>
                <label className="sj-field">
                  <span>Peran akun</span>
                  <select value={role} onChange={(e) => setRole(e.target.value)}>{roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                </label>
              </div>
              <div className="sj-form-grid">
                <label className="sj-field">
                  <span>Kata sandi <small>(min. 8 kar)</small></span>
                  <span className="sj-input-wrap"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Buat kata sandi" /><button type="button" className="sj-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span>
                </label>
                <label className="sj-field">
                  <span>Ulangi kata sandi</span>
                  <span className="sj-input-wrap"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ketik ulang kata sandi" /></span>
                </label>
              </div>
              {error && <div role="alert" className="sj-form-alert sj-form-alert-error"><AlertCircle size={16} /><span>{error}</span></div>}
              <button type="submit" className="sj-primary-button" disabled={isRegistering || !fullName.trim() || !email.trim() || !password || !confirmPassword}>
                {isRegistering ? <><Loader2 size={17} className="animate-spin" /> Membuat akun…</> : <>Buat akun <ArrowRight size={17} /></>}
              </button>
            </form>
          )}
          <div className="sj-auth-divider"><span>SUDAH PUNYA AKUN?</span></div>
          <button type="button" onClick={onGoToLogin} className="sj-secondary-button">Masuk ke SambungJaga <ArrowRight size={17} /></button>
          <p className="sj-auth-footnote"><ShieldCheck size={15} /> Pembuatan akun menggunakan verifikasi email Supabase Auth.</p>
        </div>
      </section>
    </main>
  );
}
