/**
 * SambungJaga AI — Dedicated Node.js Backend Supabase Client
 *
 * Safe for server-side execution in Node.js / Deno background processes (24/7 Scheduler & Worker).
 * Strict Rule: Requires SUPABASE_SERVICE_ROLE_KEY for privileged server operations.
 * Fail-Closed: Throws fatal Error on startup if service role key or Supabase URL is missing or placeholder in Node.js server environment.
 */

import { createClient } from '@supabase/supabase-js';

const getEnvVar = (key) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
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

const rawUrl = getEnvVar('SUPABASE_PROJECT_URL') || getEnvVar('SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL');
const serviceRoleKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

const isNodeServer = typeof window === 'undefined' && typeof process !== 'undefined' && process.release?.name === 'node';

// Fail-Closed Guard on Server Runtime Startup
if (isNodeServer && (!serviceRoleKey || isPlaceholder(serviceRoleKey) || !rawUrl || isPlaceholder(rawUrl))) {
  throw new Error(
    `❌ [FATAL FAIL-CLOSED]: SUPABASE_SERVICE_ROLE_KEY atau SUPABASE_URL belum dikonfigurasi pada server environment. Eksekusi server dihentikan demi keamanan data.`
  );
}

const supabaseUrl = rawUrl && !isPlaceholder(rawUrl) ? rawUrl : 'http://127.0.0.1:54321';
const supabaseKey = serviceRoleKey && !isPlaceholder(serviceRoleKey) ? serviceRoleKey : 'unconfigured-service-key';

export const backendSupabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

export const isBackendClientConfigured = () => {
  return Boolean(serviceRoleKey && !isPlaceholder(serviceRoleKey));
};
