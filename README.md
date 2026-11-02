<div align="center">

<img src="public/mascot.png" alt="SambungJaga AI Robot Mascot" width="180" style="filter: drop-shadow(0px 10px 20px rgba(14, 165, 233, 0.4)); animation: float 3s ease-in-out infinite;" />

# 🛡️ SambungJaga AI — Care Continuity Workspace
### *Evidence-Verified Care Continuity Powered by Obligation Kernel & Autonomous Superagent Swarm*

[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vitest](https://img.shields.io/badge/Vitest-1.6-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-1.64-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)

---

<p align="center">
  <b>SambungJaga AI</b> adalah sistem manajemen keberlanjutan perawatan (<i>Care Continuity Workspace</i>) generasi baru untuk panti wreda dan fasilitas perawatan berjangka panjang. Menggabungkan <b>Obligation Kernel Bitemporal</b>, <b>Multi-Agent Swarm Orchestration</b>, dan <b>Verifikasi Bukti Multi-Tingkat (E0–E3)</b> untuk memastikan tidak ada tugas perawatan pasien yang terlewat, dipalsukan, atau mengalami <i>care debt</i>.
</p>

</div>

---

## 🎨 Visualisasi Arsitektur 3D & Alur Data Bergerak

Sistem SambungJaga AI beroperasi melalui jaringan pemrosesan data berlapis yang menghubungkan laporan pengasuh di lapangan hingga audit transaksional tak tertempa (immutable audit trail).

### 🎬 Interactive & Dynamic Workflow Diagram

```mermaid
graph TD
    %% Styling Classes
    classDef actor fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef ingest fill:#311b92,stroke:#b388ff,stroke-width:2px,color:#f8fafc;
    classDef epistemic fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#f8fafc;
    classDef kernel fill:#78350f,stroke:#fbbf24,stroke-width:3px,color:#f8fafc;
    classDef agent fill:#881337,stroke:#fb7185,stroke-width:2px,color:#f8fafc;
    classDef execution fill:#431407,stroke:#fb923c,stroke-width:2px,color:#f8fafc;
    classDef evidence fill:#0c4a6e,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef audit fill:#0f172a,stroke:#94a3b8,stroke-width:2px,color:#f8fafc;

    subgraph L0["👤 LAYER 0: AKTOR & ANTARMUKA"]
        A1["🎙️ Pengasuh (Suara/Teks/Foto)"] :::actor
        A2["👨‍⚕️ Supervisor Perawatan"] :::actor
        A3["🏡 Keluarga Penghuni"] :::actor
        A4["📱 Mobile PWA Offline-First"] :::actor
    end

    subgraph L1["⚡ LAYER 1: INGESTI & KEAMANAN"]
        B1["🛡️ Identity & RBAC Gateway"] :::ingest
        B2["🔐 Prompt Guard 2 (Anti-Injection)"] :::ingest
        B3["📜 P5: Offline Hash Ledger"] :::ingest
    end

    subgraph L2["🧠 LAYER 2: PERSEPSI & EPISTEMIK"]
        C1["📚 Rule & Policy Library"] :::epistemic
        C2["💎 P3: Epistemic Fact Ledger"] :::epistemic
        C3["❓ Minimal-Question Engine"] :::epistemic
    end

    subgraph L3["⚙️ LAYER 3: OBLIGATION KERNEL (INOVASI INTI)"]
        D1["⏳ Temporal Rules Compiler"] :::kernel
        D2["⏳ P1: Bitemporal Obligation Ledger"] :::kernel
        D3["🕸️ Care Obligation Graph"] :::kernel
        D4["🚨 Care Debt & Missing Obligation Detector"] :::kernel
    end

    subgraph L4["🤖 LAYER 4: SUPERAGENT SWARM & AUTHORITY ENVELOPE"]
        E1["👑 Care Mission Orchestration"] :::agent
        E2["🛡️ P6: Authority Envelope (A0-A3)"] :::agent
        E3["🐝 Sub-Agent Swarm (Recovery/Handover/HR)"] :::agent
    end

    subgraph L5["💾 LAYER 5: EKSEKUSI TERKONTROL"]
        F1["🗄️ Supabase PostgreSQL (RLS)"] :::execution
        F2["🔔 Notification & WA API"] :::execution
    end

    subgraph L6["🔍 LAYER 6: VERIFIKASI BUKTI & PENUTUPAN MISI"]
        G1["🔎 P2: Evidence-Grade Verifier (E0-E3)"] :::evidence
        G2["🎯 Spot Challenge Engine"] :::evidence
        G3["✅ Postcondition Evaluator"] :::evidence
    end

    subgraph L7["🔐 LAYER 7: PLATFORM AUDIT IMMUTABLE"]
        H1["🔗 Append-Only Audit Trail (SHA-256 Chain)"] :::audit
    end

    %% Flows & Data Links
    A1 -->|Audio / Teks / Camera| B1
    A4 -->|Atestasi Perangkat| B3
    B1 --> B2 --> C2
    C1 --> C2
    C2 --> D2
    D1 --> D2
    D2 --> D3 --> D4
    D4 -->|Signal Obligation| E1
    E1 --> E2
    E2 -->|Authorized Execution| E3
    E3 --> F1 & F2
    F1 --> G1
    G1 --> G2 --> G3
    G3 -->|Evaluasi Akhir| H1
    E2 -.->|Record Signature| H1
```

---

## 🌟 Fitur-Fitur Utama (Key Capabilities)

<table width="100%">
  <tr>
    <td width="50%" valign="top">
      <h3>🎙️ Care Capture & Voice STT</h3>
      <p>Pengasuh dapat menyampaikan laporan perawatan melalui perintah suara (Whisper V3), input teks, atau foto medis. Sistem mengekstraksi instruksi terstruktur secara otomatis tanpa mengganggu alur kerja pengasuh di lapangan.</p>
    </td>
    <td width="50%" valign="top">
      <h3>⚙️ Obligation Kernel Bitemporal (P1)</h3>
      <p>Membedakan <i>Valid Time</i> (kapan tindakan perawatan harus dilakukan di dunia nyata) dan <i>Transaction Time</i> (kapan data dicatat di database). Otomatis mendeteksi <b>Care Debt</b> jika ada instruksi perawatan yang tertunda.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>🛡️ P6 Authority Envelope & Safeguards</h3>
      <p>Membatasi wewenang AI dari tingkat <b>A0 (Otomatis)</b> hingga <b>A3 (Kedaulatan Manusia Mutlak)</b>. AI tidak pernah membuat keputusan klinis atau mengubah resep obat tanpa persetujuan verbal/tertulis dari Supervisor berwenang.</p>
    </td>
    <td width="50%" valign="top">
      <h3>🔍 Evidence-Grade Verifier (P2 & P5)</h3>
      <p>Memvalidasi bukti penyelesaian tugas melalui 4 tingkatan (E0 Klaim, E1 Foto/QR Hash, E2 Verifikasi Staf Kedua, E3 Data Sensor IoT). Dilengkapi <i>Spot Challenge Engine</i> acak untuk pengujian kualitas.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>📋 Two-Sided Handover Contract</h3>
      <p>Serah terima shift antar pengasuh yang mengikat secara digital dengan dua konfirmasi pihak (Pengirim & Penerima) serta digest enkripsi SHA-256 yang tersimpan dalam database.</p>
    </td>
    <td width="50%" valign="top">
      <h3>🔗 Immutable SHA-256 Audit Trail</h3>
      <p>Setiap interaksi, persetujuan supervisor, eksekusi tool, dan pengunggahan bukti dicatat dalam <i>append-only ledger</i> berantai SHA-256 yang tidak dapat diubah atau dihapus.</p>
    </td>
  </tr>
</table>

---

## 🏛️ Arsitektur Sistem & 10 Layer Pemrosesan Data

Sistem SambungJaga AI dibangun berdasarkan **Architecture Specification (Obligation Kernel)** yang terbagi menjadi 10 layer pemrosesan terorganisir:

| Layer | Nama Layer | Fungsi & Komponen Utama | Inovasi Kernel |
| :--- | :--- | :--- | :--- |
| **Layer 0** | **Aktor & Antarmuka** | Pengasuh (Voice/Teks/WA), Supervisor, Keluarga, Admin HR, dan Mobile PWA Offline-First. | Baseline Entry |
| **Layer 1** | **Akses & Ingesti** | Identity RBAC Gateway, Prompt Guard 2 (Meta Llama 22M), PII Minimization, & Durable Event Queue. | **P5**: Offline Hash-Chain Ledger |
| **Layer 2** | **Persepsi & Pengetahuan** | Rule & Policy Library versi terverifikasi, Context Provenance, Minimal-Question Clarification Engine. | **P3**: Epistemic Fact Ledger |
| **Layer 3** | **Obligation Kernel** | Temporal Rules Compiler, Care Obligation Graph, Expected-but-Absent Obligation Detector. | **P1**: Bitemporal Obligation Ledger |
| **Layer 4** | **Superagent Swarm** | Care Mission Orchestrator (1 Mission, 1 State, 1 Audit Trail), Tool Registry, & Policy Gate. | **P6**: Authority Envelope (A0–A3) |
| **Layer 5** | **Eksekusi Terkontrol** | Supabase PostgreSQL RLS, Signed Storage, Notification Service, & WhatsApp Gateway. | Controlled Execution |
| **Layer 6** | **Verifikasi Bukti** | Spot Challenge Engine, Postcondition Verifier, & Multilevel Evidence Evaluator. | **P2**: Evidence-Grade Verifier (E0–E3) |
| **Layer 7** | **Platform Audit** | Cryptographic Append-Only Ledger mencatat seluruh aktivitas, penolakan, dan eksekusi tool. | Immutable SHA-256 Audit Trail |
| **Layer 8** | **Analisis Asinkron** | Competency Gap Report, Retroactive Rule Replay, Agent Replay & Adversarial Lab. | **P4**: Failure-Set Search Simulator |
| **Layer 9** | **Keluaran & Handover** | Two-Sided Handover Contract, Realtime Supervisor Dashboard, Family Portal, Care Evidence Pack (.json). | Operational Outputs |

---

## 🛠️ Tech Stack & Model AI

### 💻 Frontend & UI Infrastructure
* **Framework**: React 18.3 & Vite 5.4 (ES Modules, HMR Kilat)
* **Styling**: Tailwind CSS 3.4 & PostCSS (Mobile-first responsive design, Dark Theme)
* **Iconography**: Lucide React Icons
* **OCR Engine**: Tesseract.js 7.0 (Pembacaan awal dokumen/bukti lokal)
* **State & Router**: React Router 7.18 & Custom Reactive Hooks (`useSambungJaga`)

### 🗄️ Backend, Storage & Security
* **Database**: Supabase PostgreSQL dengan Row-Level Security (RLS) ketat per peran
* **Authentication**: Supabase Auth (Email/Password, Email Verification, Session RBAC)
* **Serverless Functions**: Supabase Edge Functions (Deno Runtime)
* **Kriptografi**: Web Crypto API & PostgreSQL Digest Engine (SHA-256)

### 🤖 Daftar Model AI (AI Model Matrix)

Berdasarkan `modellist.md`, SambungJaga AI mengintegrasikan model-model AI terbaik:

| Nama Model | Provider | Model ID | Fungsi Utama | Kuota & Batas Rate |
| :--- | :--- | :--- | :--- | :--- |
| **Qwen 3.8 27B** | Alibaba Cloud | `qwen/qwen3.8-27b` | Extraksi Persepsi & Reasoning Konteks Perawatan | 30 req/min • 200K tok/day |
| **Llama Prompt Guard 2** | Meta | `meta-llama/llama-prompt-guard-2-22m` | Filter Prompt Injection & Ingesti Teks Aman | 30 req/min • 500K tok/day |
| **GPT OSS 120B** | OpenAI | `openai/gpt-oss-120b` | Superagent Orchestration & Synthesizer Handover | 30 req/min • 200K tok/day |
| **Safety GPT OSS 20B** | OpenAI | `openai/gpt-oss-safeguard-20b` | Validasi Policy Gate & Enforce Envelope (A0-A3) | 3 req/min • 200K tok/day |
| **Whisper Large V3 / Turbo** | OpenAI | `whisper-large-v3-turbo` | Speech-to-Text Laporan Suara Pengasuh Realtime | 20 req/min • 2K req/day |

---

## 🚀 Cara Menjalankan Project (Local Development)

### 📋 Prasyarat
* **Node.js**: Versi 20.x LTS atau lebih baru
* **npm**: Versi 10.x+
* **Supabase CLI**: Untuk mengelola migration & database lokal/remote

### 1️⃣ Clone Repository & Install Dependensi

```bash
git clone https://github.com/s1informatika11s25007-maker/SambungJagaAI.git
cd SambungJagaAI
npm ci
```

### 2️⃣ Konfigurasi Variabel Lingkungan (.env.local)

Salin berkas templat konfigurasi dan pasang kredensial Supabase Anda:

```bash
cp .env.example .env.local
```

Isi variabel pada `.env.local`:

```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

> ⚠️ **Catatan Keamanan**: Jangan pernah menyimpan `service_role_key` atau kredensial rahasia database di file `.env.local` frontend.

### 3️⃣ Setup Database & Migration Supabase

Hubungkan Supabase CLI ke proyek Anda dan terapkan migration skema database:

```bash
# Link ke project Supabase Anda
npx supabase link --project-ref YOUR_PROJECT_REF

# Terapkan seluruh SQL Migration (Views, RLS, RPC, Triggers)
npx supabase db push
```

### 4️⃣ Jalankan Server Pengkaji Lokal (Development Server)

```bash
npm run dev
```

Aplikasi dapat diakses melalui browser pada `http://localhost:5173`.

---

## 🧪 Eksekusi Pengujian (Testing Suite)

Proyek ini dilengkapi dengan unit test, integration test, dan end-to-end testing yang komprehensif:

```bash
# Jalankan Unit Tests (Vitest)
npm run test:unit

# Jalankan E2E Tests (Playwright)
npm run test:e2e

# Jalankan Seluruh Test Suite
npm run test
```

---

## 🔑 Manajemen Akun & Log Masuk Demo

Halaman masuk (*Login Page*) menyediakan fitur dropdown **Akun Demo** yang aman:
* Akun demo tidak di-hardcode di frontend, melainkan dibaca dinamis melalui RPC Supabase `public.list_demo_login_accounts()`.
* Untuk mengaktifkan akun demo di lingkungan Anda, jalankan perintah SQL berikut di Supabase SQL Editor:

```sql
UPDATE hr_domain.staff_profiles AS p
SET is_demo_login = TRUE
FROM auth.users AS u
WHERE u.id = p.user_id
  AND u.email = 'alamat-akun-demo@domain-anda.id';
```

---

## 📤 Menjalankan Push ke GitHub Repository

Untuk menyimpan dan mengirimkan seluruh pembaruan ke repositori GitHub:

```bash
# 1. Periksa status perubahan
git status

# 2. Tambahkan berkas yang diperbarui
git add .

# 3. Buat commit dengan pesan terstruktur
git commit -m "docs: update README.md dengan visual arsitektur 3D, layer pemrosesan data, dan spesifikasi lengkap"

# 4. Push ke cabang utama GitHub
git push origin main
```

---

## 🔒 Kebijakan Keamanan, Data Privacy, & Batasan Klinis

1. **Bukan Pengganti Keputusan Klinis**: SambungJaga AI adalah sistem otomasi administratif dan koordinasi tugas. Keputusan diagnosis, dosis obat, dan tindakan medis tetap berada penuh di tangan dokter/staf medis berwenang.
2. **Prinsip Minimal Data PII**: Informasi kesehatan sensitif (PHI/PII) dikirim dengan penyaringan privasi (*Consent Disclosure Filter*).
3. **Integritas SHA-256**: Hash berkas foto/bukti digunakan untuk deteksi manipulasi artefak lokal, bukan sebagai tanda tangan digital medis tersertifikasi.

---

<div align="center">
  <sub>Dikembangkan dengan ❤️ untuk Keberlanjutan Perawatan Lansia & Kesehatan Terpadu Indonesia</sub><br/>
  <b>© 2026 SambungJaga AI Team. All Rights Reserved.</b>
</div>
