import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TtlLruCache } from '../../src/utils/common/cacheManager';
import { saveToIndexedDb, getAllFromIndexedDb } from '../../src/services/offline/indexedDbStorage';
import { saveVoiceRecordToOfflineOutbox } from '../../src/services/offline/offlineVoiceOutbox';
import { saveOfflineNote } from '../../src/services/offline/offlineNotesStorage';
import { updateObligationStatus } from '../../src/services/data/dataService';

describe('P0 Final Audits & System Consistency Tests (Items 71 - 88)', () => {
  it('71 & 72. Personal Notifications & Targeting - should verify SQL migration includes personal user recipient_user_id', () => {
    const sqlPath = path.resolve('supabase/migrations/20261102000000_autonomous_platform_foundations.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    expect(sql).toContain('recipient_user_id UUID');
    expect(sql).toContain('delivered_at TIMESTAMPTZ');
    expect(sql).toContain('read_at TIMESTAMPTZ');
  });

  it('78. Simulator Roster Truncation Removal - should verify testRoster uses activeStaff without .slice(0, 24)', () => {
    const simPath = path.resolve('src/services/simulator/failureSetSimulator.js');
    const code = fs.readFileSync(simPath, 'utf8');

    expect(code).not.toContain('activeStaff.slice(0, 24)');
    expect(code).toContain('const testRoster = activeStaff;');
  });

  it('79. LRU + TTL Cache Manager - should evict oldest entry and enforce TTL expiration', async () => {
    const cache = new TtlLruCache(2, 50); // max 2 items, 50ms TTL

    cache.set('key1', 'val1');
    cache.set('key2', 'val2');
    expect(cache.get('key1')).toBe('val1');

    cache.set('key3', 'val3'); // Should evict key2 (since key1 was accessed)
    expect(cache.get('key2')).toBeNull();
    expect(cache.get('key3')).toBe('val3');

    // Test TTL expiration
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(cache.get('key1')).toBeNull();
  });

  it('81. Safe Conditional Updates for Escalation - should use optimistic status condition', () => {
    const dataServicePath = path.resolve('src/services/data/dataService.js');
    const code = fs.readFileSync(dataServicePath, 'utf8');

    expect(code).toContain('.in(\'status\', [\'open\', \'in_progress\', \'escalated\'])');
  });

  it('85, 86, 87. Offline storage rejects unscoped data instead of falling back to plaintext', async () => {
    await expect(saveVoiceRecordToOfflineOutbox({ transcript: 'IndexedDB Voice Test' }))
      .rejects.toThrow(/facility_id dan resident_id/i);
    await expect(saveOfflineNote({ noteText: 'IndexedDB Note Test' }))
      .rejects.toThrow(/facility_id dan resident_id/i);
  });
});
