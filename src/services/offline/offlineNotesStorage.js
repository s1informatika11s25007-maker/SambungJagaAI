/**
 * SambungJaga AI — Persistent Offline-First Notes Storage
 *
 * Stores caregiver notes and reports into IndexedDB first.
 * Survives page reloads and performs complete database synchronization when online.
 */

import { saveToIndexedDb, getAllFromIndexedDb, deleteFromIndexedDb } from './indexedDbStorage';
import { supabase } from '../../supabase/client/client';

const STORAGE_KEY = 'sambungjaga_offline_notes';

export async function getOfflineNotes() {
  const idbItems = await getAllFromIndexedDb('offline_reports');
  if (idbItems && idbItems.length > 0) return idbItems;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

export async function saveOfflineNote(note = {}) {
  const item = {
    id: note.id || `note-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    residentId: note.residentId || null,
    noteText: note.noteText || '',
    createdAt: note.createdAt || new Date().toISOString(),
    status: 'pending_sync'
  };

  await saveToIndexedDb('offline_reports', item);

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push(item);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (_) {}

  return item;
}

export async function syncOfflineNotes() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedCount: 0 };
  }

  const queue = await getOfflineNotes();
  if (queue.length === 0) return { syncedCount: 0 };

  let syncedCount = 0;
  const remaining = [];

  for (const note of queue) {
    try {
      const { error } = await supabase.from('epistemic_facts').insert({
        facility_id: localStorage.getItem('userFacilityId') || 'FAC-001',
        resident_id: note.residentId,
        fact_key: 'caregiver_report_note',
        fact_value: { text: note.noteText, offlineCreatedAt: note.createdAt },
        status: 'reported',
        source_type: 'offline_text_note'
      });

      if (!error) {
        await deleteFromIndexedDb('offline_reports', note.id);
        syncedCount += 1;
      } else {
        remaining.push(note);
      }
    } catch (_) {
      remaining.push(note);
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  } catch (_) {}

  return { syncedCount, remainingCount: remaining.length };
}
