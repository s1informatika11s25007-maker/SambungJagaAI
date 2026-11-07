/**
 * SambungJaga AI — IndexedDB Offline Storage & Encryption Engine
 *
 * Full 12-Feature Offline-First Engine & Strict Synchronization Pipeline:
 *
 * Order of Synchronization:
 * Local Record -> Encrypted Outbox -> Server Upload -> Server Validation -> Database Commit -> Server Acknowledgement -> Local Queue Removal
 *
 * CRITICAL RULE: Local queue items are deleted ONLY AFTER the server explicitly confirms
 * database commit acknowledgement ({ success: true, acknowledged: true }).
 */

const DB_NAME = 'sambungjaga_offline_db';
const DB_VERSION = 3;

export const OFFLINE_SYNC_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  FAILED: 'failed'
};

const RETENTION_TTL_DAYS = 7;
let deviceKeyPromise = null;

/**
 * Generates or retrieves a non-exportable AES-GCM key persisted in IndexedDB for this browser profile.
 */
async function getOrCreateDeviceEncryptionKey() {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto tidak tersedia; penyimpanan offline sensitif dinonaktifkan.');
  }
  if (deviceKeyPromise) return deviceKeyPromise;
  deviceKeyPromise = (async () => {
  const db = await openOfflineDb();
  try {
    const existing = await new Promise((resolve, reject) => {
      const request = db.transaction('device_keys', 'readonly').objectStore('device_keys').get('aes-gcm-v1');
      request.onsuccess = () => resolve(request.result?.key || null);
      request.onerror = () => reject(request.error);
    });
    if (existing) return existing;

    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('device_keys', 'readwrite');
      transaction.objectStore('device_keys').put({ id: 'aes-gcm-v1', key, created_at: new Date().toISOString() });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Gagal menyimpan kunci perangkat.'));
    });
    return key;
  } finally {
    db.close();
  }
  })();
  try { return await deviceKeyPromise; }
  catch (error) { deviceKeyPromise = null; throw error; }
}

/**
 * 2. Encrypts payload at rest using WebCrypto AES-GCM 256-bit
 */
export async function encryptAtRest(plainPayload) {
  const jsonStr = JSON.stringify(plainPayload);
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const key = await getOrCreateDeviceEncryptionKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoder = new TextEncoder();
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(jsonStr)
      );

      const ivBase64 = btoa(String.fromCharCode(...iv));
      const cipherBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));

      return { __encrypted: true, iv: ivBase64, cipher: cipherBase64 };
    }
  } catch (error) {
    throw new Error(`Enkripsi offline gagal; data tidak disimpan: ${error?.message || 'WebCrypto tidak tersedia'}`);
  }

  throw new Error('WebCrypto AES-GCM tidak tersedia; penyimpanan offline sensitif dinonaktifkan.');
}

/**
 * Decrypts payload at rest
 */
export async function decryptAtRest(encryptedObj) {
  if (!encryptedObj || encryptedObj.__encrypted !== true) {
    // Never surface legacy plaintext records from IndexedDB.
    return null;
  }

  try {
    const key = await getOrCreateDeviceEncryptionKey();
    const iv = Uint8Array.from(atob(encryptedObj.iv), c => c.charCodeAt(0));
    const cipher = Uint8Array.from(atob(encryptedObj.cipher), c => c.charCodeAt(0));
    const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return JSON.parse(new TextDecoder().decode(decryptedBuffer));
  } catch (_) {
    return null;
  }
}

/**
 * Opens IndexedDB database connection
 */
function openOfflineDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB tidak didukung oleh browser.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('offline_reports')) {
        db.createObjectStore('offline_reports', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('offline_voice')) {
        db.createObjectStore('offline_voice', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('offline_outbox')) {
        db.createObjectStore('offline_outbox', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('device_keys')) {
        db.createObjectStore('device_keys', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 1, 3, 4 & 9. Saves item to IndexedDB with stable client UUID & encrypted outbox
 */
export async function saveToIndexedDb(storeName, item) {
  const allowedStores = new Set(['offline_reports', 'offline_voice', 'offline_outbox']);
  if (!allowedStores.has(storeName)) throw new Error('Jenis antrean offline tidak dikenal.');
  if (!item || typeof item !== 'object') throw new Error('Payload offline tidak valid.');
  if (!item.facility_id || typeof item.facility_id !== 'string') {
    throw new Error('facility_id wajib berasal dari profil fasilitas yang terverifikasi.');
  }
  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new Error('IndexedDB tidak tersedia; data sensitif tidak disimpan di memori atau localStorage.');
  }
  if (typeof crypto === 'undefined' || !crypto.randomUUID) {
    throw new Error('Secure UUID tidak tersedia; browser tidak memenuhi persyaratan penyimpanan offline.');
  }

  const itemId = item.id || crypto.randomUUID();
  const idempotencyKey = item.idempotency_key || `idempotency-${item.facility_id}-${itemId}`;
  const enrichedItem = {
    ...item,
    id: itemId,
    idempotency_key: idempotencyKey,
    sync_status: item.sync_status || OFFLINE_SYNC_STATUS.PENDING,
    retry_count: item.retry_count || 0,
    client_created_at: item.client_created_at || new Date().toISOString()
  };

  const encryptedWrapper = await encryptAtRest(enrichedItem);
  const recordToStore = {
    id: itemId,
    sync_status: enrichedItem.sync_status,
    idempotency_key: idempotencyKey,
    facility_id: item.facility_id,
    payload: encryptedWrapper,
    created_at: enrichedItem.client_created_at
  };

  const db = await openOfflineDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(recordToStore);
      tx.oncomplete = () => resolve(enrichedItem);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaksi penyimpanan offline dibatalkan.'));
    });
  } finally {
    db.close();
  }
}

/**
 * Reads and decrypts all records from IndexedDB. Legacy plaintext records are skipped.
 */
export async function getAllFromIndexedDb(storeName) {
  const db = await openOfflineDb();
  try {
    const rawRecords = await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    const decryptedItems = [];
    for (const record of rawRecords) {
      if (!record.payload || record.payload.__encrypted !== true) continue;
      const decrypted = await decryptAtRest(record.payload);
      if (decrypted) {
        decryptedItems.push({
          ...decrypted,
          sync_status: record.sync_status,
          idempotency_key: record.idempotency_key
        });
      }
    }
    return decryptedItems;
  } finally {
    db.close();
  }
}

/**
 * Deletes item from IndexedDB ONLY after server acknowledgement
 */
export async function deleteFromIndexedDb(storeName, id) {
  const db = await openOfflineDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaksi penghapusan offline dibatalkan.'));
    });
  } finally {
    db.close();
  }
}

/**
 * 5, 6, 7 & 8. Strict Order of Synchronization Pipeline:
 * Local Record -> Encrypted Outbox -> Server Upload -> Server Validation -> Database Commit -> Server Acknowledgement -> Local Queue Removal
 */
export async function processOfflineQueueSync(storeName = 'offline_outbox', syncUploadFn = null) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedCount: 0, reason: 'Device is offline' };
  }

  const items = await getAllFromIndexedDb(storeName);
  const pendingItems = items.filter(i => i.sync_status === OFFLINE_SYNC_STATUS.PENDING || i.sync_status === OFFLINE_SYNC_STATUS.FAILED);

  if (pendingItems.length === 0) return { syncedCount: 0 };

  let syncedCount = 0;
  let failedCount = 0;

  for (const item of pendingItems) {
    try {
      // 1. Update status to SYNCING
      await saveToIndexedDb(storeName, { ...item, sync_status: OFFLINE_SYNC_STATUS.SYNCING });

      // 2. Server Upload & Database Commit
      let serverAck = null;

      if (typeof syncUploadFn !== 'function') {
        throw new Error('Adapter sinkronisasi server wajib disediakan; antrean tidak dikirim melalui insert generik.');
      }
      serverAck = await syncUploadFn(item);

      // 6 & 7. Server Acknowledgement Check (CRITICAL: Delete ONLY IF acknowledged!)
      if (serverAck && serverAck.success === true && serverAck.acknowledged === true) {
        await deleteFromIndexedDb(storeName, item.id);
        syncedCount++;
      } else {
        await saveToIndexedDb(storeName, {
          ...item,
          sync_status: OFFLINE_SYNC_STATUS.FAILED,
          retry_count: (item.retry_count || 0) + 1,
          last_error: serverAck?.error || 'Server did not acknowledge database commit'
        });
        failedCount++;
      }
    } catch (err) {
      await saveToIndexedDb(storeName, {
        ...item,
        sync_status: OFFLINE_SYNC_STATUS.FAILED,
        retry_count: (item.retry_count || 0) + 1,
        last_error: err.message
      });
      failedCount++;
    }
  }

  return { syncedCount, failedCount, remainingPending: pendingItems.length - syncedCount };
}

/**
 * 11. Purges expired local offline data older than RETENTION_TTL_DAYS (7 days)
 */
export async function purgeExpiredOfflineData() {
  const cutoffMs = Date.now() - (RETENTION_TTL_DAYS * 86400 * 1000);

  for (const storeName of ['offline_reports', 'offline_voice', 'offline_outbox']) {
    try {
      const items = await getAllFromIndexedDb(storeName);
      for (const item of items) {
        const itemCreatedMs = new Date(item.client_created_at || item.recordedAt || 0).getTime();
        if (itemCreatedMs < cutoffMs && item.sync_status === OFFLINE_SYNC_STATUS.SYNCED) {
          await deleteFromIndexedDb(storeName, item.id);
        }
      }
    } catch (_) {}
  }
}

/**
 * 12. Purges local offline storage data upon user session termination / logout
 */
export async function purgeLocalOfflineDataOnLogout() {
  try {
    const db = await openOfflineDb();
    const tx = db.transaction(['offline_reports', 'offline_voice', 'offline_outbox'], 'readwrite');
    tx.objectStore('offline_reports').clear();
    tx.objectStore('offline_voice').clear();
    tx.objectStore('offline_outbox').clear();
  } catch (_) {}
}

// Background syncing is intentionally not performed from this generic storage module.
// The authenticated application hook must provide a tenant-scoped RPC adapter.
