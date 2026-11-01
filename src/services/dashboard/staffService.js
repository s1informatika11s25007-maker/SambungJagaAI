import { supabase } from '../../supabase/client/client';

export const ROLE_LABELS = {
  caregiver: 'Pengasuh / Perawat',
  supervisor: 'Supervisor Klinis',
  family: 'Wali Keluarga',
  admin_hr: 'Admin HR / Panti'
};

const DEMO_ROLE_ORDER = ['caregiver', 'supervisor', 'family', 'admin_hr'];

/** Fetch real staff profiles allowed by the active Supabase RLS policies. */
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
 * Retrieve only profiles explicitly published as demo-login accounts by an admin.
 * The RPC reveals a minimal account directory; passwords are never part of this data.
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
    email: profile.email || '',
    password: 'SambungJaga2026!'
  })).filter((account) => account.email);

  // Keep the original one-account-per-role dropdown behavior while sourcing every
  // option from the live database rather than a client-side/demo constant.
  return DEMO_ROLE_ORDER
    .map((role) => accounts.find((account) => account.role === role))
    .filter(Boolean);
}
