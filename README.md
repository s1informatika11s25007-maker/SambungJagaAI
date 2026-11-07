<div align="center">
  <p align="center">
    <img src="public/mascot.png" alt="SambungJaga AI Mascot" width="160" />
  </p>

  # SambungJaga AI — Care Continuity Superagent Workspace
  **Asisten Pintar Perawatan Lansia & Intelijen Kesinambungan Antar-Shift di Panti Jompo**

  <p>
    <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black" alt="React 18" />
    <img src="https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white" alt="Vite 5" />
    <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white" alt="Supabase" />
    <img src="https://img.shields.io/badge/AI Engine-Gemini Nano %2B Cloud Hybrid-10B981" alt="AI Engine" />
    <img src="https://img.shields.io/badge/Architecture-PWA %2B Offline First-0284C7" alt="PWA Offline First" />
  </p>
</div>

---

## 💡 Apa Itu SambungJaga AI?

**SambungJaga AI** adalah platform **Superagent & Asisten AI Pintar** yang dirancang khusus untuk menjaga kesinambungan perawatan lansia di panti jompo dan fasilitas caregiving. 

Di panti jompo, masalah utama yang sering terjadi adalah **informasi perawatan yang terputus saat pergantian shift perawat (caregiver)**. Catatan riwayat obat, kondisi harian lansia, dan tugas medis terbuka sering kali tercecer atau lupa disampaikan.

SambungJaga AI hadir sebagai **pendamping digital interaktif** yang menghubungkan seluruh siklus perawatan: mulai dari **pencatatan laporan suara/teks pengasuh, pembentukan tugas medis otomatis, verifikasi bukti foto, serah-terima shift dua sisi, hingga pembaruan informasi kepada keluarga**.

---

## 🚀 Mengapa SambungJaga AI Sangat Dibutuhkan?

1. **Informasi Tidak Pernah Terputus:** Semua instruksi dan catatan harian terhubung dalam satu rantai perawatan digital.
2. **Asisten AI Pendamping Pengasuh:** AI membantu merapikan catatan suara/teks perawat secara alami tanpa menambah beban administratif.
3. **Penyelesaian Tugas Berbasis Bukti:** Setiap tindakan perawatan membutuhkan konfirmasi dan foto bukti terenkripsi.
4. **Serah-Terima Shift Bergaransi 2 Sisi:** Perawat lama dan perawat baru wajib menandatangani kontrak digital serah-terima shift.
5. **Transparansi Keluarga (Aman PDP):** Keluarga dapat memantau ringkasan perawatan lansia yang diizinkan secara aman.

---

## 🔄 Alur 7 Langkah Kesinambungan Perawatan

SambungJaga AI mengintegrasikan 7 langkah cerdas dalam setiap siklus perawatan lansia:

| Langkah | Peran (Role) | Fitur / Modul | Deskripsi Alur |
| :--- | :--- | :--- | :--- |
| **01. Laporan Pengasuh** | 👤 Caregiver | 📱 Ruang Kerja Pengasuh | Input teks/suara. Aplikasi mencocokkan identitas lansia secara 100% deterministik. |
| **02. Menyusun Catatan AI** | 🤖 AI & Caregiver | 🧠 AI Note Compiler | Gemini Nano memproses secara lokal di HP. Jika offline/terbatas, cloud safeguard bertingkat diaktifkan. |
| **03. Membentuk Tugas** | ⚙️ Sistem AI Kernel | ⚡ Atomic RPC Task Engine | Fakta & usulan kewajiban dikirim via RPC dan tersimpan aman setelah ada konfirmasi server (*RPC Ack*). |
| **04. Mengunggah Bukti** | 📸 Caregiver | 🔒 Storage Bukti Privat | Foto tindakan medis dienkripsi dan disimpan secara privat di Supabase Storage. |
| **05. Verifikasi Supervisor** | 👩‍⚕️ Supervisor Klinis | 🛡️ Pusat Supervisor | AI membantu memfilter anomali awal, namun keputusan & persetujuan klinis 100% diputuskan Supervisor. |
| **06. Menerima Handover** | 🤝 Caregiver Shift | 📜 Kontrak Serah Terima | GPT-OSS 120B merangkum tugas terbuka. Perawat pengirim & penerima mengonfirmasi secara terpisah. |
| **07. Audit Trail Ledger** | 🏛️ Admin & Keamanan | 🔐 Audit Trail SHA-256 | Seluruh riwayat dicatat dalam rantai audit *append-only* SHA-256 yang transparan & tidak bisa dimanipulasi. |

---

## 👥 Ruang Kerja Berbasis Peran (Multi-Role Workspaces)

SambungJaga AI menyediakan tampilan khusus yang disesuaikan dengan peran pengguna di lapangan:

* **📱 Ruang Kerja Pengasuh (Caregiver Mobile Workspace):**
  - Catat laporan harian lewat suara (STT) atau teks.
  - Lihat daftar tugas kewajiban perawatan harian per lansia.
  - Unggah foto bukti pelaksanaan tindakan (vital sign, obat, dll).
  - Buat dan tanda tangani draf serah-terima shift.

* **🛡️ Pusat Supervisor (Supervisor Intelligence Center):**
  - Tinjau antrean verifikasi bukti tindakan medis.
  - Terima peringatan otomatis untuk tugas berisiko (*Care Debt Alert*).
  - Berikan otorisasi persetujuan klinis (*Human-in-the-Loop*).
  - Pantau skor kesehatan operasional dan kesinambungan panti.

* **👨‍👩‍👧 Portal Perawatan Keluarga (Family Portal):**
  - Lihat ringkasan kondisi lansia yang diizinkan sesuai kaidah privasi PDP.
  - Ajukan jadwal kunjungan dan komunikasi dengan panti.
  - Kirimkan pengaduan atau catatan khusus perawatan.

* **👥 Manajemen Kehadiran & Shift:**
  - Penjadwalan shift perawat dan pengecekan kompetensi staf.
  - Pengelolaan daftar pengganti saat staf berhalangan.

---

## 📂 Pohon Struktur Direktori Proyek (Project Structure)

Berikut adalah struktur folder dan file proyek SambungJaga AI yang 100% akurat sesuai kondisi repository saat ini:

```text
SambungJagaAI/
├── api/                             # Serverless / Cron Workers & Server API
│   ├── cron-keep-alive.js           # Supabase DB Keep-Awake Ping Worker
│   ├── cron-sla-watchdog.js         # SLA Care Debt Watchdog Worker
│   └── cron-sync-health.js          # Platform Health Monitoring Worker
├── public/                          # Static Assets, Aset Maskot & Animasi SVG
│   ├── mascot.png                   # Logo Maskot Resmi SambungJaga AI
│   ├── Orangtua.jpeg                # Foto Ilustrasi Caregiver & Lansia
│   ├── elderly-care.svg             # Fallback SVG Caregiver
│   ├── 3d-data-layers.svg           # Diagram Arsitektur Visual
│   ├── manifest.json                # PWA Manifest Config
│   └── sw.js                        # PWA Service Worker (Offline Support)
├── src/                             # Source Code Utama Aplikasi React
│   ├── components/                  # Modul Komponen Reusable UI
│   │   ├── caregiver/               # Caregiver Widgets, Capture & Upload Modals
│   │   ├── common/                  # Modul Umum (HowItWorks3D, Modal, Badge, Mic)
│   │   ├── dashboard/               # Supervisor Command Center, Care Debt, Health
│   │   ├── handover/                # Two-Sided Handover Contract Cards
│   │   ├── layout/                  # Navbar, Sidebar, Header, PublicHeader, Footer
│   │   ├── simulator/               # Failure Set Simulation Modals
│   │   └── trace/                   # Execution Trace Modals
│   ├── hooks/                       # Custom React Hooks
│   │   └── core/                    # useSambungJaga.js (Global State & Sync)
│   ├── pages/                       # Halaman Utama Aplikasi (Workspaces)
│   │   ├── admin/                   # Admin Queue Monitor & Security Config Pages
│   │   ├── audit/                   # Audit Trail Ledger Page
│   │   ├── auth/                    # Landing Page, Login & Register Pages
│   │   ├── caregiver/               # Caregiver Mobile Workspace Page
│   │   ├── dashboard/               # Supervisor Intelligence Dashboard Page
│   │   ├── family/                  # Family Portal Page (PDP Privacy Summary)
│   │   ├── handover/                # Shift Handover Contract Page
│   │   ├── rule/                    # Care Rule Library Page
│   │   ├── simulator/               # Failure-Set Simulator Lab Page
│   │   ├── trace/                   # Execution Trace Inspector Page
│   │   └── workforce/               # Workforce & Shift Attendance Page
│   ├── services/                    # Business Logic, AI Engine & Supabase Integrations
│   │   ├── ai/                      # AI Superagent, Gemini Nano & Agent Mesh
│   │   ├── audit/                   # SHA-256 Audit Trail Services
│   │   ├── auth/                    # Auth, Consent & PDP Data Masker
│   │   ├── automation/              # Event Bus, Autopilot & SLA Watchdog
│   │   ├── caregiver/               # Evidence Verifier, STT Pipeline & WhatsApp Bot
│   │   ├── dashboard/               # Audio Alerts & Staff Operational Services
│   │   ├── data/                    # Data Retention Engine & Deduplication
│   │   ├── handover/                # Handover Contracts & Authority Envelope
│   │   ├── monitoring/              # Platform Ops & Clinical Quality Evaluator
│   │   ├── notifications/           # Messaging & Push Providers
│   │   ├── offline/                 # IndexedDb Encrypted Storage & Offline Sync
│   │   ├── rule/                    # Obligation Engine & Rule Replay
│   │   ├── security/                # Incident Response & Access Monitor
│   │   ├── simulator/               # Failure Set Simulator Engine
│   │   └── trace/                   # Epistemic Ledger & Conflict Resolution
│   ├── supabase/                    # Supabase Client & Backend Auth Config
│   │   └── client/                  # client.js & backendClient.js
│   ├── types/                       # Definition & Architecture Specs
│   │   └── core/                    # architecture.js
│   ├── utils/                       # Helper Utility Functions
│   │   └── common/                  # Cache Manager, Formatters, Validators
│   ├── App.jsx                      # Main React Router & Workspace Switcher
│   ├── main.jsx                     # Entry Point Application
│   └── index.css                    # Tailwind CSS & 3D Custom Keyframes
├── supabase/                        # Database Schema & Migrations
│   ├── migrations/                  # SQL Migrations (Kernel, RPC, RLS, Audit)
│   └── config.toml                  # Supabase CLI Local Configuration
├── tests/                           # Unit & End-to-End Test Suite
├── .env.example                     # Template Variabel Lingkungan Frontend
├── .gitignore                       # Proteksi File Secrets (.env, node_modules)
├── index.html                       # HTML Template App
├── package.json                     # Dependency & NPM Script Executables
├── vite.config.js                   # Vite Bundler Build Configuration
└── README.md                        # Dokumentasi Resmi Proyek
```

---

## 🛠️ Arsitektur & Teknologi Utama

- **Frontend Application:** React 18, Vite 5, React Router, Tailwind CSS, Lucide Icons.
- **PWA & Offline-First:** Dukungan IndexedDB & AES-GCM untuk pelaporan saat koneksi internet terputus.
- **Backend & Database:** Supabase PostgreSQL, Row Level Security (RLS), Stored Procedures / RPC Functions.
- **Storage Privat:** Supabase Storage terenkripsi untuk bukti foto medis lansia.
- **AI Superagent Engine:**
  - **On-Device Local AI:** Gemini Nano untuk pemrosesan cepat & hemat data langsung di HP.
  - **Hybrid Cloud Fallback:** Llama Prompt Guard 2 → Qwen 3.8 → GPT-OSS Safeguard 20B/120B.

---

## 💻 Panduan Menjalankan Secara Lokal (Quick Start)

### 1. Prasyarat
- Node.js 20.x / 22.x atau lebih baru.
- npm 10.x atau lebih baru.
- Akun Supabase (untuk URL & Anon Key).

### 2. Langkah Instalasi

```bash
# 1. Clone repository
git clone https://github.com/s1informatika11s25007-maker/SambungJagaAI.git
cd SambungJagaAI

# 2. Install dependency
npm install

# 3. Buat file lingkungan lokal .env.local
cp .env.example .env.local

# 4. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di .env.local

# 5. Jalankan server pengembangan
npm run dev
```

Buka aplikasi di browser: `http://localhost:3000`.

---

## 🧪 Pemeriksaan Kualitas & Pengujian Kode

```bash
# Pemeriksaan sintaksis JavaScript/JSX
npm run lint

# Jalankan Unit Test (Vitest)
npm run test:unit

# Build aplikasi untuk produksi
npm run build

# Jalankan End-to-End Test (Playwright)
npm run test:e2e
```

---

## 🛡️ Prinsip Keamanan & Etika AI

1. **Human-in-the-Loop (Kedaulatan Manusia):** AI bertindak sebagai asisten pembantu. Seluruh keputusan klinis, dosis obat, dan persetujuan tindakan tetap dipegang oleh Supervisor manusia.
2. **Perlindungan Privasi Data (Sesuai UU PDP):** Data medis lansia dienkripsi dan dibatasi aksesnya berdasarkan aturan database (RLS).
3. **Transparansi & Akuntabilitas:** Setiap aksi dicatat dalam *Audit Trail* ber-hash SHA-256 yang tidak dapat di-backdate atau diubah secara sepihak.

---

<div align="center">
  <sub>SambungJaga AI — Menjaga Kesinambungan Perawatan Lansia Tanpa Terputus © 2026</sub>
</div>
