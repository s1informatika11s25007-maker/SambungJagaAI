/**
 * SambungJaga AI — Database connectivity and migration inventory check.
 * IMPORTANT: This is NOT a backup, PITR, or restore test.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  }
}

const migrationsDir = path.resolve('supabase/migrations');
if (!fs.existsSync(migrationsDir)) {
  console.error('Migration directory missing: supabase/migrations');
  process.exit(1);
}

const migrationFiles = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
if (migrationFiles.length === 0) {
  console.error('No SQL migrations found.');
  process.exit(1);
}

console.log('SAMBUNGJAGA AI — DATABASE CONNECTIVITY / MIGRATION INVENTORY CHECK');
console.log(`Found ${migrationFiles.length} SQL migration files.`);

for (const file of migrationFiles) {
  const content = fs.readFileSync(path.join(migrationsDir, file));
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  console.log(`- ${file}: sha256:${hash}`);
}

const requiredEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const missing = requiredEnv.filter((name) => !process.env[name]);
if (missing.length) {
  console.warn(`\nConnectivity check skipped. Missing environment values: ${missing.join(', ')}`);
  console.warn('Set the variables and rerun this script to query the configured Supabase project.');
  console.warn('This script does not test backups, PITR, or restoration.');
  process.exitCode = 2;
} else {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error } = await client.from('staff_profiles').select('id', { head: true, count: 'exact' });
  if (error) {
    console.error(`Supabase connectivity/query check failed: ${error.message}`);
    process.exitCode = 1;
  } else {
    console.log('\nSupabase connection and public staff_profiles query succeeded.');
    console.log('This is not evidence that backups or restore procedures work.');
  }
}
