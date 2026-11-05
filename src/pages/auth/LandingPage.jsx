import React, { useState } from 'react';
import {
  ArrowRight, ArrowUpRight, CheckCircle2, ClipboardList, Heart,
  LockKeyhole, MessageSquareText, ShieldCheck, Users,
  Workflow, Activity, FileCheck2, TimerReset, ScanEye, CheckSquare, Upload, UserCheck, Shield
} from 'lucide-react';
import ArchitectureModal from '../../components/common/ArchitectureModal';

const careJourneySteps = [
  { step: '01', title: '1. Caregiver Reporting', text: 'Laporan suara atau teks masuk langsung dari perawat di lapangan.', icon: MessageSquareText },
  { step: '02', title: '2. AI Understanding', text: 'AI mengidentifikasi penghuni, mengekstrak fakta, dan memeriksa kelengkapan.', icon: ScanEye },
  { step: '03', title: '3. Care Obligation', text: 'Kebutuhan yang tervalidasi menjadi tugas kewajiban berdasarkan aturan panti.', icon: ClipboardList },
  { step: '04', title: '4. Workforce Assignment', text: 'Sistem mencocokkan caregiver sesuai kompetensi, shift, dan ketersediaan.', icon: UserCheck },
  { step: '05', title: '5. Care Evidence', text: 'Pelaksanaan dicatat dan foto bukti diunggah ke penyimpanan privat.', icon: Upload },
  { step: '06', title: '6. Supervisor Review', text: 'Bukti & aksi klinis yang membutuhkan otorisasi diperiksa manusia berwenang.', icon: ShieldCheck },
  { step: '07', title: '7. Continuity & Family', text: 'Handover 2 sisi, audit trail, dan informasi keluarga yang diizinkan PDP diperbarui.', icon: Heart }
];

const capabilities = [
  { icon: MessageSquareText, number: '01', title: 'Tangkap laporan', text: 'Catatan teks, suara, dan bukti masuk melalui alur yang sama sehingga konteks tidak tercecer.' },
  { icon: Workflow, number: '02', title: 'Ubah menjadi tugas', text: 'Superagent membantu menyusun tindak lanjut yang dapat ditinjau dan dikonfirmasi oleh petugas.' },
  { icon: ShieldCheck, number: '03', title: 'Verifikasi penyelesaian', text: 'Bukti, status, dan pihak yang bertanggung jawab tersimpan untuk ditelusuri kembali.' },
  { icon: Activity, number: '04', title: 'Pantau kesinambungan', text: 'Supervisor mendapat ringkasan prioritas, serah terima shift, dan aktivitas yang perlu diperhatikan.' }
];

const roleCards = [
  { icon: Users, title: 'Supervisor Center', text: 'Prioritaskan pekerjaan, tinjau eskalasi A3, dan pantau koordinasi tim.' },
  { icon: Heart, title: 'Care Dashboard', text: 'Lihat tugas aktif, kirim laporan suara/teks, dan lampirkan bukti foto OCR.' },
  { icon: LockKeyhole, title: 'Family Care Portal', text: 'Akses ringkasan perawatan yang diizinkan PDP & ajukan kunjungan.' }
];

export default function LandingPage({ onGoToLogin, onGoToRegister }) {
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState(false);

  return (
    <div className="sj-landing">
      <section className="sj-hero">
        <div className="sj-hero-glow sj-hero-glow-a" />
        <div className="sj-hero-glow sj-hero-glow-b" />
        <div className="sj-hero-copy animate-fade-up">
          <span className="sj-eyebrow sj-eyebrow-light"><span className="sj-live-dot" /> CARE CONTINUITY INTELLIGENCE</span>
          <h1>Perawatan lansia yang terhubung dari <em>laporan sampai bukti terverifikasi.</em></h1>
          <p className="sj-hero-description">SambungJaga menghubungkan laporan perawat, kewajiban perawatan, pencocokan staf, verifikasi bukti, hingga serah terima shift dalam satu alur yang transparan.</p>

          <div className="sj-hero-actions">
            <button type="button" onClick={onGoToLogin} className="sj-hero-primary">Masuk ke platform <ArrowRight size={18} /></button>
            <button type="button" onClick={() => setIsArchitectureModalOpen(true)} className="sj-hero-secondary">Jelajahi cara kerja <ArrowUpRight size={17} /></button>
          </div>
          <div className="sj-hero-trust-row">
            <span><ShieldCheck size={15} /> Akses RLS Berbasis Peran</span>
            <span><FileCheck2 size={15} /> Bukti Kriptografis SHA-256</span>
            <span><LockKeyhole size={15} /> Persetujuan Manusia (A3)</span>
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
            <span><strong>Care Continuity</strong><small>One Connected Care Journey</small></span>
            <span className="sj-mini-check"><CheckCircle2 size={16} /></span>
          </div>
          <div className="sj-floating-card sj-floating-card-bottom">
            <span className="sj-floating-icon sj-floating-icon-green"><ClipboardList size={18} /></span>
            <span><strong>Shift Handover</strong><small>Kontrak Shift Dua Sisi</small></span>
            <span className="sj-card-pulse" />
          </div>

          {/* Prominent Floating Brand Mascot Orb */}
          <div className="sj-visual-brand-orb" title="Maskot SambungJaga AI">
            <img
              src="/mascot.png"
              onError={(e) => { e.currentTarget.src = '/Friendly Futuristic Robot Mascot.png'; }}
              alt="Maskot Robot SambungJaga AI"
            />
          </div>
          <div className="sj-visual-caption"><span className="sj-caption-line" /> Satu alur. Informasi tetap tersambung.</div>
        </div>
      </section>

      {/* Primary Featured Story: Care Continuity Intelligence — One Connected Care Journey */}
      <section className="sj-section" id="care-journey">
        <div className="sj-section-heading">
          <span className="sj-eyebrow">INOVASI UNGGULAN KONSISTENSI PERAWATAN</span>
          <h2>One Connected Care Journey</h2>
          <p>Alur 7 langkah terintegrasi yang menghubungkan seluruh kekuatan SambungJaga dari laporan pertama hingga pembaruan keluarga.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          {careJourneySteps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.step} className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-2 relative hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold text-xs">
                    <Icon size={16} />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-300">{step.step}</span>
                </div>
                <h3 className="text-xs font-bold text-slate-900">{step.title}</h3>
                <p className="text-[11px] text-slate-600 leading-relaxed">{step.text}</p>
              </div>
            );
          })}
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
      <ArchitectureModal isOpen={isArchitectureModalOpen} onClose={() => setIsArchitectureModalOpen(false)} />
    </div>
  );
}
