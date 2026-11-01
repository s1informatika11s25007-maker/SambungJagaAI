# SambungJaga — Care Continuity Workspace

SambungJaga adalah aplikasi web untuk merapikan koordinasi tugas, laporan petugas, bukti, serah terima shift, dan informasi terbatas untuk keluarga. Antarmuka menggunakan React 18, Vite, Tailwind CSS, dan Supabase. AI/otomasi bertindak sebagai alat bantu operasional; keputusan klinis dan penutupan tugas yang memerlukan otorisasi tetap melalui petugas berwenang.

## Yang diperbarui

- **Landing page dan autentikasi** dengan desain responsif, motion ringan, reduced-motion support, form masuk/daftar yang jelas, serta autentikasi email/kata sandi melalui Supabase Auth.
- **Workspace berbasis peran** untuk caregiver, supervisor, admin, dan keluarga. Peran supervisor/admin tidak dapat dipilih melalui pendaftaran mandiri.
- **Dashboard supervisor dan Autopilot** untuk memetakan tugas yang belum ditugaskan berdasarkan kompetensi petugas aktif, mengeskalasi tugas prioritas tinggi yang terlambat, dan merapikan notifikasi. Hasil tindakan dilaporkan setelah operasi database berhasil.
- **Rule Library** menyimpan revisi di database. Editor tidak berpura-pura memberikan persetujuan klinis; pengujian replay hanya disebut terverifikasi saat layanan server mengembalikan hasil terstruktur yang valid.
- **Simulator** membedakan data tidak cukup, analisis lokal terbatas, dan hasil server terverifikasi.
- **Portal keluarga** hanya membaca penghuni yang terhubung ke akun keluarga melalui relasi akses database dan hanya menampilkan ringkasan minimal.
- **Serah terima shift** memakai tanda tangan dua sisi yang terikat ke akun pengirim/penerima, dan digest SHA-256 dihitung di database. Digest integritas bukan tanda tangan digital tersertifikasi.
- **Bukti foto** mencatat hash SHA-256 dari file yang dipilih pada perangkat. Pada revisi ini file gambar tidak disimpan ke Supabase Storage; hash adalah sidik-jari file, bukan pengganti artefak visual yang dapat diperiksa. Jangan gunakan hash saja sebagai dasar keputusan; verifikasi fisik/artefak tetap diperlukan sebelum penutupan. QR lokasi dan verifikasi ganda E2/E3 tidak diklaim tersedia sebelum integrasi identitas/perangkat dibangun. OCR adalah pembacaan awal yang harus diperiksa manusia; OCR tidak memberi diagnosis atau instruksi perawatan.
- **Audit** membedakan entri lokal yang belum disimpan dari catatan dengan hash server.

## Persyaratan

- Node.js 20 atau lebih baru (disarankan versi LTS yang kompatibel dengan lockfile).
- Akun/proyek Supabase.
- Akses ke Supabase CLI untuk menerapkan migration.

## Menjalankan aplikasi lokal

```bash
npm ci
cp .env.example .env.local
# Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY dari proyek Supabase Anda
npm run dev
```

Untuk verifikasi kode:

```bash
npm run build
npm run test:unit
```

## Menyiapkan Supabase

1. Buat proyek Supabase baru atau pastikan backup database tersedia sebelum menerapkan perubahan pada proyek yang sudah berjalan.
2. Isi `.env.local` dengan URL proyek dan anon/publishable key. Jangan pernah menaruh `service_role`, password database, access token CLI, atau API key provider pada variabel `VITE_*`.
3. Hubungkan Supabase CLI ke proyek yang benar, lalu terapkan migration secara berurutan:

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

4. Pastikan API schema exposure/extra search path Supabase mengizinkan schema `public`. View `public.*` yang dibuat migration menjadi jalur akses aplikasi terhadap tabel domain internal.
5. Aktifkan konfirmasi email sesuai kebijakan fasilitas. Setelah mendaftar, caregiver/keluarga harus memverifikasi email bila pengaturan Auth mewajibkannya.
6. Buat atau undang akun supervisor/admin melalui proses administrator. Jangan mengubah metadata pengguna secara manual untuk menaikkan hak akses. Role supervisor/admin berasal dari profil yang dikelola administrator.
7. Untuk akun keluarga, hubungkan akun Auth ke penghuni melalui RPC `public.link_family_resident(user_auth_uuid, resident_uuid, 'filtered_summary')` menggunakan sesi supervisor/admin yang terautentikasi. Jangan memberi akses sebelum persetujuan dan dasar berbagi informasi keluarga diperiksa oleh fasilitas.

Migration menambahkan antara lain: trigger profil Auth terbatas, view API ber-RLS, pembatasan relasi keluarga, Rule Library tersimpan, RPC tanda tangan serah terima, digest integritas database, dan RPC approval bukti yang transaksional. Periksa kebijakan/kolom pada database aktual sebelum deploy karena proyek yang sudah memiliki migration berbeda perlu direkonsiliasi terlebih dahulu.

### Dropdown akun demo pada halaman login

Halaman login menyediakan kembali dropdown akun demo yang membaca data langsung dari Supabase melalui RPC `public.list_demo_login_accounts()`. Migration `20261030170000_demo_login_directory.sql` menambahkan penanda `is_demo_login` (default `false`) dan RPC yang hanya mengembalikan nama, peran, dan email profil yang secara eksplisit dipilih admin. Tidak ada akun atau kata sandi demo yang ditanam di frontend. Memilih akun hanya mengisi email; pengguna tetap harus memasukkan kata sandi asli dan diverifikasi oleh Supabase Auth.

Untuk memunculkan akun yang memang sudah ada, terapkan migration terlebih dahulu, lalu tandai akun demo yang disetujui melalui Supabase SQL Editor (ganti alamat email dengan akun nyata fasilitas):

```sql
UPDATE hr_domain.staff_profiles AS p
SET is_demo_login = TRUE
FROM auth.users AS u
WHERE u.id = p.user_id
  AND u.email = 'alamat-akun-demo@domain-anda.id';
```

Ulangi untuk akun demo yang disetujui. Untuk menarik akun dari dropdown, ubah `is_demo_login` kembali menjadi `FALSE`. Jangan tandai akun staf/keluarga sungguhan sebagai demo tanpa persetujuan dan jangan gunakan kata sandi bersama. Dropdown menampilkan maksimal satu akun per peran sesuai ketersediaan data Supabase.


### Edge Functions opsional

Folder `supabase/functions/` berisi fungsi `ai_superagent`, `ai_prompt_guard`, `ai_failure_simulator`, `ai_rule_replay`, `ai_handover_contract`, `ai_evidence_verifier`, dan `ai_consent_filter`. Deploy hanya fungsi yang dipakai dan konfigurasi secrets di Supabase Functions Secrets (mis. `SUPABASE_PROJECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY` sesuai fungsi). Secret server tidak boleh dimasukkan ke bundle frontend.

Sebagian fitur memiliki fallback lokal yang ditandai secara eksplisit sebagai belum terverifikasi. Tanpa Edge Function terkait, jangan mengartikan hasil lokal sebagai pemeriksaan keamanan, validasi bukti, atau analisis server.

## Tidak ada data contoh

Aplikasi tidak memerlukan akun contoh atau record tiruan. `supabase/seed/seed.sql` sengaja menjadi no-op; ia tidak menghapus tabel maupun mengisi data fiktif. Pendaftaran akun berjalan melalui Supabase Auth, sedangkan data operasional dibuat oleh pengguna berwenang. Empty state berarti belum ada data yang diizinkan untuk akun tersebut, bukan alasan untuk menampilkan data contoh.

## Catatan keamanan dan batasan

- Jangan memasukkan data pasien nyata ke environment uji tanpa dasar pemrosesan, persetujuan, dan kontrol akses yang sesuai.
- RLS tetap menjadi sumber otorisasi; menyembunyikan menu di frontend bukan pengganti kebijakan database.
- Hash SHA-256 membantu mendeteksi perubahan payload yang dicakup, tetapi tidak membuktikan identitas pemotret, keaslian waktu kamera, atau tanda tangan digital tersertifikasi.
- OCR dapat salah membaca angka. Periksa gambar dan nilai sumber secara manual; jangan gunakan output OCR sebagai instruksi klinis.
- Autopilot sengaja membatasi diri ke tindakan administratif reversibel yang didukung database. Ia tidak memberi obat, menyetujui tindakan klinis, menandatangani serah terima, atau mengirim antrean offline tanpa attestation perangkat.
- ZIP distribusi tidak menyertakan `.env`, token, kunci privat, `.git`, cache Supabase lokal, `node_modules`, atau hasil build.

## Struktur utama

```text
src/
  pages/          Landing, auth, caregiver, supervisor, family, rule, simulator, audit, handover
  components/     Komponen UI per fitur
  hooks/          State dan integrasi aplikasi
  services/       Auth, data access, automation, AI, audit, evidence, simulator
  supabase/       Browser Supabase client
supabase/
  migrations/     Skema, RLS, views, dan RPC
  functions/      Supabase Edge Functions
  seed/           No-op; tidak ada data demo
tests/            Unit, komponen, dan E2E
```
