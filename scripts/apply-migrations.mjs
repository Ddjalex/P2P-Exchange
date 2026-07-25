#!/usr/bin/env node
/**
 * Applies Drizzle migration SQL files directly to the database.
 *
 * Idempotency strategy:
 *   - Duplicate object errors (42710, 42P07) are silently skipped — those mean
 *     the type/table/constraint already exists, which is safe.
 *   - ALL other errors cause immediate non-zero exit.
 *
 * Run after adding NEON_DATABASE_URL to Replit Secrets.
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('ERROR: NEON_DATABASE_URL or DATABASE_URL is not set');
  process.exit(1);
}

// Duplicate object / duplicate table / duplicate column / duplicate constraint error codes
const IDEMPOTENT_CODES = new Set(['42701', '42710', '42P07', '42P16']);

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

const migrationsDir = path.join(__dirname, '../lib/db/drizzle');
const sqlFiles = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

let failed = false;

for (const file of sqlFiles) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  // Drizzle delimits statements with this marker
  const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);

  console.log(`\n📄 ${file} — ${statements.length} statement(s)`);
  for (const stmt of statements) {
    try {
      await client.query(stmt);
      console.log(`  ✓ ${stmt.slice(0, 80).replace(/\n/g, ' ')}`);
    } catch (err) {
      if (IDEMPOTENT_CODES.has(err.code)) {
        console.log(`  ⚠  already exists, skipping: ${stmt.slice(0, 70).replace(/\n/g, ' ')}`);
      } else {
        console.error(`\n  ✗ FAILED (${err.code}): ${err.message}`);
        console.error(`    Statement: ${stmt.slice(0, 200)}`);
        failed = true;
      }
    }
  }
}

await client.end();

if (failed) {
  console.error('\n❌ One or more migration statements failed. Schema may be incomplete.');
  process.exit(1);
}

// Post-migration verification: confirm the required core tables exist
console.log('\n🔍 Verifying core tables...');
const verifyClient = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await verifyClient.connect();

const REQUIRED_TABLES = [
  'users', 'wallets', 'transactions', 'orders', 'ads', 'messages',
  'system_settings', 'kyc_submissions', 'push_subscriptions', 'notifications',
];

const { rows } = await verifyClient.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = ANY($1)`,
  [REQUIRED_TABLES]
);
await verifyClient.end();

const found = new Set(rows.map(r => r.table_name));
const missing = REQUIRED_TABLES.filter(t => !found.has(t));

if (missing.length > 0) {
  console.error(`❌ Missing tables after migration: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`✅ All ${REQUIRED_TABLES.length} core tables verified. Migrations complete.`);
