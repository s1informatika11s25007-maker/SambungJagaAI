import React, { useState } from 'react';
import {
  ArrowRight, ArrowUpRight, CheckCircle2, ClipboardList, Heart,
  LockKeyhole, MessageSquareText, ShieldCheck, Users,
  Workflow, Activity, FileCheck2, TimerReset, ScanEye
} from 'lucide-react';
import ArchitectureModal from '../../components/common/ArchitectureModal';

const capabilities = [
  { icon: MessageSquareText, number: '01', title: 'Tangkap laporan', text: 'Catatan teks, suara, dan bukti masuk melalui alur yang sama sehingga konteks tidak tercecer.' },
  { icon: Workflow, number: '02', title: 'Ubah menjadi tugas', text: 'Superagent membantu menyusun tindak lanjut yang dapat ditinjau dan dikonfirmasi oleh petugas.' },
  { icon: ShieldCheck, number: '03', title: 'Verifikasi penyelesaian', text: 'Bukti, status, dan pihak yang bertanggung jawab tersimpan untuk ditelusuri kembali.' },
  { icon: Activity, number: '04', title: 'Pantau kesinambungan', text: 'Supervisor mendapat ringkasan prioritas, serah terima shift, dan aktivitas yang perlu diperhatikan.' }
];

const roleCards = [
  { icon: Users, title: 'Supervisor', text: 'Prioritaskan pekerjaan, tinjau eskalasi, dan pantau koordinasi tim.' },
  { icon: Heart, title: 'Pengasuh', text: 'Lihat tugas aktif, kirim laporan, dan lampirkan bukti dari lapangan.' },
  { icon: LockKeyhole, title: 'Keluarga', text: 'Akses ringkasan perawatan yang telah diizinkan oleh fasilitas.' }
];

export default function LandingPage({ onGoToLogin, onGoToRegister }) {
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState(false);

  return (
    <div className="sj-landing">
      <section className="sj-hero">
        <div className="sj-hero-glow sj-hero-glow-a" />
        <div className="sj-hero-glow sj-hero-glow-b" />
        <div className="sj-hero-copy animate-fade-up">
          <span className="sj-eyebrow sj-eyebrow-light"><span className="sj-live-dot" /> CARE CONTINUITY, CONNECTED</span>
          <h1>Perawatan yang baik dimulai dari <em>koordinasi yang terjaga.</em></h1>
          <p className="sj-hero-description">SambungJaga membantu tim perawatan lansia menghubungkan laporan, kewajiban, bukti, dan serah terima shift dalam satu ruang kerja yang mudah dipahami.</p>
          <div className="sj-hero-actions">
            <button type="button" onClick={onGoToLogin} className="sj-hero-primary">Masuk ke platform <ArrowRight size={18} /></button>
            <button type="button" onClick={() => setIsArchitectureModalOpen(true)} className="sj-hero-secondary">Jelajahi cara kerja <ArrowUpRight size={17} /></button>
          </div>
          <div className="sj-hero-trust-row">
            <span><ShieldCheck size={15} /> Akses berbasis peran</span>
            <span><FileCheck2 size={15} /> Bukti yang dapat ditelusuri</span>
            <span><LockKeyhole size={15} /> Alur dengan persetujuan manusia</span>
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
            <span><strong>Care insight</strong><small>Ringkasan aktivitas tersusun</small></span>
            <span className="sj-mini-check"><CheckCircle2 size={16} /></span>
          </div>
          <div className="sj-floating-card sj-floating-card-bottom">
            <span className="sj-floating-icon sj-floating-icon-green"><ClipboardList size={18} /></span>
            <span><strong>Shift handover</strong><small>Catatan untuk tim berikutnya</small></span>
            <span className="sj-card-pulse" />
          </div>
          <div className="sj-visual-brand-orb"><img src="/Friendly Futuristic Robot Mascot.png" alt="Maskot SambungJaga" /></div>
          <div className="sj-visual-caption"><span className="sj-caption-line" /> Satu alur. Informasi tetap tersambung.</div>
        </div>
      </section>

      <section className="sj-proof-strip" aria-label="Prinsip platform">
        <div><span className="sj-proof-icon"><Activity size={18} /></span><span><strong>Asisten Pintar Pendamping</strong><small>Meringkas dan menyusun tindak lanjut</small></span></div>
        <div><span className="sj-proof-icon"><ShieldCheck size={18} /></span><span><strong>Keputusan tetap terjaga</strong><small>Aksi klinis membutuhkan otorisasi</small></span></div>
        <div><span className="sj-proof-icon"><TimerReset size={18} /></span><span><strong>Jejak lintas shift</strong><small>Status dan bukti lebih mudah dicari</small></span></div>
      </section>

      <section className="sj-section sj-capabilities" id="cara-kerja">
        <div className="sj-section-heading">
          <span className="sj-eyebrow">ALUR KERJA YANG TERHUBUNG</span>
          <h2>Dari laporan menjadi tindak lanjut yang jelas.</h2>
          <p>Setiap peran melihat pekerjaan yang relevan. Sistem membantu merapikan alur—bukan mengambil alih keputusan perawatan.</p>
        </div>
        <div className="sj-capability-grid">
          {capabilities.map((item) => {
            const Icon = item.icon;
            return <article className="sj-capability-card" key={item.number}>
              <div className="sj-capability-top"><span className="sj-capability-icon"><Icon size={20} /></span><span>{item.number}</span></div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>;
          })}
        </div>
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
      <ArchitectureModal isOpen={isArchitectureModalOpen} onClose={() => setIsArchitectureModalOpen(false)} />
    </div>
  );
}
