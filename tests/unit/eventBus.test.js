import { describe, it, expect, vi } from 'vitest';
import { emitSystemEvent, subscribeSystemEvent, processOutboxQueue } from '../../src/services/automation/eventBus';

describe('Event Bus & Transactional Outbox Unit Tests', () => {
  it('should emit system events and trigger subscribers', async () => {
    const handler = vi.fn();
    subscribeSystemEvent('FACT_CREATED', handler);

    const event = await emitSystemEvent('FACT_CREATED', { fact_id: 'f-101' });
    expect(event.event_type).toBe('FACT_CREATED');
    expect(handler).toHaveBeenCalled();
  });

  it('should process outbox queue and handle completed status', async () => {
    const mockProcessor = vi.fn().mockResolvedValue({ success: true });
    const result = await processOutboxQueue(mockProcessor);

    expect(result).toHaveProperty('processedCount');
  });
});
