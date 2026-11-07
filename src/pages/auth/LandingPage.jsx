import React, { useState } from 'react';
import {
  ArrowRight, ArrowUpRight, CheckCircle2, ClipboardList, Heart,
  LockKeyhole, MessageSquareText, ShieldCheck, Users,
  Activity, FileCheck2, TimerReset, ScanEye, Shield
} from 'lucide-react';
import HowItWorks3DModal from '../../components/common/HowItWorks3D';

const roleCards = [
  { icon: Heart, title: 'Ruang Kerja Pengasuh', text: 'Lapor kondisi, lihat tugas, kirim bukti, dan lanjutkan serah terima shift.' },
  { icon: ShieldCheck, title: 'Pusat Supervisor', text: 'Tinjau pengecualian, periksa bukti, putuskan approval, dan pantau eskalasi.' },
  { icon: LockKeyhole, title: 'Portal Perawatan Keluarga', text: 'Lihat ringkasan yang diizinkan, kelola kunjungan, dan lacak pengaduan.' },
  { icon: Users, title: 'Manajemen Kehadiran & Shift', text: 'Kelola pegawai, kompetensi, shift, kehadiran, dan kebutuhan pengganti.' },
  { icon: Shield, title: 'Administrasi Platform', text: 'Pantau layanan, antrean, keamanan, dan audit teknis sesuai kewenangan.' }
];

export default function LandingPage({ onGoToLogin, onGoToRegister }) {
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);

  return (
    <div className="sj-landing">
      <section className="sj-hero">
        <div className="sj-hero-glow sj-hero-glow-a" />
        <div className="sj-hero-glow sj-hero-glow-b" />
        <div className="sj-hero-copy animate-fade-up">
          <span className="sj-eyebrow sj-eyebrow-light"><span className="sj-live-dot" /> INTELIJEN KESINAMBUNGAN PERAWATAN</span>
          <h1>Jangan biarkan informasi perawatan lansia <em>terputus antar-shift.</em></h1>
          <p className="sj-hero-description">SambungJaga menghubungkan laporan caregiver, tugas perawatan, bukti pelaksanaan, pemeriksaan supervisor, dan komunikasi keluarga dalam satu perjalanan perawatan yang dapat ditelusuri.</p>

          <div className="sj-hero-actions">
            <button type="button" onClick={onGoToLogin} className="sj-hero-primary">Masuk ke platform <ArrowRight size={18} /></button>
            <button type="button" onClick={() => setIsHowItWorksOpen(true)} className="sj-hero-secondary">Jelajahi cara kerja <ArrowUpRight size={17} /></button>
          </div>
          <div className="sj-hero-trust-row">
            <span><ShieldCheck size={15} /> Workspace sesuai peran</span>
            <span><FileCheck2 size={15} /> Hash integritas file SHA-256</span>
            <span><LockKeyhole size={15} /> Keputusan berisiko tetap oleh manusia</span>
          </div>
        </div>

        <div className="sj-hero-visual animate-fade-up animate-delay-2">
          <div className="sj-visual-grid" />
          <div className="sj-hero-photo-frame">
            <img src="/Orangtua.jpeg" onError={(event) => { event.currentTarget.src = '/elderly-care.svg'; }} alt="Ilustrasi suasana perawatan lansia" />
            <div className="sj-photo-wash" />
          </div>
          <div className="sj-floating-card sj-floating-card-top">
            <span className="sj-floating-icon sj-floating-icon-blue"><ScanEye size={18} /></span>
            <span><strong>Kesinambungan Perawatan</strong><small>Satu Alur Perawatan Terpadu</small></span>
            <span className="sj-mini-check"><CheckCircle2 size={16} /></span>
          </div>
          <div className="sj-floating-card sj-floating-card-bottom">
            <span className="sj-floating-icon sj-floating-icon-green"><ClipboardList size={18} /></span>
            <span><strong>Shift Handover</strong><small>Kontrak Shift Dua Sisi</small></span>
            <span className="sj-card-pulse" />
          </div>

          {/* Prominent Floating Brand Mascot Orb */}
          <div className="sj-visual-brand-orb" title="Maskot SambungJaga AI" onClick={() => setIsHowItWorksOpen(true)} style={{ cursor: 'pointer' }}>
            <img
              src="/mascot.png"
              onError={(e) => { e.currentTarget.src = '/Friendly Futuristic Robot Mascot.png'; }}
              alt="Maskot Robot SambungJaga AI"
            />
          </div>
          <div className="sj-visual-caption"><span className="sj-caption-line" /> Satu alur. Informasi tetap tersambung.</div>
        </div>
      </section>

      <section className="sj-proof-strip" aria-label="Prinsip platform">
        <div><span className="sj-proof-icon"><Activity size={18} /></span><span><strong>Asisten Pintar Pendamping</strong><small>Meringkas dan menyusun tindak lanjut</small></span></div>
        <div><span className="sj-proof-icon"><ShieldCheck size={18} /></span><span><strong>Keputusan tetap terjaga</strong><small>Aksi klinis membutuhkan otorisasi</small></span></div>
        <div><span className="sj-proof-icon"><TimerReset size={18} /></span><span><strong>Jejak lintas shift</strong><small>Status dan bukti lebih mudah dicari</small></span></div>
      </section>

      <section className="sj-role-section" id="peran">
        <div className="sj-role-intro">
          <span className="sj-eyebrow">SATU PLATFORM, PERAN YANG JELAS</span>
          <h2>Informasi tepat untuk orang yang tepat.</h2>
          <p>Workspace disesuaikan dengan kebutuhan kerja masing-masing pengguna, dengan pembatasan akses di tingkat akun dan database.</p>
          <button type="button" onClick={onGoToRegister} className="sj-text-link">Buat akun <ArrowRight size={16} /></button>
        </div>
        <div className="sj-role-grid">
          {roleCards.map((role) => {
            const Icon = role.icon;
            return <article className="sj-role-card" key={role.title}><span><Icon size={20} /></span><div><h3>{role.title}</h3><p>{role.text}</p></div><ArrowUpRight className="sj-role-arrow" size={17} /></article>;
          })}
        </div>
      </section>

      <section className="sj-cta-panel">
        <div className="sj-cta-spark"><ShieldCheck size={19} /></div>
        <div><span className="sj-eyebrow sj-eyebrow-light">SAMBUNGJAGA CARE PLATFORM</span><h2>Jaga kesinambungan. Sederhanakan koordinasi.</h2><p>Masuk ke ruang kerja sesuai peran Anda.</p></div>
        <button type="button" onClick={onGoToLogin} className="sj-cta-button">Mulai sekarang <ArrowRight size={18} /></button>
      </section>

      {/* 3D How It Works Popup Modal Card */}
      <HowItWorks3DModal isOpen={isHowItWorksOpen} onClose={() => setIsHowItWorksOpen(false)} />
    </div>
  );
}
