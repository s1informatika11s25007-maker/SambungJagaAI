/**
 * SambungJaga AI — Admin Security & Configuration
 *
 * Displays RLS Multi-Tenant Isolation status, Private Storage bucket policies,
 * Audit Trail cryptographical logs, and Policy A0-A3 Authority Framework.
 */

import React from 'react';
import { ShieldCheck, Lock } from 'lucide-react';
import Badge from '../../components/common/Badge';

export default function AdminSecurityConfigPage() {
  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-sky-600" />
          <span>Keamanan, Isolasi Tenant & Kerangka Kerja Kebijakan</span>
        </h2>
        <p className="text-xs text-slate-500">
          Infrastruktur keamanan, RLS Multi-Tenant Isolation, Kebijakan Private Storage Bucket, dan Kerangka Kerja Wewenang A0-A3.
        </p>
      </div>

      {/* Security Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Multi-Tenant Isolation</span>
            <Badge variant="warning">PERLU UJI INTEGRASI</Badge>
          </div>
          <p className="text-sm font-bold text-slate-900">PostgreSQL RLS per `facility_id`</p>
          <p className="text-xs text-slate-500">
            Kebijakan RLS tersedia dalam migrasi. Isolasi baru dapat dinyatakan lulus setelah pengujian lintas fasilitas terhadap database deployment.
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Private Storage RLS</span>
            <Badge variant="warning">PERLU UJI STORAGE</Badge>
          </div>
          <p className="text-sm font-bold text-slate-900">Bucket `private-care-evidence`</p>
          <p className="text-xs text-slate-500">
            Bucket privat dan kebijakan akses tersedia. Uji upload, download, dan penolakan akses lintas role tetap wajib dijalankan pada project Supabase aktif.
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Evidence Trust SHA-256</span>
            <Badge variant="info">HASH FILE</Badge>
          </div>
          <p className="text-sm font-bold text-slate-900">Pemeriksaan Hash Kriptografis</p>
          <p className="text-xs text-slate-500">
            SHA-256 dihitung dari byte file sebelum dikirim. Hash mendukung pemeriksaan integritas/duplikasi; hash saja bukan bukti keaslian waktu atau lokasi pengambilan.
          </p>
        </div>
      </div>

      {/* Policy Framework A0 - A3 */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Lock className="w-4 h-4 text-indigo-600" />
          <span>Kerangka Kerja Kebijakan Wewenang Agen (A0 - A3)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">Level A0 & A1 — Otomasi Mandiri</span>
              <Badge variant="info">AUTONOMOUS</Badge>
            </div>
            <p className="text-slate-600">
              Pemberihan transcript suara, ekstraksi vital sign OCR, pembuatan tugas rutin, dan pengiriman notifikasi pengingat berjalan otomatis tanpa mengganggu staf.
            </p>
          </div>

          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-950">Level A3 — Persetujuan Manusia Wajib</span>
              <Badge variant="warning">A3 HUMAN REVIEW</Badge>
            </div>
            <p className="text-amber-900">
              Keputusan klinis, verifikasi bukti foto E3, serah terima shift dua sisi, penonaktifan staf, dan tindak lanjut keluhan keluarga wajib disetujui supervisor manusia yang berwenang.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
