import pg from 'pg';
import path from 'path';
import dotenv from 'dotenv';

const { Pool } = pg;

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const dbConfig = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
};

const missingDb = ['DB_USER', 'DB_PASSWORD', 'DB_NAME'].filter((key) => !process.env[key]);
if (missingDb.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${missingDb.join(', ')}`);
  process.exit(1);
}

const pool = new Pool(dbConfig);

async function runSnapshot() {
  const snapshotDate = process.argv[2] || new Date().toISOString().split('T')[0];
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO inventory_snapshots (product_id, closing_stock, snapshot_date)
       SELECT id, stock, $1::date FROM products WHERE deleted_at IS NULL
       ON CONFLICT (product_id, snapshot_date)
       DO UPDATE SET closing_stock = EXCLUDED.closing_stock`,
      [snapshotDate]
    );
    console.log(`✅ Inventory snapshot saved for ${snapshotDate}`);
  } catch (err) {
    console.error('Snapshot failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runSnapshot();
