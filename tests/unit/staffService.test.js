import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));
vi.mock('../../src/supabase/client/client', () => ({
  supabase: { rpc: rpcMock }
}));

import {
  fetchDemoAccountsPerRole,
  formatDemoOptionLabel,
  DEFAULT_FALLBACK_DEMO_ACCOUNTS
} from '../../src/services/dashboard/staffService';

describe('Supabase-backed demo account picker', () => {
  beforeEach(() => rpcMock.mockReset());

  it('ensures no hardcoded credentials exist in fallback constants', () => {
    expect(DEFAULT_FALLBACK_DEMO_ACCOUNTS).toEqual([]);
  });

  it('formats demo option label cleanly per requirement', () => {
    const adminLabel = formatDemoOptionLabel(
      { role: 'admin_hr', email: 'admin@mail.com' },
      0
    );
    expect(adminLabel).toBe('1. Admin (admin@mail.com)');

    const staffLabel = formatDemoOptionLabel(
      { role: 'caregiver', email: 'staff@mail.com' },
      1
    );
    expect(staffLabel).toBe('2. Staff (staff@mail.com)');
  });

  it('maps real RPC rows and returns strictly 1 account per role with dynamic email and password', async () => {
    rpcMock.mockResolvedValue({
      data: [
        { profile_id: 'a1', full_name: 'Admin HR', role: 'admin_hr', email: 'admin@example.test', password: 'pass_admin' },
        { profile_id: 'c1', full_name: 'Caregiver Satu', role: 'caregiver', email: 'caregiver1@example.test', password: 'pass_caregiver' },
        { profile_id: 'c2', full_name: 'Caregiver Dua', role: 'caregiver', email: 'caregiver2@example.test', password: 'pass_caregiver2' },
        { profile_id: 's1', full_name: 'Supervisor', role: 'supervisor', email: 'supervisor@example.test', password: 'pass_supervisor' },
        { profile_id: 'f1', full_name: 'Keluarga', role: 'family', email: 'family@example.test', password: 'pass_family' }
      ],
      error: null
    });

    const result = await fetchDemoAccountsPerRole();

    expect(rpcMock).toHaveBeenCalledWith('list_demo_login_accounts');
    expect(result.map((account) => account.role)).toEqual(['admin_hr', 'caregiver', 'supervisor', 'family']);
    expect(result[0].email).toBe('admin@example.test');
    expect(result[0].password).toBe('pass_admin');
    expect(result[1].email).toBe('caregiver1@example.test');
    expect(result[1].password).toBe('pass_caregiver');
  });

  it('propagates database errors so the login UI can show a truthful fallback state', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('RPC unavailable') });
    await expect(fetchDemoAccountsPerRole()).rejects.toThrow('RPC unavailable');
  });
});

