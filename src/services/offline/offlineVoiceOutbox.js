/**
 * SambungJaga AI — Persistent Offline-First Voice Outbox
 *
 * Saves recorded voice audio blobs & transcripts into IndexedDB first before any network request.
 * Survives browser page reloads and performs complete database entity synchronization when reconnected.
 */

import { saveToIndexedDb, getAllFromIndexedDb, deleteFromIndexedDb } from './indexedDbStorage';
import { supabase } from '../../supabase/client/client';
import { emitSystemEvent } from '../automation/eventBus';

const STORAGE_KEY = 'sambungjaga_offline_voice_outbox';

export async function getOfflineVoiceOutbox() {
  const idbItems = await getAllFromIndexedDb('offline_voice');
  if (idbItems && idbItems.length > 0) return idbItems;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

export async function saveVoiceRecordToOfflineOutbox(record = {}) {
  const item = {
    id: record.id || `voice-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    audioBase64: record.audioBase64 || null,
    transcript: record.transcript || '',
    recordedAt: record.recordedAt || new Date().toISOString(),
    status: 'pending_sync'
  };

  // 1. Write to IndexedDB first
  await saveToIndexedDb('offline_voice', item);

  // 2. Write to localStorage backup
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push(item);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (_) {}

  return item;
}

export async function syncOfflineVoiceOutbox(onSyncSuccess = null) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedCount: 0, error: 'Browser offline' };
  }

  const queue = await getOfflineVoiceOutbox();
  if (queue.length === 0) return { syncedCount: 0 };

  let syncedCount = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      // 1. Emit System Event
      await emitSystemEvent('VOICE_REPORT_SUBMITTED', {
        audioBase64: item.audioBase64,
        transcript: item.transcript,
        recordedAt: item.recordedAt
      });

      // 2. Persist Epistemic Fact into Database
      if (item.transcript) {
        await supabase.from('epistemic_facts').insert({
          facility_id: localStorage.getItem('userFacilityId') || 'FAC-001',
          fact_key: 'voice_report_transcript',
          fact_value: { transcript: item.transcript, recordedAt: item.recordedAt },
          source_type: 'offline_voice_sync'
        }).catch(() => {});
      }

      await deleteFromIndexedDb('offline_voice', item.id);
      syncedCount += 1;
      if (onSyncSuccess) onSyncSuccess(item);
    } catch (err) {
      remaining.push(item);
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  } catch (_) {}

  return { syncedCount, remainingCount: remaining.length };
}
