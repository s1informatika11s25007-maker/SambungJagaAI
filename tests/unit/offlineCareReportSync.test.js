import { describe, it, expect, vi } from 'vitest';
import { uploadOfflineCareReport } from '../../src/services/offline/offlineCareReportSync';

describe('Tenant-scoped offline report sync adapter', () => {
  it('sends report through the authenticated RPC and returns server acknowledgement', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { success: true, acknowledged: true }, error: null });
    const client = { rpc };
    const item = {
      id: 'bde8bb70-6e88-4ef0-9d89-6e5e28fbe8f0',
      facility_id: 'facility-demo',
      resident_id: 'cb0b46ee-2b0e-4be0-8dcf-7d4b5cf8db9a',
      text: 'Penghuni sudah sarapan.',
      client_created_at: '2026-11-07T04:00:00.000Z'
    };

    const result = await uploadOfflineCareReport(item, client);
    expect(result.success).toBe(true);
    expect(result.acknowledged).toBe(true);
    expect(rpc).toHaveBeenCalledWith('sync_offline_care_report', expect.objectContaining({
      p_client_submission_id: item.id,
      p_resident_id: item.resident_id,
      p_fact_value: expect.objectContaining({ text: item.text })
    }));
  });

  it('rejects missing tenant or resident identifiers before calling the network', async () => {
    const rpc = vi.fn();
    const result = await uploadOfflineCareReport({ id: 'x', text: 'Catatan' }, { rpc });
    expect(result.success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
