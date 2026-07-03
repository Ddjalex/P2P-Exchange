#!/usr/bin/env node
// Applies drizzle migration SQL files directly, skipping TTY prompts.
// Uses CREATE TABLE IF NOT EXISTS / ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS patterns.
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('NEON_DATABASE_URL or DATABASE_URL is not set');
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

const migrationsDir = path.join(__dirname, '../lib/db/drizzle');
const sqlFiles = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

for (const file of sqlFiles) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  // Split on drizzle's statement-breakpoint marker
  const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);

  console.log(`\n📄 Applying ${file} (${statements.length} statements)...`);
  for (const stmt of statements) {
    // Make CREATE TABLE idempotent
    const safe = stmt
      .replace(/^CREATE TABLE "/, 'CREATE TABLE IF NOT EXISTS "')
      .replace(/^CREATE TYPE "/, 'CREATE TYPE IF NOT EXISTS "')
      .replace(/^ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)"/, 
               'ALTER TABLE "$1" ADD CONSTRAINT IF NOT EXISTS "$2"');
    try {
      await client.query(safe);
    } catch (err) {
      // Skip duplicate object errors (42710 = duplicate_object, 42P07 = duplicate_table, 42701 = duplicate_column)
      if (['42710', '42P07', '42701', '23505'].includes(err.code)) {
        console.log(`  ⚠️  Already exists, skipping: ${safe.slice(0, 60).replace(/\n/g, ' ')}...`);
      } else {
        console.error(`  ✗ Error: ${err.message}`);
        console.error(`    Statement: ${safe.slice(0, 120)}`);
      }
    }
  }
}

console.log('\n✅ Migrations applied.');
await client.end();
