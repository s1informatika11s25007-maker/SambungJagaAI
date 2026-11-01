import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));
vi.mock('../../src/supabase/client/client', () => ({
  supabase: { rpc: rpcMock }
}));

import { fetchDemoAccountsPerRole } from '../../src/services/dashboard/staffService';

describe('Supabase-backed demo account picker', () => {
  beforeEach(() => rpcMock.mockReset());

  it('maps real RPC rows and returns no more than one account per role', async () => {
    rpcMock.mockResolvedValue({
      data: [
        { profile_id: 'c1', full_name: 'Caregiver Satu', role: 'caregiver', email: 'caregiver1@example.test' },
        { profile_id: 'c2', full_name: 'Caregiver Dua', role: 'caregiver', email: 'caregiver2@example.test' },
        { profile_id: 's1', full_name: 'Supervisor', role: 'supervisor', email: 'supervisor@example.test' },
        { profile_id: 'f1', full_name: 'Keluarga', role: 'family', email: 'family@example.test' },
        { profile_id: 'a1', full_name: 'Admin', role: 'admin_hr', email: 'admin@example.test' }
      ],
      error: null
    });

    const result = await fetchDemoAccountsPerRole();

    expect(rpcMock).toHaveBeenCalledWith('list_demo_login_accounts');
    expect(result.map((account) => account.role)).toEqual(['caregiver', 'supervisor', 'family', 'admin_hr']);
    expect(result[0].email).toBe('caregiver1@example.test');
    expect(result[0].key).toContain('demo_caregiver_');
  });

  it('propagates database errors so the login UI can show a truthful fallback state', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('RPC unavailable') });
    await expect(fetchDemoAccountsPerRole()).rejects.toThrow('RPC unavailable');
  });
});
