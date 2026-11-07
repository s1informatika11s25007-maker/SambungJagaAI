<div align="center">
  <p align="center">
    <img src="public/3d-hero-animation.svg" alt="SambungJaga AI" width="100%" style="max-width: 880px;" />
  </p>

  # SambungJaga AI — Care Continuity Workspace
  **Ruang kerja koordinasi perawatan lansia dan serah-terima antar-shift.**

  <p>
    <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black" alt="React 18" />
    <img src="https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white" alt="Vite 5" />
    <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white" alt="Supabase" />
    <img src="https://img.shields.io/badge/Status-Hackathon%20MVP-orange" alt="Hackathon MVP" />
  </p>
</div>

---

## 1. Masalah yang diselesaikan

Informasi mengenai penghuni panti atau fasilitas perawatan dapat terputus ketika caregiver berganti shift. Catatan harian, tugas yang belum selesai, bukti pekerjaan, dan pengaduan keluarga sering berada di tempat berbeda. SambungJaga AI dirancang untuk membantu satu tim melihat konteks yang sama, mengetahui apa yang belum selesai, dan mencatat siapa yang menyerahkan serta menerima tanggung jawab.

**Nilai utama produk:** mengurangi tugas perawatan yang terlupa dan membuat proses serah-terima lebih dapat ditelusuri. Sistem ini adalah alat koordinasi administratif, bukan pengganti tenaga kesehatan atau rekam medis resmi.

## 2. Peran dan alur produk

| Peran | Tujuan utama |
|---|---|
| Caregiver | Mencatat observasi perawatan, melihat kewajiban, dan menyerahkan tugas terbuka ke shift berikutnya. |
| Supervisor | Meninjau tugas, bukti, eskalasi, pengaduan, dan serah-terima. |
| Keluarga | Mengirim permintaan kunjungan/pengaduan dan menerima informasi yang telah diizinkan fasilitas. |
| HR/Admin fasilitas | Mengelola staf, jadwal, kehadiran, dan ringkasan operasional. |

### Alur demo utama yang disarankan

1. Masuk sebagai caregiver dan pilih seorang penghuni yang memang terdaftar pada fasilitas demo.
2. Catat observasi singkat, misalnya “penghuni sudah sarapan”. AI boleh membantu merapikan atau mengklasifikasikan catatan, tetapi hasilnya tetap berstatus laporan manusia.
3. Tampilkan tugas yang masih terbuka untuk penghuni tersebut. Tandai penyelesaian hanya setelah bukti dan pemeriksaan yang relevan.
4. Buat draf serah-terima dengan memilih caregiver penerima yang aktif pada fasilitas yang sama.
5. Masuk sebagai pengirim untuk menandatangani, lalu masuk sebagai penerima untuk mengonfirmasi. Status baru menjadi terkonfirmasi setelah dua sisi menyelesaikan langkahnya.
6. Tunjukkan jejak audit dan ringkasan supervisor untuk membuktikan nilai produk.

Gunakan akun dan data demo sintetis. Jangan tampilkan nama, foto, diagnosis, atau data kesehatan nyata saat presentasi.

## 3. Arsitektur teknis

- **Frontend:** React 18, Vite 5, React Router, Tailwind CSS.
- **Backend platform:** Supabase Auth, PostgreSQL, Row Level Security, RPC, dan Edge Functions.
- **Server routes:** fungsi di folder `api/` untuk pekerjaan terjadwal/worker pada deployment yang sesuai.
- **Offline:** laporan teks terpilih dapat disimpan terenkripsi di IndexedDB dan dikirim ulang melalui RPC yang memverifikasi sesi staf, penghuni, dan fasilitas. Antrean yang tidak dapat dienkripsi atau tidak memiliki identitas fasilitas/penghuni akan ditolak.
- **Quality checks:** Vitest untuk unit test, Playwright untuk end-to-end, dan pemeriksaan sintaks JavaScript tanpa dependency tambahan.

Diagram `public/3d-data-layers.svg` dan spesifikasi arsitektur menggambarkan rancangan logis. Diagram tersebut tidak berarti semua layer sudah menjadi layanan terpisah atau telah lulus uji produksi.

## 4. Status fitur — baca sebelum demo

Status berikut sengaja membedakan kode yang tersedia dari integrasi yang masih harus diuji di staging.

| Area | Status realistis |
|---|---|
| Autentikasi dan pemisahan peran | Tersedia dalam kode; wajib diuji dengan akun peran dan RLS di project Supabase demo. |
| Laporan caregiver dan kewajiban | Alur kode tersedia; validasi end-to-end membutuhkan migrasi, data seed, dan akun aktif. |
| Serah-terima dua pihak | RPC draf dan tanda tangan tersedia; wajib uji dua akun berbeda pada satu fasilitas. |
| Laporan offline teks | Disiapkan dengan AES-GCM/IndexedDB dan RPC idempoten; uji pada browser target sebelum menjanjikan dukungan offline. |
| Antrean suara/catatan offline | Transkrip/catatan dapat menggunakan adapter server yang aman, tetapi audio mentah belum memiliki alur unggah dan retensi lengkap. Jangan demo sebagai fitur audio offline end-to-end. |
| Portal keluarga | Permintaan kunjungan, pengaduan, preferensi, dan tanda terima memiliki jalur persistensi; kebijakan izin/consent sensitif tetap fail-closed sampai workflow consent database dan proses persetujuan fasilitas tervalidasi. |
| AI / model eksternal | Edge Functions mengacu pada ID model/provider di `modellist.md`; keberhasilan aktual bergantung pada API key, model yang masih tersedia, deployment function, kuota, dan response schema. Uji langsung di staging. |
| WhatsApp/email/push | Membutuhkan kredensial provider, template, serta konfigurasi delivery. Jangan mengklaim terkirim hanya karena job berhasil dibuat. |
| Backup/PITR | Belum dibuktikan oleh skrip pemeriksaan. Backup dan restore harus diuji pada project terpisah dengan prosedur pemulihan nyata. |

## 5. Prasyarat

- Node.js 22.22.2 atau lebih baru dan npm 10 atau lebih baru (sesuai engine dependency di lockfile).
- Project Supabase khusus demo/staging.
- Supabase CLI untuk menerapkan migration.
- API key provider AI hanya bila fitur AI eksternal akan didemokan.

## 6. Menjalankan secara lokal

```bash
# 1. Masuk ke root proyek
cd SambungJaga

# 2. Pasang dependency tepat berdasarkan lockfile
npm ci

# 3. Buat konfigurasi lokal
cp .env.example .env.local

# 4. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di .env.local

# 5. Terapkan seluruh migration ke project Supabase yang benar
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push

# 6. Jalankan aplikasi
npm run dev
```

Buka `http://localhost:3000`.

**Penting:** `.env.local` hanya untuk nilai frontend yang memang boleh diketahui browser, seperti Supabase URL dan anon key. Jangan pernah memasukkan `SUPABASE_SERVICE_ROLE_KEY`, password database, `CRON_SECRET`, atau API key provider ke variabel berawalan `VITE_`.

## 7. Pemeriksaan kualitas

```bash
# JavaScript syntax check; tidak menggantikan ESLint atau type-check
npm run lint

# Unit tests
npm run test:unit

# Build production; sekaligus menjalankan JSX/module compilation
npm run build

# Build lalu jalankan Playwright E2E
npm run test:e2e

# Semua test lokal
npm test

# Audit dependency
npm run security:audit
```

`npm run lint` sengaja disebut **syntax check**, bukan ESLint. Vite build memeriksa kompilasi JSX dan graph modul. CI akan gagal jika install, unit test, build, atau audit high/critical gagal; tidak ada skor lomba/leaderboard buatan.

## 8. Environment server dan jadwal

Untuk endpoint cron/worker, atur variabel ini melalui environment server/deployment, bukan `.env.local` frontend:

- `SUPABASE_PROJECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` — rahasia acak minimal 32 karakter dan **berbeda** dari service-role key.
- `FACILITY_ID` — diperlukan untuk standalone worker/scheduler.
- `DB_SSL_REJECT_UNAUTHORIZED=true` untuk migrasi database di lingkungan normal.

Semua endpoint `/api/cron-*` memerlukan `Authorization: Bearer <CRON_SECRET>`. Header yang sekadar terlihat seperti header cron platform tidak dianggap autentikasi.

Panduan deployment tambahan: [`scripts/DEPLOYMENT.md`](scripts/DEPLOYMENT.md).

## 9. Batasan keamanan dan klinis

1. AI hanya membantu ekstraksi atau peringkasan. Catatan yang dihasilkan AI harus ditinjau manusia; AI tidak boleh menetapkan diagnosis, dosis obat, atau mengambil keputusan klinis.
2. Bukti foto, tanda tangan, dan hash tidak otomatis membuktikan tindakan klinis benar. Verifikasi manusia dan prosedur fasilitas tetap diperlukan.
3. Persetujuan keluarga untuk data sensitif tetap ditolak secara default ketika status consent belum tersimpan dan tervalidasi.
4. Enkripsi offline di browser membantu melindungi data tersimpan, tetapi tidak melindungi aplikasi dari XSS atau perangkat yang sudah dikuasai penyerang. Gunakan perangkat demo terkendali dan data sintetis.
5. Jangan gunakan untuk operasional fasilitas atau data kesehatan nyata sebelum uji keamanan, legal/privacy, backup restore, pemulihan insiden, dan validasi klinis diselesaikan.

## 10. Fokus pengembangan berikutnya

Lihat [`HACKATHON_READINESS_AND_REPAIR.md`](HACKATHON_READINESS_AND_REPAIR.md) untuk daftar gap, prioritas perbaikan, rancangan demo, dan kriteria “siap lomba”.

---

<div align="center">
  <sub>Dibangun untuk kesinambungan koordinasi perawatan lansia — 2026</sub>
</div>
