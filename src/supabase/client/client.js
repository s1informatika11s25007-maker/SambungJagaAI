import { createClient } from '@supabase/supabase-js';

const getEnvVar = (key) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return null;
};

const isPlaceholder = (val) => {
  if (!val || typeof val !== 'string') return true;
  const clean = val.trim();
  return (
    clean.includes('<your-') ||
    clean.endsWith('...') ||
    clean.includes('placeholder')
  );
};

export const isSupabaseConfigured = () => {
  const url = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL');
  const key = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY');
  return Boolean(url && key && !isPlaceholder(url) && !isPlaceholder(key));
};

const rawUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL');
const rawKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY');

if (!isSupabaseConfigured()) {
  console.warn(
    '⚠️ [Supabase Client Warning] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tidak dikonfigurasi. Harap isi variabel lingkungan di file .env.'
  );
}

const SUPABASE_URL = rawUrl && !isPlaceholder(rawUrl) ? rawUrl : 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = rawKey && !isPlaceholder(rawKey) ? rawKey : 'unconfigured-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: typeof window !== 'undefined',
    autoRefreshToken: typeof window !== 'undefined'
  },
  realtime: { params: { eventsPerSecond: 10 } }
});

// Polyfill .catch and .finally on query builder thenables
try {
  const probe = supabase.from('__probe__').select();
  let proto = probe;
  while (proto && !Object.prototype.hasOwnProperty.call(proto, 'then')) proto = Object.getPrototypeOf(proto);
  if (proto) {
    if (typeof proto.catch !== 'function') {
      proto.catch = function (onRejected) { return this.then(undefined, onRejected); };
    }
    if (typeof proto.finally !== 'function') {
      proto.finally = function (cb) { return this.then((v) => { cb && cb(); return v; }, (e) => { cb && cb(); throw e; }); };
    }
  }
} catch (e) { /* non-fatal */ }
