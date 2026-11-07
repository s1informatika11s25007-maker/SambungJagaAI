/**
 * Encrypted offline voice transcript queue.
 * Audio blobs are kept encrypted locally; synchronization currently sends only
 * the human-reviewed transcript through the tenant-scoped care-report RPC.
 */
import { saveToIndexedDb, getAllFromIndexedDb, processOfflineQueueSync } from './indexedDbStorage';
import { supabase } from '../../supabase/client/client';
import { uploadOfflineCareReport } from './offlineCareReportSync';

export async function getOfflineVoiceOutbox() {
  return getAllFromIndexedDb('offline_voice');
}

export async function saveVoiceRecordToOfflineOutbox(record = {}) {
  if (!record.facility_id || !record.resident_id) {
    throw new Error('facility_id dan resident_id terverifikasi wajib untuk antrean suara offline.');
  }
  const id = record.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null);
  if (!id) throw new Error('Secure UUID tidak tersedia pada browser ini.');
  const item = {
    ...record,
    id,
    facility_id: record.facility_id,
    resident_id: record.resident_id,
    transcript: String(record.transcript || '').slice(0, 4000),
    recordedAt: record.recordedAt || new Date().toISOString(),
    source_type: 'voice_transcript'
  };
  return saveToIndexedDb('offline_voice', item);
}

export async function syncOfflineVoiceOutbox(onSyncSuccess = null) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedCount: 0, error: 'Browser masih offline.' };
  }
  const result = await processOfflineQueueSync('offline_voice', (item) => uploadOfflineCareReport(item, supabase));
  if (onSyncSuccess && result.syncedCount > 0) onSyncSuccess({ syncedCount: result.syncedCount });
  return result;
}
