import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const databaseUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!databaseUrl || !authToken) {
  console.error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before running this migration.');
  process.exit(1);
}

const client = createClient({ url: databaseUrl, authToken });
const migrationPath = fileURLToPath(new URL('../migrations/social-hiking-feed.sql', import.meta.url));
const sql = readFileSync(migrationPath, 'utf8')
  .split(/\r?\n/)
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');
const statements = sql.split(/;\s*(?=\S|$)/).map((statement) => statement.trim()).filter(Boolean);

try {
  for (const statement of statements) {
    const label = statement.split(/\r?\n/, 1)[0].slice(0, 70);
    try {
      await client.execute(statement);
      console.log('OK:  ', label);
    } catch (error) {
      if (String(error?.message ?? error).includes('duplicate column name')) {
        console.log('SKIP:', label, '(already exists)');
      } else {
        console.error('FAIL:', label);
        console.error(error instanceof Error ? error.message : 'Unknown database error.');
        process.exitCode = 1;
        break;
      }
    }
  }

  if (process.exitCode !== 1) {
    const [tables, postColumns, foreignKeyIssues] = await Promise.all([
      client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"),
      client.execute('PRAGMA table_info(posts)'),
      client.execute('PRAGMA foreign_key_check'),
    ]);
    console.log('\nTables:', tables.rows.map((row) => String(row.name)).join(', '));
    console.log('Post columns:', postColumns.rows.map((row) => String(row.name)).join(', '));
    console.log('Foreign-key issues:', foreignKeyIssues.rows.length);
    if (foreignKeyIssues.rows.length > 0) process.exitCode = 1;
  }
} catch (error) {
  console.error('Migration verification failed.');
  console.error(error instanceof Error ? error.message : 'Unknown database error.');
  process.exitCode = 1;
} finally {
  await client.close();
}
