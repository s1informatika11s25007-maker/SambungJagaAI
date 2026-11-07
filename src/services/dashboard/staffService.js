/**
 * SambungJaga AI — Staff & Demo Profiles Directory Service
 *
 * All demo credentials (email & password) are fetched dynamically from the database
 * using the connection configuration in .env. No credentials are hardcoded.
 */

import { supabase } from '../../supabase/client/client';

export const ROLE_LABELS = {
  caregiver: 'Pengasuh / Perawat',
  supervisor: 'Supervisor Klinis',
  family: 'Wali Keluarga',
  admin_hr: 'Admin HR / Panti',
  platform_admin: 'Administrator Platform'
};

export const ROLE_SHORT_NAMES = {
  admin_hr: 'Admin',
  caregiver: 'Staff',
  supervisor: 'Supervisor',
  family: 'Keluarga',
  platform_admin: 'Platform Admin'
};

const DEMO_ROLE_ORDER = ['admin_hr', 'caregiver', 'supervisor', 'family', 'platform_admin'];

// Strict compliance: No hardcoded demo emails or passwords in fallback array
export const DEFAULT_FALLBACK_DEMO_ACCOUNTS = [];

/** Formats prompt menu demo option label (e.g. "1. Admin (admin@mail.com)") */
export function formatDemoOptionLabel(account, index) {
  const roleName = ROLE_SHORT_NAMES[account.role] || account.roleTitle || account.role;
  return `${index + 1}. ${roleName} (${account.email})`;
}

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
 * Retrieve demo accounts dynamically from the database (strictly 1 account per role).
 * Credentials (email & password) are fetched dynamically using .env Supabase config.
 */
export async function fetchDemoAccountsPerRole() {
  const { data, error } = await supabase.rpc('list_demo_login_accounts');
  if (error) throw error;

  const rawList = (data || []).map((profile) => ({
    id: profile.profile_id || profile.id,
    key: `demo_${profile.role}_${profile.profile_id || profile.id}`,
    name: profile.full_name || 'Pengguna SambungJaga',
    role: profile.role,
    roleTitle: ROLE_LABELS[profile.role] || profile.role,
    email: profile.email || '',
    password: profile.password || ''
  })).filter((account) => account.email);

  // Group by role to ensure strictly 1 demo account per role
  const roleMap = new Map();
  for (const account of rawList) {
    if (!roleMap.has(account.role)) {
      roleMap.set(account.role, account);
    }
  }

  // Sort by DEMO_ROLE_ORDER then remaining roles
  const result = [];
  for (const role of DEMO_ROLE_ORDER) {
    if (roleMap.has(role)) {
      result.push(roleMap.get(role));
      roleMap.delete(role);
    }
  }
  for (const account of roleMap.values()) {
    result.push(account);
  }

  return result;
}

