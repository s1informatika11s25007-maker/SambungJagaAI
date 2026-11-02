import { describe, it, expect, vi } from 'vitest';
import { runSlaWatchdogSweep } from '../../src/services/automation/slaWatchdog';

describe('Autonomous SLA Watchdog Unit Tests', () => {
  const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
  const futureDate = new Date(Date.now() + 3600 * 1000).toISOString();

  const mockObligations = [
    { id: 'ob-overdue', title: 'Cek Tensi Overdue', priority: 'critical', valid_until: pastDate, status: 'open' },
    { id: 'ob-unassigned', title: 'Cek Gula Darah Unassigned', priority: 'critical', valid_until: futureDate, status: 'open', assigned_caregiver_id: null },
    { id: 'ob-normal', title: 'Makan Siang Normal', priority: 'routine', valid_until: futureDate, status: 'open', assigned_caregiver_id: 'cg-1' }
  ];

  it('should detect overdue SLA and critical unassigned obligations in sweep', async () => {
    const onEscalate = vi.fn();
    const onNotify = vi.fn();

    const result = await runSlaWatchdogSweep({
      obligations: mockObligations,
      staff: [],
      residents: [],
      onEscalate,
      onNotify,
      actorName: 'Test Watchdog'
    });

    expect(result.success).toBe(true);
    expect(result.summary.breachedCount).toBeGreaterThan(0);
    expect(result.summary.criticalUnassignedCount).toBeGreaterThan(0);
    expect(onEscalate).toHaveBeenCalledWith('ob-overdue');
    expect(onNotify).toHaveBeenCalled();
  });
});
