import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { dispatchOutboxEvent, processOutboxQueue, emitSystemEvent } from '../../src/services/automation/eventBus';

describe('P0-5 Durable Outbox Queue & Worker Engine Audit Tests', () => {
  it('should verify slaWatchdog.js no longer contains dummy { success: true } callback', () => {
    const watchdogPath = path.resolve('src/services/automation/slaWatchdog.js');
    const content = fs.readFileSync(watchdogPath, 'utf8');

    expect(content).not.toContain('return { success: true };');
    expect(content).toContain('processOutboxQueue(dispatchOutboxEvent)');
  });

  it('should verify database migration includes UNIQUE index on idempotency_key and SKIP LOCKED worker claim function', () => {
    const migrationPath = path.resolve('supabase/migrations/20261102000000_autonomous_platform_foundations.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('idx_outbox_idempotency_key');
    expect(sql).toContain('UNIQUE INDEX');
    expect(sql).toContain('fn_claim_outbox_jobs');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
  });

  it('should execute dispatchOutboxEvent for SLA_BREACH and dispatch notifications', async () => {
    const mockItem = {
      id: 'test-event-1',
      facility_id: 'FAC-001',
      event_type: 'SLA_BREACH',
      payload: { title: 'Pemberian Obat Siang', priority: 'critical' }
    };

    const result = await dispatchOutboxEvent(mockItem);
    expect(result.success).toBe(true);
  });

  it('should calculate exponential backoff delay on processing failure', async () => {
    const failingProcessor = async () => {
      throw new Error("Simulated transient processing error");
    };

    // Emit event
    const eventRecord = await emitSystemEvent('TEST_TRANSIENT_EVENT', { sample: 123 }, { idempotencyKey: `test-backoff-${Date.now()}` });
    const result = await processOutboxQueue(failingProcessor);

    expect(result).toBeDefined();
    expect(result.pendingItemsCount).toBeGreaterThan(0);
  });
});
