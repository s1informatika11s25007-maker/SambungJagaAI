import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Client } = pkg;

// 1. Read .env variables
const envPath = path.resolve('.env');
const envVars = {};

if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
    if (match) {
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      envVars[match[1]] = val;
    }
  });
}

const connectionString = envVars.SUPABASE_DB_POOLER_URL || process.env.SUPABASE_DB_POOLER_URL || envVars.DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ ERROR KREDENSIAL DATABASE: Variabel SUPABASE_DB_POOLER_URL atau DATABASE_URL tidak ditemukan!');
  process.exit(1);
}

// Convert pooler port 6543 to direct session 5432 for DDL migration execution
const directConn = connectionString.replace(':6543/', ':5432/').replace('?pgbouncer=true', '');

console.log('🚀 MENGHUBUNGKAN KE DATABASE SUPABASE...');
console.log(`🔗 URL: ${directConn.replace(/:[^:@]+@/, ':****@')}\n`);

const sslRejectUnauthorized = (envVars.DB_SSL_REJECT_UNAUTHORIZED || process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false';
if (!sslRejectUnauthorized) {
  console.warn('WARNING: TLS certificate verification is disabled. Do not use this setting in shared or production environments.');
}

async function createDatabaseClient(sslReject = true) {
  return new Client({
    connectionString: directConn,
    ssl: { rejectUnauthorized: sslReject }
  });
}

async function runMigrations() {
  let client = await createDatabaseClient(sslRejectUnauthorized);

  try {
    await client.connect();
    console.log('✅ Berhasil terhubung ke Supabase PostgreSQL Database!\n');

    // 2. Acquire Distributed PostgreSQL Advisory Lock (Lock Key: 74639210)
    console.log('🔒 Mengunci Advisory Lock Database (pg_advisory_lock)...');
    await client.query('SELECT pg_advisory_lock(74639210);');

    // Create schema migration tracker table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public._schema_migrations (
        version TEXT PRIMARY KEY,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const { rows: executedRows } = await client.query('SELECT version FROM public._schema_migrations');
    const executedVersions = new Set(executedRows.map(r => r.version));

    const migrationsDir = path.resolve('supabase/migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.error('❌ Direktori migrations tidak ditemukan!');
      process.exit(1);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    console.log(`📂 Ditemukan ${files.length} berkas migrasi SQL (${executedVersions.size} telah dieksekusi sebelumnya):`);
    files.forEach((f, i) => {
      const isDone = executedVersions.has(f);
      console.log(`   ${i + 1}. ${f} ${isDone ? '[SUDAH DIEKSEKUSI - SKIPPED]' : '[AKAN DIEKSEKUSI]'}`);
    });
    console.log('\n--- MULAI EKSEKUSI MIGRASI ---\n');

    let hasFailed = false;

    for (const file of files) {
      if (executedVersions.has(file)) {
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      console.log(`⏳ Menjalankan migrasi: ${file}...`);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO public._schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✅ Berhasil dieksekusi & dicatat: ${file}\n`);
      } catch (sqlErr) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`❌ GAGAL: Eksekusi migrasi ${file} mengalami kesalahan!`);
        console.error(`   Detail Kesalahan: ${sqlErr.message}`);
        console.error('   Proses migrasi dihentikan. File migrasi ini di-rollback.\n');
        hasFailed = true;
        break;
      }
    }

    // Release PostgreSQL Advisory Lock
    await client.query('SELECT pg_advisory_unlock(74639210);').catch(() => {});

    if (hasFailed) {
      console.error('💥 PROSES MIGRASI DIBATALKAN KARENA KEGAGALAN TERDETEKSI.');
      process.exit(1);
    }

    console.log('🎉 SELURUH MIGRASI DATABASE BERHASIL DIPERBARUI DAN DICATAT DI SUPABASE!');
  } catch (err) {
    console.error('❌ Error koneksi/eksekusi database:', err.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

runMigrations();
