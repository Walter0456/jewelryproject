import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function initDatabase() {
  const client = await pool.connect();

  try {
    console.log('Reading schema file...');
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing database schema...');
    await client.query(schema);

    console.log('✓ Database initialized successfully!');
  } catch (err) {
    console.error('Error initializing database:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase();
