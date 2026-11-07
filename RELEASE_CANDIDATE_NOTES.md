# SambungJaga — Release Candidate (7 November 2026)

This archive is a **release candidate**, not a guarantee of production readiness or competition results. It contains code and SQL changes described below.

## Perubahan yang diterapkan

- Laporan caregiver menggunakan RPC database `fn_record_care_fact_and_obligation`; fakta dan obligation tidak lagi dibuat hanya dari state React.
- Bukti aktual wajib dikirim ke bucket privat, SHA-256 dihitung dari byte file, dan status awal selalu `pending_review`.
- Approval/rejection bukti diarahkan ke RPC supervisor `review_obligation_evidence`; approval memvalidasi fasilitas, tugas, bukti, dan kewenangan supervisor.
- Fallback sukses palsu pada jalur laporan dan bukti dihilangkan.
- Offline sensitive data menggunakan AES-GCM dengan non-exportable CryptoKey tersimpan di IndexedDB; kegagalan enkripsi tidak menulis plaintext.
- `admin_hr` diarahkan ke Workforce. Route teknis hanya role `platform_admin`. Supervisor, HR, caregiver, dan keluarga mempunyai menu yang lebih terpisah.
- Landing page menampilkan lima role dan tidak mengklaim status kontrol keamanan yang belum diuji.
- Dashboard agent, queue, dan security tidak lagi menyatakan semua hal ACTIVE/HEALTHY tanpa telemetry.
- Event bus tidak menerbitkan event sebagai sukses bila outbox database gagal atau facility scope tidak diberikan.
- Pemeriksaan kualitas pada catatan ini menggunakan lint setup lama; paket perbaikan 7 November menggantinya dengan syntax check JavaScript yang eksplisit karena ESLint tidak terkunci di dependency lockfile.

## Migrasi baru (wajib sebelum demo dengan database)

Urutan migrasi baru:

1. `20261106090000_add_platform_admin_role.sql`
2. `20261106100000_release_hardening.sql`
3. `20261107100000_hackathon_pilot_hardening.sql`
4. `20261107110000_family_portal_integrity.sql`

Gunakan Supabase CLI pada project staging terlebih dahulu. Jangan jalankan migrasi langsung di produksi tanpa backup dan validasi terhadap schema aktual.

## Provisioning platform administrator

`platform_admin` tidak dibuat melalui pendaftaran publik. Buat akun melalui Supabase Auth Admin, lalu ubah role profil oleh operator database yang berwenang setelah memastikan user ID benar. Contoh (sesuaikan user UUID):

```sql
UPDATE hr_domain.staff_profiles
SET role = 'platform_admin', updated_at = NOW()
WHERE user_id = '<AUTH_USER_UUID>'
  AND is_active = TRUE;
```

Pastikan tepat satu baris diperbarui. Role ini tidak otomatis memberikan akses ke catatan klinis/resident. Tambahkan kebijakan teknis minimum yang diperlukan dan uji RLS sebelum menggunakannya.

## Environment

- Jangan pernah menaruh service-role key, `DATABASE_URL`, API key AI, atau provider token pada `VITE_*`.
- Simpan secret server-only di secret manager deployment.
- Lengkapi `.env` dari `.env.example` secara lokal; jangan distribusikan `.env`.
- `CRON_SECRET` wajib berupa secret khusus yang berbeda dari Supabase service-role key.
- Konfigurasikan Supabase Storage bucket `private-care-evidence` sebagai private.

## Hal yang belum dapat dinyatakan selesai dari ZIP saja

1. Migrasi belum dijalankan terhadap project Supabase Anda; fungsi SQL harus diuji pada database staging.
2. Audit menyeluruh semua RLS legacy dan akses lintas fasilitas masih membutuhkan query `pg_policies` serta integration tests dengan dua facility nyata.
3. Role `platform_admin` memerlukan provisioning dan kebijakan teknis khusus di database deployment.
4. Heartbeat worker/scheduler, queue server, AI provider token/cost, backup, restore, dan secret rotation memerlukan deployment/telemetry nyata. UI sekarang sengaja menyebut data tersebut belum terverifikasi.
5. Family consent persistence, HR onboarding/offboarding, provider messaging, dan alur offline sync end-to-end masih memerlukan pengujian backend dan akun provider.
6. Perlu verifikasi upload, approval/rejection, resubmission, handover, family view, serta audit melalui E2E test.
7. Offline CryptoKey non-exportable terikat pada browser/device yang menyimpannya. Menghapus data situs/browser dapat menghilangkan kemampuan decrypt terhadap data offline lokal.

## Quality gate yang harus lulus sebelum kompetisi

- `npm ci`
- `npm run lint`
- `npm run build`
- `npm run test:unit`
- `npm run test:e2e` dengan base URL/database staging dan akun demo
- Jalankan seluruh migrasi pada database kosong dan jalur upgrade staging
- Uji RLS lintas dua fasilitas untuk kelima role
- Uji caregiver submit → pending review → supervisor approve/reject → obligation closure/reopen
- Uji upload Storage, signed URL, MIME validation, dan file object persistence
- Uji worker restart, retry, DLQ, idempotency, dan scheduler lease
- Uji family consent revoke dan pastikan akses keluarga dicabut
- Uji HR onboarding/offboarding serta session revocation
- Uji browser mobile dan demo 5 menit dengan seed data fiktif

## Catatan kompetisi

Tidak ada cara yang jujur untuk menjamin peluang juara 1 di atas 90%. Release candidate ini bertujuan memperbaiki integritas dan kejelasan produk. Nilai kompetisi baru bisa dinilai setelah quality gate dan validasi pengguna dilaksanakan.

## Tambahan koreksi pada 6 November 2026

- Pembuatan obligation manual dipindahkan ke RPC `create_care_obligation`, yang menghasilkan `mission_id` di server, memeriksa fasilitas dan caregiver tujuan, serta memakai kolom `required_evidence_grade` sesuai skema.
- Nilai confidence fakta hanya disimpan jika model benar-benar memberi angka confidence; nilai default buatan tidak digunakan.
- Pembersihan dan pembacaan notifikasi diarahkan ke `recipient_user_id` akun yang sedang masuk. Kebijakan INSERT yang baru mensyaratkan penerima akun. Beberapa pengirim notifikasi lama yang masih hanya mengisi `recipient_role` harus dimigrasikan ke pengiriman per akun; notifikasi tersebut tidak dianggap terkirim.
- Verifikasi WebP memeriksa signature `WEBP` selain header RIFF.

## Batasan tambahan yang diketahui

- Sejumlah operasi HR dan Family yang lebih lama masih membutuhkan refaktor server-side dan pengujian transaksi; jangan menganggap onboarding/offboarding, consent, preferensi keluarga, dan seluruh notifikasi eksternal siap produksi hanya dari keberadaan service/page.
- Pengiriman notifikasi role lama yang belum mengisi `recipient_user_id` akan ditolak oleh kebijakan insert baru. Migrasikan setiap pemanggil ke recipient UUID yang diverifikasi sebelum mengaktifkan workflow notifikasi terkait.
- Family account yang mempunyai relasi ke beberapa fasilitas memerlukan resolusi tenant kontekstual per penghuni; helper fasilitas saat ini memilih satu fasilitas terhubung untuk sesi tersebut.
- Angka atau persentase otomatisasi, telemetry, AI cost, backup/restore, serta health worker tetap tidak boleh dipublikasikan sebagai nilai terukur sebelum sumber runtime terhubung.


## Tambahan koreksi pada 7 November 2026

- Endpoint cron menuntut Bearer `CRON_SECRET` khusus dan tidak menerima header yang dapat dipalsukan atau service-role key sebagai autentikasi.
- Offline report/voice/note tidak lagi menggunakan fallback plaintext `localStorage`, memory store, atau tenant `FAC-001`; sinkronisasi menggunakan RPC ber-idempotensi dan menunggu acknowledgment server. Audio mentah belum diunggah sebagai bagian dari sinkronisasi transcript.
- Draf handover dibuat melalui RPC dengan profil pengirim/fasilitas yang berasal dari sesi server; tanda tangan awal kosong dan perlu dua pihak.
- Family Portal tidak melaporkan sukses palsu saat DB gagal; kunjungan menunggu review, pengaduan tidak auto-resolved, dan consent tetap PENDING sampai workflow database tersedia.
- Skrip pemeriksaan database tidak mengklaim sebagai PITR/restore drill. Prosedur backup/restore tetap perlu diuji terpisah.
- Dependency lock root diperbaiki, engine minimum diperjelas menjadi Node.js 22.22.2+, dan CI tidak lagi menghitung skor kompetisi buatan atau menelan kegagalan.
- Fresh install, unit tests, build, E2E, dan migration SQL tetap harus dijalankan di staging. Pemeriksaan pada sesi ini terbatas oleh tidak tersedianya paket npm di cache dan kegagalan akses registry.


## Status verifikasi paket 7 November 2026

Pemeriksaan sintaks Node.js berhasil untuk 111 file JavaScript. Fresh install dependencies tidak selesai dalam lingkungan ini; Node.js yang tersedia (`v22.16.0`) juga lebih rendah dari engine minimum proyek (`v22.22.2`). Oleh karena itu build Vite, unit tests, Playwright E2E, dan audit npm belum dapat diklaim lulus. Bundle `dist/` lama dikeluarkan dari arsip perbaikan agar tidak ada asset deploy yang tertinggal dari source terbaru. Jalankan `npm ci` dan `npm run build` setelah menggunakan Node.js 22.22.2 atau lebih baru.
