import pg from 'pg';
const { Client } = pg;

async function tryFix(table, col) {
  const client = new Client({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const dupes = await client.query(`select "${col}", count(*) from "${table}" where "${col}" is not null group by "${col}" having count(*) > 1`);
  if (dupes.rows.length > 0) {
    console.log('BLOCKED - real duplicates found for', table, col, dupes.rows);
    await client.end();
    return false;
  }
  const constraintName = `${table}_${col}_unique`;
  await client.query(`DROP INDEX IF EXISTS "${constraintName}"`);
  await client.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${constraintName}"`);
  await client.query(`ALTER TABLE "${table}" ADD CONSTRAINT "${constraintName}" UNIQUE ("${col}")`);
  console.log('applied', table, col);
  await client.end();
  return true;
}

const [,, table, col] = process.argv;
await tryFix(table, col);
