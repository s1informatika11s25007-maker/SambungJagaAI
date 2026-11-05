/**
 * SambungJaga AI — Staff & Demo Profiles Directory Service
 *
 * Secure frontend profile fetcher without embedding cleartext passwords in client JS bundles.
 */

import { supabase } from '../../supabase/client/client';

export const ROLE_LABELS = {
  caregiver: 'Pengasuh / Perawat',
  supervisor: 'Supervisor Klinis',
  family: 'Wali Keluarga',
  admin_hr: 'Admin HR / Panti'
};

const DEMO_ROLE_ORDER = ['caregiver', 'supervisor', 'family', 'admin_hr'];

export const DEFAULT_FALLBACK_DEMO_ACCOUNTS = [
  {
    id: 'demo-caregiver-1',
    key: 'demo_caregiver_1',
    name: 'Suster Dewi Pertiwi',
    role: 'caregiver',
    roleTitle: ROLE_LABELS.caregiver,
    email: 'caregiver1@sambungjaga.id'
  },
  {
    id: 'demo-supervisor-1',
    key: 'demo_supervisor_1',
    name: 'Ns. Ratna Sari, S.Kep',
    role: 'supervisor',
    roleTitle: ROLE_LABELS.supervisor,
    email: 'supervisor@sambungjaga.id'
  },
  {
    id: 'demo-family-1',
    key: 'demo_family_1',
    name: 'Bpk. Rina Wijaya (Anak)',
    role: 'family',
    roleTitle: ROLE_LABELS.family,
    email: 'keluarga1@sambungjaga.id'
  },
  {
    id: 'demo-admin-1',
    key: 'demo_admin_1',
    name: 'Hendra Setiawan, S.H.',
    role: 'admin_hr',
    roleTitle: ROLE_LABELS.admin_hr,
    email: 'admin@sambungjaga.id'
  }
];

/** Fetch real staff profiles allowed by active Supabase RLS policies. */
export async function fetchStaffProfiles() {
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('id,user_id,full_name,role,shift_status,avatar_url,competencies,phone_number');
  if (error) throw error;
  return (data || []).map((profile) => ({
    ...profile,
    name: profile.full_name || 'Pengguna SambungJaga',
    roleTitle: ROLE_LABELS[profile.role] || 'Pengguna'
  }));
}

/**
 * Retrieve profiles for demo-login directory (Without cleartext password exposure).
 */
export async function fetchDemoAccountsPerRole() {
  const { data, error } = await supabase.rpc('list_demo_login_accounts');
  if (error) throw error;

  const accounts = (data || []).map((profile) => ({
    id: profile.profile_id,
    key: `demo_${profile.role}_${profile.profile_id}`,
    name: profile.full_name || 'Pengguna SambungJaga',
    role: profile.role,
    roleTitle: ROLE_LABELS[profile.role] || 'Pengguna',
    email: profile.email || ''
  })).filter((account) => account.email);

  const uniquePerRole = DEMO_ROLE_ORDER
    .map((role) => accounts.find((account) => account.role === role))
    .filter(Boolean);

  return uniquePerRole;
}
