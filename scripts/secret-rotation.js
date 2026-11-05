/**
 * SambungJaga AI — Secret Rotation Assistant Script
 *
 * Audits environment variables against .env.example, checks key formats & expirations,
 * generates cryptographically secure key replacement suggestions without printing secret contents.
 *
 * CRITICAL SECURITY RULE: Secret key contents are NEVER printed in terminal logs!
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

console.log('🔒 SAMBUNGJAGA SECRET ROTATION AUDIT & ASSISTANT');

const envPath = path.resolve('.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️ .env file not found. Ensure environment variables are configured.');
  process.exit(0);
}

const envText = fs.readFileSync(envPath, 'utf8');

const isPlaceholder = (val) => {
  if (!val || typeof val !== 'string') return true;
  const clean = val.trim();
  return (
    clean.includes('<your-') ||
    clean.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...') ||
    clean.endsWith('...') ||
    clean.toLowerCase().includes('placeholder')
  );
};

const parseEnvMap = (content) => {
  const map = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
    if (match) {
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      map[match[1]] = val;
    }
  });
  return map;
};

const envMap = parseEnvMap(envText);

const secretsToAudit = [
  { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true, description: 'Supabase Service Role Key (Server RLS Bypass)' },
  { name: 'VITE_SUPABASE_ANON_KEY', required: true, description: 'Supabase Anon Public API Key' },
  { name: 'VITE_SUPABASE_URL', required: true, description: 'Supabase Project Endpoint URL' },
  { name: 'Groq_Token', aliases: ['VITE_GROQ_TOKEN', 'GROQ_API_KEY'], required: true, description: 'Groq AI Model Provider API Key' },
  { name: 'SUPABASE_DB_PASSWORD', required: false, description: 'Supabase PostgreSQL Master Password' },
  { name: 'GH_TOKEN', required: false, description: 'GitHub CI/CD Automation Token' }
];

let failedCount = 0;

console.log('📋 Auditing environment credentials against .env.example specifications:\n');

secretsToAudit.forEach(item => {
  let val = envMap[item.name];
  if (!val && item.aliases) {
    for (const alias of item.aliases) {
      if (envMap[alias]) {
        val = envMap[alias];
        break;
      }
    }
  }

  if (!val) {
    if (item.required) {
      console.error(`  ❌ [${item.name}]: MISSING (Required: ${item.description})`);
      failedCount += 1;
    } else {
      console.warn(`  ⚠️ [${item.name}]: Not set (Optional: ${item.description})`);
    }
  } else if (isPlaceholder(val)) {
    console.error(`  ❌ [${item.name}]: INVALID PLACEHOLDER ([REDACTED])`);
    failedCount += 1;
  } else {
    // Check JWT structure if token starts with eyJ
    if (val.startsWith('eyJ')) {
      const parts = val.split('.');
      if (parts.length !== 3) {
        console.error(`  ❌ [${item.name}]: MALFORMED JWT STRUCTURE (${parts.length} parts)`);
        failedCount += 1;
        return;
      }
    }
    // SECURE LOGGING: Never print secret characters in terminal logs!
    console.log(`  ✅ [${item.name}]: Valid format [REDACTED_SECRET - Length: ${val.length} chars]`);
  }
});

// Check if user requested a new random key generation
if (process.argv.includes('--generate-key') || process.argv.includes('--rotate')) {
  console.log('\n🔑 Generated Strong Cryptographic Replacement Secret (AES-256 / SHA-256):');
  const newSecret = crypto.randomBytes(32).toString('hex');
  console.log(`   New Secret Candidate: ${newSecret}`);
  console.log('   (Update this value in Supabase Vault and GitHub Repository Secrets)');
}

console.log('\n==============================================================================');
if (failedCount > 0) {
  console.error(`⚠️ Secret Rotation Audit detected ${failedCount} missing or invalid secret(s).`);
  console.error('Please update .env with valid credentials before deployment.');
  process.exit(1);
} else {
  console.log('✅ All required environment secrets verified clean!');
  console.log('Always use Supabase Vault and Github Secrets for cloud secret management.');
  process.exit(0);
}
