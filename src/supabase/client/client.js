import { createClient } from '@supabase/supabase-js';

// Credentials come from local environment variables. Placeholders allow the UI to
// render a clear configuration error without embedding any project secrets.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'public-anon-key-not-configured';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 10 } },
});

// supabase-js query builders are thenables without .catch/.finally. The code base
// chains `.catch(() => {})` on them, which throws a TypeError. Add them once, globally.
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

export const isSupabaseConfigured = () => {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
};
