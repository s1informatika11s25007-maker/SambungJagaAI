import { supabase, isSupabaseConfigured } from '../../supabase/client/client';
import { ROLE_LABELS } from '../dashboard/staffService';

const AUTH_TIMEOUT_MS = 12000;

function withTimeout(promise, ms = AUTH_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Koneksi autentikasi terlalu lama. Periksa jaringan lalu coba lagi.')), ms))
  ]);
}

function normalizeProfile(profile, authUser) {
  if (!profile || !authUser) return null;
  // Strict Deactivated / Inactive Account Guard
  if (profile.is_active === false || profile.status === 'inactive' || profile.status === 'deactivated') {
    return null;
  }

  const role = profile.role || 'caregiver';
  return {
    id: profile.id,
    authUserId: authUser.id,
    key: `account_${role}_${profile.id}`,
    name: profile.full_name || authUser.user_metadata?.full_name || 'Pengguna SambungJaga',
    full_name: profile.full_name || authUser.user_metadata?.full_name || 'Pengguna SambungJaga',
    role,
    roleTitle: ROLE_LABELS[role] || 'Pengguna',
    email: authUser.email || '',
    avatar: profile.avatar_url || '',
    competencies: profile.competencies || [],
    phone: profile.phone_number || '',
    is_active: profile.is_active !== false
  };
}

export async function getAuthenticatedAccount(authUser) {
  if (!authUser?.id) return null;
  const { data, error } = await withTimeout(
    supabase.from('staff_profiles').select('*').eq('user_id', authUser.id).maybeSingle()
  );
  if (error) throw error;
  if (data && (data.is_active === false || data.status === 'inactive' || data.status === 'deactivated')) {
    throw new Error('Akun Anda telah dinonaktifkan oleh administrator fasilitas. Akses masuk ditolak.');
  }
  return normalizeProfile(data, authUser);
}

export async function signInWithEmailPassword(email, password) {
  if (!isSupabaseConfigured()) throw new Error('Konfigurasi Supabase belum tersedia. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY terlebih dahulu.');
  if (!email?.trim() || !password) throw new Error('Masukkan email dan kata sandi.');
  const { data, error } = await withTimeout(
    supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  );
  if (error) throw error;

  try {
    const account = await getAuthenticatedAccount(data.user);
    if (!account) {
      await supabase.auth.signOut();
      throw new Error('Akun berhasil diverifikasi, tetapi profil SambungJaga tidak aktif atau belum tersedia. Hubungi administrator fasilitas.');
    }
    return account;
  } catch (accErr) {
    await supabase.auth.signOut();
    throw accErr;
  }
}

export async function signUpWithEmailPassword({ fullName, email, password, phone, role }) {
  if (!isSupabaseConfigured()) throw new Error('Konfigurasi Supabase belum tersedia. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY terlebih dahulu.');
  if (!fullName?.trim() || !email?.trim() || !password) throw new Error('Lengkapi nama, email, dan kata sandi.');
  if (!['caregiver', 'family'].includes(role)) {
    throw new Error('Pendaftaran mandiri hanya tersedia untuk Pengasuh dan Keluarga. Akses Supervisor/Admin harus diberikan administrator.');
  }
  const { data, error } = await withTimeout(supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        phone_number: phone?.trim() || null,
        role
      }
    }
  }));
  if (error) throw error;
  if (!data.session) {
    return { needsEmailConfirmation: true, account: null };
  }
  const account = await getAuthenticatedAccount(data.user);
  if (!account) {
    await supabase.auth.signOut();
    throw new Error('Akun dibuat, tetapi profil belum terbentuk. Periksa trigger profil pada migration database.');
  }
  return { needsEmailConfirmation: false, account };
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function getAuthErrorMessage(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('dinonaktifkan')) return 'Akun Anda telah dinonaktifkan oleh administrator fasilitas. Hubungi HR/Supervisor.';
  if (message.includes('invalid login credentials')) return 'Email atau kata sandi tidak sesuai.';
  if (message.includes('email not confirmed')) return 'Email belum diverifikasi. Buka tautan konfirmasi di kotak masuk email Anda.';
  if (message.includes('user already registered')) return 'Email ini sudah terdaftar. Silakan masuk.';
  if (message.includes('password')) return error.message;
  if (message.includes('fetch')) return 'Tidak dapat menghubungi server autentikasi. Periksa koneksi dan konfigurasi Supabase.';
  return error?.message || 'Terjadi kesalahan. Silakan coba kembali.';
}
