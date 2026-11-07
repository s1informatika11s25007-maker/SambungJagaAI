/**
 * Encrypted offline notes queue.
 * Notes are synchronized only through the authenticated tenant-scoped RPC.
 */
import { saveToIndexedDb, getAllFromIndexedDb, processOfflineQueueSync } from './indexedDbStorage';
import { supabase } from '../../supabase/client/client';
import { uploadOfflineCareReport } from './offlineCareReportSync';

export async function getOfflineNotes() {
  return getAllFromIndexedDb('offline_reports');
}

export async function saveOfflineNote(note = {}) {
  if (!note.facility_id || !note.resident_id) {
    throw new Error('facility_id dan resident_id terverifikasi wajib untuk catatan offline.');
  }
  if (!String(note.noteText || '').trim()) throw new Error('Isi catatan offline tidak boleh kosong.');
  const id = note.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null);
  if (!id) throw new Error('Secure UUID tidak tersedia pada browser ini.');
  const createdAt = note.createdAt || new Date().toISOString();
  return saveToIndexedDb('offline_reports', {
    id,
    facility_id: note.facility_id,
    resident_id: note.resident_id,
    noteText: String(note.noteText).trim().slice(0, 4000),
    text: String(note.noteText).trim().slice(0, 4000),
    source_type: 'offline_text_note',
    client_created_at: createdAt
  });
}

export async function syncOfflineNotes() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedCount: 0, error: 'Browser masih offline.' };
  }
  return processOfflineQueueSync('offline_reports', (item) => uploadOfflineCareReport(item, supabase));
}
