/**
 * SambungJaga AI — Native Chrome & Web Platform Service API
 * Implements 10 Native Chromium APIs for Zero-Dependency, Lightweight, Zero-Delay execution.
 */

// 1. Chrome Web Speech Synthesis API (TTS)
export function speakTextNative(text, lang = 'id-ID') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  try {
    window.speechSynthesis.cancel(); // Stop active speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.warn("Speech Synthesis Native Error:", err);
    return false;
  }
}

// 2. Chrome Native BarcodeDetector API (QR Code Scanner)
export async function scanBedQrCodeNative(imageSource) {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;
  try {
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const barcodes = await detector.detect(imageSource);
    if (barcodes && barcodes.length > 0) {
      return barcodes[0].rawValue;
    }
  } catch (err) {
    console.warn("Native BarcodeDetector Error:", err);
  }
  return null;
}

// 3. Chrome Web Crypto API (SHA-256 Hashing)
export async function calculateSha256WebCrypto(text) {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Hash SHA-256 memerlukan Web Crypto pada koneksi HTTPS atau localhost.');
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(String(text));
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// 4. Chrome Service Worker Notifications & Web Push API
export async function showSupervisorWebPushNotification(title, options = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission === 'granted') {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification(title, {
          body: options.body || 'Notifikasi SambungJaga AI Supervisor',
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          vibrate: [200, 100, 200],
          tag: options.tag || 'sambungjaga-alert',
          renotify: true,
          ...options
        });
      } else {
        new Notification(title, {
          body: options.body || 'Notifikasi SambungJaga AI Supervisor',
          icon: '/favicon.svg',
          ...options
        });
      }
      return true;
    }
  } catch (err) {
    console.warn("Web Push Notification Error:", err);
  }
  return false;
}

// 5. Chrome Background Sync & Periodic Sync API
export async function registerBackgroundSync(tag = 'sync-p5-ledger') {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('sync' in reg) {
      await reg.sync.register(tag);
      return true;
    }
  } catch (err) {
    console.warn("Background Sync Registration Error:", err);
  }
  return false;
}

// 6. Chrome IndexedDB API Storage Engine
const DB_NAME = 'SambungJagaOfflineDB';
const DB_VERSION = 2;

export function initIndexedDB() {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      const stores = [
        'bitemporal_obligations',
        'epistemic_facts',
        'residents',
        'staff_profiles',
        'handover_contracts',
        'audit_trail',
        'notifications'
      ];
      stores.forEach(s => {
        if (!db.objectStoreNames.contains(s)) {
          db.createObjectStore(s, { keyPath: 'id' });
        }
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveToIndexedDB(storeName, items, clearFirst = true) {
  try {
    const db = await initIndexedDB();
    if (!db) return false;

    if (!db.objectStoreNames.contains(storeName)) return false;

    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    if (clearFirst) {
      store.clear();
    }

    const list = Array.isArray(items) ? items : [items];
    list.forEach(item => {
      if (item && item.id) {
        store.put(item);
      }
    });

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn(`IndexedDB save error [${storeName}]:`, err);
    return false;
  }
}

export async function getAllFromIndexedDB(storeName) {
  try {
    const db = await initIndexedDB();
    if (!db) return [];

    if (!db.objectStoreNames.contains(storeName)) return [];

    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn(`IndexedDB get error [${storeName}]:`, err);
    return [];
  }
}

// 7. Chrome Web Locks API (Multi-Tab Browser Synchronization)
export async function acquireWebLock(lockName, callback) {
  if (typeof window !== 'undefined' && 'locks' in navigator) {
    return navigator.locks.request(lockName, callback);
  }
  return callback();
}

// 8. Chrome File System Access API (Zero-Buffer Care Evidence Pack Export)
export async function exportCareEvidencePackNative(jsonData, filename = 'care_evidence_pack.json') {
  const jsonString = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2);

  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'SambungJaga Care Evidence Pack JSON',
          accept: { 'application/json': ['.json'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(jsonString);
      await writable.close();
      return { success: true, nativePickerUsed: true };
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, aborted: true };
      console.warn("File System Access API error, fallback to blob download:", err);
    }
  }

  // Fallback blob download
  try {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true, nativePickerUsed: false };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
