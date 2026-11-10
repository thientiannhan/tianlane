import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_FILE = path.resolve(__dirname, 'schema.sql');

function loadEnvFile() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

async function runMigration() {
  loadEnvFile();

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.includes('ep-cool-darkness-123456')) {
    console.error(
      '❌ Error: DATABASE_URL is not set or still contains placeholder value in .env.'
    );
    console.log(
      '👉 Paste your real Neon.tech connection string into .env (e.g. postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require)'
    );
    process.exit(1);
  }

  if (!dbUrl.includes('-pooler')) {
    console.warn(
      '⚠️  [Rule Check Warning]: DATABASE_URL does not contain "-pooler". Neon recommends the pooled connection string to protect against connection exhaustion and allow scale-to-zero.'
    );
  }

  console.log('🚀 Connecting to Neon PostgreSQL...');
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✓ Connected successfully to Neon.tech PostgreSQL.');

    const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
    console.log(`📄 Executing schema from ${path.basename(SCHEMA_FILE)}...`);

    await client.query(sql);

    // Verify created tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('✓ Schema migration completed successfully!');
    console.log('📊 Tables verified in database:');
    for (const row of res.rows) {
      console.log(`   - ${row.table_name}`);
    }
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
