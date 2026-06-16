#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push

# Ensure the business deposit address is always set in system_settings
node --input-type=module <<'EOF'
import pg from './node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL });
await pool.query(`
  INSERT INTO system_settings (key, value) VALUES ('trc20Address', 'TLBskP2mS6hDDxaRxUCeLwCzznBDkMs1P5')
  ON CONFLICT (key) DO NOTHING
`);
console.log('[post-merge] trc20Address seeded in system_settings');
await pool.end();
EOF
