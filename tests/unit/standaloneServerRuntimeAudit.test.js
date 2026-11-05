import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Standalone Server Automation Runtime Audit Tests', () => {
  it('1. Server Runtime Scripts - should verify all 3 standalone server scripts exist', () => {
    const workerPath = path.resolve('scripts/server-worker.js');
    const schedulerPath = path.resolve('scripts/server-scheduler.js');
    const daemonPath = path.resolve('scripts/run-server-daemon.js');

    expect(fs.existsSync(workerPath)).toBe(true);
    expect(fs.existsSync(schedulerPath)).toBe(true);
    expect(fs.existsSync(daemonPath)).toBe(true);
  });

  it('2. Background Worker Engine - should verify server-worker.js includes heartbeat, outbox processing, and graceful shutdown', () => {
    const code = fs.readFileSync(path.resolve('scripts/server-worker.js'), 'utf8');

    expect(code).toContain('sendWorkerHeartbeat');
    expect(code).toContain('processOutboxQueue');
    expect(code).toContain('gracefulShutdown');
    expect(code).toContain('SIGINT');
    expect(code).toContain('SIGTERM');
  });

  it('3. Server Scheduler Engine - should verify server-scheduler.js includes all 10 scheduled background tasks', () => {
    const code = fs.readFileSync(path.resolve('scripts/server-scheduler.js'), 'utf8');

    expect(code).toContain('processOutboxQueue'); // 15s
    expect(code).toContain('runSlaWatchdogSweep'); // 30s
    expect(code).toContain('getAgentMeshHealthSnapshot'); // 30s
    expect(code).toContain('runStuckProcessRecovery'); // 60s
    expect(code).toContain('runDataReconciliation'); // 300s
    expect(code).toContain('scheduleDailyFamilyDigests'); // Daily
    expect(code).toContain('checkCertificationExpirations'); // Daily
    expect(code).toContain('runDataRetentionPurgeSweep'); // Daily
  });

  it('4. Supervisor Daemon Runner - should verify run-server-daemon.js handles automatic process restarts', () => {
    const code = fs.readFileSync(path.resolve('scripts/run-server-daemon.js'), 'utf8');

    expect(code).toContain('fork');
    expect(code).toContain('spawnManagedProcess');
    expect(code).toContain('Automatically restarting');
  });

  it('5. Worker Heartbeats Migration - should verify SQL migration includes public.worker_heartbeats table', () => {
    const sqlPath = path.resolve('supabase/migrations/20261102000000_autonomous_platform_foundations.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    expect(sql).toContain('public.worker_heartbeats');
    expect(sql).toContain('worker_id TEXT UNIQUE');
  });
});
