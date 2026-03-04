import pg from 'pg';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(projectRoot, '.env.local') });
dotenv.config({ path: path.join(projectRoot, '.env') });

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

const PG_DUMP_PATH = process.env.PG_DUMP_PATH || 'pg_dump';
const DEFAULT_BACKUP_DIR = process.env.BACKUP_DIR || path.join(projectRoot, 'backups');

const runBackup = async () => {
  if (path.isAbsolute(PG_DUMP_PATH) && !fs.existsSync(PG_DUMP_PATH)) {
    throw new Error(`pg_dump not found at ${PG_DUMP_PATH}`);
  }

  const client = await pool.connect();
  try {
    const res = await client.query('SELECT backup_settings FROM settings WHERE id = 1');
    const backupSettings = res.rows[0]?.backup_settings || {};
    const targetDir = process.env.BACKUP_DIR || backupSettings.path || DEFAULT_BACKUP_DIR;
    const resolvedDir = path.resolve(targetDir);
    fs.mkdirSync(resolvedDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(resolvedDir, `jewel_db_${timestamp}.sql`);

    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(filePath, { flags: 'w' });
      const dump = spawn(
        PG_DUMP_PATH,
        ['-U', dbConfig.user || 'postgres', dbConfig.database || 'jewelry_db'],
        { env: { ...process.env, PGPASSWORD: dbConfig.password || '' } }
      );

      let stderr = '';
      dump.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      dump.on('error', (err) => reject(err));
      dump.on('close', (code) => {
        out.close();
        if (code !== 0) {
          return reject(new Error(stderr || `pg_dump exited with code ${code}`));
        }
        resolve();
      });

      dump.stdout.pipe(out);
    });

    const uploadsDir = path.join(projectRoot, 'uploads');
    let uploadsZip = null;
    if (fs.existsSync(uploadsDir)) {
      uploadsZip = path.join(resolvedDir, `uploads_${timestamp}.zip`);
      await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(uploadsZip);
        const archive = archiver('zip', { zlib: { level: 9 } });
        output.on('close', resolve);
        archive.on('error', reject);
        archive.pipe(output);
        archive.directory(uploadsDir, false);
        archive.finalize();
      });
    }

    const merged = { ...backupSettings, lastBackupAt: new Date().toISOString(), lastBackupFile: filePath, lastUploadsZip: uploadsZip, path: targetDir };
    await client.query('UPDATE settings SET backup_settings = $1 WHERE id = 1', [JSON.stringify(merged)]);
    console.log(`✅ Backup saved to ${filePath}`);
  } finally {
    client.release();
  }
};

runBackup()
  .catch((err) => {
    console.error('Backup failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
