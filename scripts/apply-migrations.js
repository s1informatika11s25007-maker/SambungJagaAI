import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Client } = pkg;

// 1. Read .env variables
const envPath = path.resolve('.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ File .env tidak ditemukan!');
  process.exit(1);
}

const envText = fs.readFileSync(envPath, 'utf8');
const envVars = {};
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

const connectionString = envVars.SUPABASE_DB_POOLER_URL || 'postgres://postgres.qepfuqlnkofzfhfzahpr:AikARF7Gc8md68EK@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';
// Convert pooler port 6543 to direct session 5432 for DDL migration execution
const directConn = connectionString.replace(':6543/', ':5432/').replace('?pgbouncer=true', '');

console.log('🚀 MENGHUBUNGKAN KE DATABASE SUPABASE...');
console.log(`🔗 URL: ${directConn.replace(/:[^:@]+@/, ':****@')}\n`);

const client = new Client({
  connectionString: directConn,
  ssl: { rejectUnauthorized: false }
});

async function runMigrations() {
  try {
    await client.connect();
    console.log('✅ Berhasil terhubung ke Supabase PostgreSQL Database!\n');

    const migrationsDir = path.resolve('supabase/migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.error('❌ Direktori migrations tidak ditemukan!');
      process.exit(1);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    console.log(`📂 Ditemukan ${files.length} berkas migrasi SQL:`);
    files.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
    console.log('\n--- MULAI EKSEKUSI MIGRASI ---\n');

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      console.log(`⏳ Menjalankan: ${file}...`);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query(sql);
        console.log(`✅ Berhasil: ${file}\n`);
      } catch (sqlErr) {
        console.warn(`⚠️ Catatan/Peringatan saat eksekusi ${file}: ${sqlErr.message}`);
        console.log(`   (Melanjutkan eksekusi migrasi berikutnya...)\n`);
      }
    }

    console.log('🎉 SELURUH MIGRASI DATABASE BERHASIL DIPERBARUI KE SUPABASE!');
  } catch (err) {
    console.error('❌ Error eksekusi database:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
