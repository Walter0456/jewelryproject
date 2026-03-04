
import express from 'express';
import pkg from 'pg';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import archiver from 'archiver';
import { spawn, execFile } from 'child_process';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

const { Pool } = pkg;
const app = express();
const port = 3001;

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

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30m';
const PG_DUMP_PATH = process.env.PG_DUMP_PATH || 'pg_dump';
const DEFAULT_BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
const BACKUP_TASK_NAME = process.env.BACKUP_TASK_NAME || 'JewelAdmin Backup';
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in your environment.');
  process.exit(1);
}

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const allowedImageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const toDateOnly = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
};

const getUploadBasename = (value) => {
  if (!value || typeof value !== 'string') return null;
  const marker = '/uploads/';
  const idx = value.indexOf(marker);
  if (idx === -1) return null;
  const tail = value.slice(idx + marker.length);
  return tail ? path.basename(tail) : null;
};

const getUploadUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('/uploads/')) return value;
  const marker = '/uploads/';
  const idx = value.indexOf(marker);
  if (idx === -1) return null;
  return value.slice(idx);
};

const getProductImageUrls = (row) => {
  const urls = [];
  if (row?.main_image) urls.push(row.main_image);
  if (Array.isArray(row?.thumbnails)) {
    row.thumbnails.forEach((thumb) => {
      if (thumb) urls.push(thumb);
    });
  }
  return urls;
};

const removeUploadIfUnused = async (url) => {
  const uploadUrl = getUploadUrl(url);
  if (!uploadUrl) return false;
  const refCheck = await pool.query(
    'SELECT 1 FROM products WHERE deleted_at IS NULL AND ($1 = main_image OR $1 = ANY(thumbnails)) LIMIT 1',
    [uploadUrl]
  );
  if (refCheck.rows.length > 0) return false;
  const fileName = getUploadBasename(uploadUrl);
  if (!fileName) return false;
  const filePath = path.join(uploadDir, fileName);
  if (!fs.existsSync(filePath)) return false;
  await fs.promises.unlink(filePath).catch(() => null);
  return true;
};

const purgeUnusedUploads = async () => {
  const result = await pool.query('SELECT main_image, thumbnails FROM products WHERE deleted_at IS NULL');
  const used = new Set();
  result.rows.forEach((row) => {
    getProductImageUrls(row).forEach((url) => {
      const fileName = getUploadBasename(url);
      if (fileName) used.add(fileName);
    });
  });
  const files = await fs.promises.readdir(uploadDir, { withFileTypes: true });
  let deleted = 0;
  for (const entry of files) {
    if (!entry.isFile()) continue;
    if (!used.has(entry.name)) {
      await fs.promises.unlink(path.join(uploadDir, entry.name)).catch(() => null);
      deleted += 1;
    }
  }
  return { deleted, total: files.filter((f) => f.isFile()).length, kept: used.size };
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '';
    cb(null, `${crypto.randomUUID()}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowedImageTypes.has(file.mimetype) || !allowedImageExts.has(ext)) {
      return cb(new Error('Only JPG, PNG, WEBP, and GIF images are allowed'));
    }
    cb(null, true);
  }
});

// Test DB Connection on startup
pool.connect((err, client, release) => {
  if (err) {
    return console.error('CRITICAL: Error acquiring client from pool. Is PostgreSQL running?', err.stack);
  }
  console.log(`SUCCESS: Connected to PostgreSQL database: ${pool.options.database}`);
    client.query(`
      ALTER TABLE IF EXISTS settings
      ALTER COLUMN admin_pin TYPE TEXT,
      ADD COLUMN IF NOT EXISTS receipt_layout JSONB DEFAULT '{}'::jsonb
    `, (alterErr) => {
      if (alterErr) {
        console.warn('Warning: Unable to ensure admin_pin column type:', alterErr.message);
      }
      client.query(`
        ALTER TABLE IF EXISTS sales 
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed',
        ADD COLUMN IF NOT EXISTS reissued BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS reissue_date TIMESTAMP DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS reissue_admin VARCHAR(50),
        ADD COLUMN IF NOT EXISTS receipt_type VARCHAR(2) DEFAULT 'OR',
        ADD COLUMN IF NOT EXISTS amount_received DECIMAL(12, 2),
        ADD COLUMN IF NOT EXISTS change_amount DECIMAL(12, 2) DEFAULT 0
      `, (salesErr) => {
        if (salesErr) {
          console.warn('Warning: Unable to ensure sales table columns:', salesErr.message);
        }
        release();
      });
    });
});

const runSnapshotForDate = async (snapshotDate) => {
  await pool.query(
    `INSERT INTO inventory_snapshots (product_id, closing_stock, snapshot_date)
     SELECT id, stock, $1::date FROM products WHERE deleted_at IS NULL
     ON CONFLICT (product_id, snapshot_date)
     DO UPDATE SET closing_stock = EXCLUDED.closing_stock`,
    [snapshotDate]
  );
};

const ensureYesterdaySnapshot = async () => {
  try {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const snapshotDate = toDateOnly(yesterday);
    if (!snapshotDate) return;
    const check = await pool.query(
      'SELECT 1 FROM inventory_snapshots WHERE snapshot_date = $1 LIMIT 1',
      [snapshotDate]
    );
    if (check.rows.length === 0) {
      await runSnapshotForDate(snapshotDate);
      console.log(`Startup snapshot catch-up completed for ${snapshotDate}`);
    }
  } catch (err) {
    console.warn('Startup snapshot check failed:', err.message || err);
  }
};

setTimeout(() => {
  ensureYesterdaySnapshot();
}, 1000);

app.use(helmet());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'http://localhost:5173', 'http://127.0.0.1:5173'],
      upgradeInsecureRequests: [],
    },
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || CORS_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(bodyParser.json({ limit: '2mb' }));

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});
app.use('/api', globalLimiter);

app.use('/uploads', authenticate, express.static(uploadDir));

// Centralized Error Helper
const handleError = (res, err, status = 500) => {
    console.error("API Error:", err);
    res.status(status).json({ 
        error: true, 
        message: err.message || "Internal Server Error",
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';
const PIN_HASH_PREFIX = 'pbkdf2$';
const WEAK_ADMIN_HASH = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
const WEAK_ADMIN_SALT = 'c3ab8ff13720e8ad9047dd39466b3c89';

const deriveKey = (value, salt) => {
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(value, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST, (err, derivedKey) => {
            if (err) return reject(err);
            resolve(derivedKey);
        });
    });
};

const hashPassword = async (password, salt) => {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const derivedKey = await deriveKey(password, actualSalt);
    return { hash: derivedKey.toString('hex'), salt: actualSalt };
};

const hashPin = async (pin) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = await deriveKey(pin, salt);
    return `${PIN_HASH_PREFIX}${salt}$${derivedKey.toString('hex')}`;
};

const verifyPin = async (pin, stored) => {
    if (!stored || typeof stored !== 'string') return false;
    if (!stored.startsWith(PIN_HASH_PREFIX)) {
        return false;
    }
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const storedHash = parts[2];
    if (!salt || !storedHash || storedHash.length % 2 !== 0 || !/^[a-f0-9]+$/i.test(storedHash)) {
        return false;
    }
    const derivedKey = await deriveKey(pin, salt);
    const computed = derivedKey.toString('hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    const computedBuffer = Buffer.from(computed, 'hex');
    if (storedBuffer.length !== computedBuffer.length) return false;
    return crypto.timingSafeEqual(storedBuffer, computedBuffer);
};

const verifyPinAndUpgrade = async (pin) => {
    const settingsRes = await pool.query('SELECT admin_pin FROM settings WHERE id = 1');
    const stored = settingsRes.rows[0]?.admin_pin;
    return verifyPin(pin, stored);
};

const migrateLegacyAdminPin = async () => {
    const settingsRes = await pool.query('SELECT admin_pin FROM settings WHERE id = 1');
    const storedPin = settingsRes.rows[0]?.admin_pin;
    if (!storedPin || typeof storedPin !== 'string' || storedPin.startsWith(PIN_HASH_PREFIX)) {
        return;
    }

    const trimmedPin = storedPin.trim();
    if (/^\d{4,6}$/.test(trimmedPin)) {
        const upgraded = await hashPin(trimmedPin);
        await pool.query('UPDATE settings SET admin_pin = $1 WHERE id = 1', [upgraded]);
        console.warn('[SECURITY] Migrated legacy plaintext admin PIN to PBKDF2 format.');
        return;
    }

    await pool.query('UPDATE settings SET admin_pin = NULL WHERE id = 1');
    console.warn('[SECURITY] Invalid legacy admin PIN format detected and reset. Set a new admin PIN in Settings.');
};

const ensureSecureAdminAccount = async () => {
    const adminRes = await pool.query(
      'SELECT username, password_hash, salt FROM users WHERE username = $1 LIMIT 1',
      ['admin']
    );

    if (adminRes.rows.length === 0) {
        const temporaryPassword = crypto.randomBytes(16).toString('base64url');
        const { hash, salt } = await hashPassword(temporaryPassword);
        await pool.query(
          'INSERT INTO users (username, password_hash, salt, role, status, first_name, last_name) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          ['admin', hash, salt, 'admin', 'active', 'System', 'Admin']
        );
        console.warn('[SECURITY] Created bootstrap admin account.');
        console.warn(`[SECURITY] Temporary admin password (save now): ${temporaryPassword}`);
        console.warn('[SECURITY] Change the admin password immediately after login.');
        return;
    }

    const adminRow = adminRes.rows[0];
    if (adminRow.password_hash === WEAK_ADMIN_HASH && adminRow.salt === WEAK_ADMIN_SALT) {
        const temporaryPassword = crypto.randomBytes(16).toString('base64url');
        const { hash, salt } = await hashPassword(temporaryPassword);
        await pool.query(
          'UPDATE users SET password_hash = $1, salt = $2 WHERE username = $3',
          [hash, salt, 'admin']
        );
        console.warn('[SECURITY] Replaced weak seeded admin password hash with a secure bootstrap credential.');
        console.warn(`[SECURITY] New temporary admin password (save now): ${temporaryPassword}`);
        console.warn('[SECURITY] Change the admin password immediately after login.');
    }
};

const runStartupSecurityMigrations = async () => {
    await migrateLegacyAdminPin();
    await ensureSecureAdminAccount();
};

const signToken = (username, expiresIn) => {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: expiresIn || TOKEN_EXPIRES_IN });
};

const getSessionExpiry = async () => {
  try {
    const result = await pool.query('SELECT session_timeout_minutes FROM settings WHERE id = 1');
    const minutes = parseInt(result.rows[0]?.session_timeout_minutes, 10);
    if (Number.isFinite(minutes) && minutes > 0) {
      return `${minutes}m`;
    }
  } catch (err) {
    console.warn('Warning: Unable to read session timeout, using default.');
  }
  return TOKEN_EXPIRES_IN;
};

const authenticate = async (req, res, next) => {
  const token = req.cookies?.jwt;
  if (!token) {
    return res.status(401).json({ message: 'Missing auth token' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userResult = await pool.query(
      'SELECT username, role, status FROM users WHERE username = $1',
      [decoded.username]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }
    const user = userResult.rows[0];
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account disabled' });
    }
    req.user = { username: user.username, role: user.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

const requireSelfOrAdmin = (req, res, next) => {
  if (req.user?.role === 'admin' || req.user?.username === req.params.username) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden' });
};

const execFileAsync = (cmd, args) => {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr || err.message));
      }
      resolve(stdout);
    });
  });
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' }
});

const pinLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many PIN attempts. Please wait and try again.' }
});

const qrLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many QR requests. Please slow down.' }
});

const getBackupSettings = async () => {
  const res = await pool.query('SELECT backup_settings FROM settings WHERE id = 1');
  return res.rows[0]?.backup_settings || {};
};

const mergeBackupSettings = async (patch) => {
  const current = await getBackupSettings();
  const merged = { ...current, ...patch };
  await pool.query('UPDATE settings SET backup_settings = $1 WHERE id = 1', [JSON.stringify(merged)]);
  return merged;
};

const getReceiptLayoutSettings = async () => {
  const res = await pool.query('SELECT receipt_layout FROM settings WHERE id = 1');
  const raw = res.rows[0]?.receipt_layout;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
};

const getReceiptSaveDir = async () => {
  const receiptLayout = await getReceiptLayoutSettings();
  const configuredPath = typeof receiptLayout?.receiptSavePath === 'string'
    ? receiptLayout.receiptSavePath.trim()
    : '';
  return path.resolve(configuredPath || path.join(process.cwd(), 'receipts'));
};

const zipUploadsToDir = async (backupDir, timestamp) => {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) return null;

  const zipPath = path.join(backupDir, `uploads_${timestamp}.zip`);
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(uploadsDir, false);
    archive.finalize();
  });

  return zipPath;
};

const runBackupToDir = async (backupDir) => {
  if (path.isAbsolute(PG_DUMP_PATH) && !fs.existsSync(PG_DUMP_PATH)) {
    throw new Error(`pg_dump not found at ${PG_DUMP_PATH}`);
  }
  const resolvedDir = path.resolve(backupDir || DEFAULT_BACKUP_DIR);
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

  const uploadsZip = await zipUploadsToDir(resolvedDir, timestamp);
  return { filePath, uploadsZip };
};

// Health check endpoint (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- AUTH ---
const setAuthCookie = (res, token) => {
  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
};

app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ message: 'User not found' });

    const user = result.rows[0];
    if (user.status === 'disabled') return res.status(403).json({ message: 'Account disabled' });

    const { hash } = await hashPassword(password, user.salt);
    if (hash === user.password_hash) {
      const { password_hash, salt, ...safeUser } = user;
      const expiresIn = await getSessionExpiry();
      const token = signToken(safeUser.username, expiresIn);
      setAuthCookie(res, token);
      res.json({ user: safeUser });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (err) {
    handleError(res, err);
  }
});

// Enhanced QR login endpoint
app.post('/api/login/qr', loginLimiter, async (req, res) => {
  const { token: qrToken } = req.body;
  try {
    // Validate token exists and is active
    const tokenResult = await pool.query('SELECT username FROM qr_tokens WHERE token = $1 AND is_active = true', [
      qrToken,
    ]);

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid or expired QR Badge' });
    }

    const username = tokenResult.rows[0].username;

    // Get user details (include first_name and last_name for full name display)
    const userResult = await pool.query(
      'SELECT username, first_name, last_name, role, status FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    if (user.status === 'disabled') {
      return res.status(403).json({ message: 'Account disabled' });
    }

    // Update last_used timestamp
    await pool.query('UPDATE qr_tokens SET last_used = NOW() WHERE token = $1', [qrToken]);

    const safeUser = user;
    const expiresIn = await getSessionExpiry();
    const authToken = signToken(safeUser.username, expiresIn);
    setAuthCookie(res, authToken);
    res.json({ user: safeUser });
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('jwt');
  res.json({ success: true });
});

// Verify if a registration code is valid (public)
const registerCodeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { message: 'Too many code verification attempts. Please slow down.' }
});

app.post('/api/codes/verify', registerCodeLimiter, async (req, res) => {
    const { code } = req.body;
    try {
        const result = await pool.query(
            "SELECT * FROM registration_codes WHERE code = $1 AND status = 'ACTIVE' AND expires_at > NOW()",
            [code]
        );
        if (result.rows.length > 0) {
            res.json({ valid: true });
        } else {
            res.status(400).json({ valid: false, message: "Invalid or expired code" });
        }
    } catch (err) { handleError(res, err); }
});

app.post('/api/qr-tokens', authenticate, requireAdmin, qrLimiter, async (req, res) => {
    const { username } = req.body;
    try {
        if (!username) {
            return res.status(400).json({ message: 'Username is required' });
        }
        // Deactivate old tokens for this user
        await pool.query(
            'UPDATE qr_tokens SET is_active = false WHERE username = $1',
            [username]
        );
        
        // Generate secure token server-side
        const newToken = crypto.randomBytes(32).toString('base64url');

        // Insert new token
        await pool.query(
            'INSERT INTO qr_tokens (username, token) VALUES ($1, $2)',
            [username, newToken]
        );
        
        res.json({ success: true, token: newToken });
    } catch (err) { handleError(res, err); }
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { message: 'Too many registration attempts. Please try again later.' }
});

app.post('/api/register', registrationLimiter, async (req, res) => {
    const { username, password, role, firstName, lastName, registrationCode } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check code validity
        const codeRes = await client.query(
            "SELECT id FROM registration_codes WHERE code = $1 AND status = 'ACTIVE' AND expires_at > NOW()",
            [registrationCode]
        );
        if (codeRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Registration code invalid or expired" });
        }

        // Hash and Create User
        const { hash, salt } = await hashPassword(password);
        await client.query(
            'INSERT INTO users (username, password_hash, salt, role, first_name, last_name) VALUES ($1, $2, $3, $4, $5, $6)',
            [username, hash, salt, role || 'staff', firstName || null, lastName || null]
        );

        // Mark code as USED
        await client.query(
            "UPDATE registration_codes SET status = 'USED', used_by_name = $1, used_by_username = $2 WHERE code = $3",
            [`${firstName || ''} ${lastName || ''}`.trim(), username, registrationCode]
        );

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        handleError(res, err, 400);
    } finally {
        client.release();
    }
  });

// All routes below require authentication
app.use('/api', authenticate);

app.post('/api/admin/verify-pin', pinLimiter, async (req, res) => {
    const { pin } = req.body;
    if (!pin || typeof pin !== 'string' || pin.length < 4 || pin.length > 6) {
        return res.status(400).json({ valid: false, message: 'Invalid PIN format' });
    }
    try {
        const valid = await verifyPinAndUpgrade(pin);
        res.json({ valid });
    } catch (err) { handleError(res, err); }
});

// Upload images (admin only)
app.post('/api/upload', requireAdmin, (req, res) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ message: err.message || 'Upload failed' });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        res.json({ url: `/uploads/${req.file.filename}` });
    });
});

app.post('/api/uploads/purge', requireAdmin, async (req, res) => {
    try {
        const result = await purgeUnusedUploads();
        res.json({ success: true, ...result });
    } catch (err) { handleError(res, err); }
});

// --- USER MANAGEMENT ---
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT username, first_name, last_name, role, status, profile_picture, created_at FROM users ORDER BY username ASC');
        res.json(result.rows);
    } catch (err) { handleError(res, err); }
});

app.patch('/api/users/:username/profile', requireSelfOrAdmin, async (req, res) => {
    const { firstName, lastName, profilePicture } = req.body;
    try {
        await pool.query('UPDATE users SET first_name = $1, last_name = $2, profile_picture = $3 WHERE username = $4', [firstName, lastName, profilePicture, req.params.username]);
        res.json({ success: true });
    } catch (err) { handleError(res, err); }
});

app.patch('/api/users/:username/status', requireAdmin, async (req, res) => {
    const { status } = req.body;
    try {
        await pool.query('UPDATE users SET status = $1 WHERE username = $2', [status, req.params.username]);
        res.json({ success: true });
    } catch (err) { handleError(res, err); }
});

app.patch('/api/users/:username/password', requireSelfOrAdmin, async (req, res) => {
    const { currentPassword, newPassword, adminPin } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Get current user data
        const userResult = await client.query('SELECT password_hash, salt FROM users WHERE username = $1', [req.params.username]);
        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'User not found' });
        }
        
        const { password_hash, salt } = userResult.rows[0];

        // Optional admin override: if adminPin matches settings.admin_pin, skip current password check
        let adminOverride = false;
        if (adminPin) {
            const settingsRes = await client.query('SELECT admin_pin FROM settings WHERE id = 1');
            const correctPin = settingsRes.rows[0]?.admin_pin;
            if (await verifyPin(adminPin, correctPin)) {
                adminOverride = true;
            }
        }

        if (!adminOverride) {
            // Verify current password
            const { hash: currentHash } = await hashPassword(currentPassword, salt);
            if (currentHash !== password_hash) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Current password is incorrect' });
            }
        }
        
        // Hash new password
        const { hash: newHash, salt: newSalt } = await hashPassword(newPassword);
        
        // Update password
        await client.query('UPDATE users SET password_hash = $1, salt = $2 WHERE username = $3', [newHash, newSalt, req.params.username]);
        
        // Log the password change
        await client.query(
            'INSERT INTO activities (username, action, item) VALUES ($1, $2, $3)',
            [req.params.username, 'Password Changed', adminOverride ? 'Admin override' : 'Password updated']
        );
        
        await client.query('COMMIT');
        res.json({ success: true, message: adminOverride ? 'Password updated by admin' : 'Password updated successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        handleError(res, err, 400);
    } finally {
        client.release();
    }
});

app.delete('/api/users/:username', requireAdmin, async (req, res) => {
    try {
        if (req.params.username === 'admin') return res.status(400).json({ message: 'Cannot delete root admin' });
        
        // Get user info before soft-deleting
        const userResult = await pool.query('SELECT first_name, last_name FROM users WHERE username = $1', [req.params.username]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const user = userResult.rows[0];
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || req.params.username;
        
        // Soft-delete: Update status to 'deleted' and save original name
        await pool.query(
            `UPDATE users SET status = 'deleted', deleted_at = NOW(), original_name = $1 WHERE username = $2`,
            [fullName, req.params.username]
        );
        
        res.json({ success: true, message: `User ${fullName} has been deleted but sales records are preserved` });
    } catch (err) { 
        console.error('Delete user error:', err);
        handleError(res, err); 
    }
});

// --- PRODUCTS ---
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products WHERE deleted_at IS NULL ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) { handleError(res, err); }
});

app.post('/api/products', requireAdmin, async (req, res) => {
    const p = req.body;
    try {
        const existingRes = await pool.query(
            'SELECT price, main_image, thumbnails FROM products WHERE id = $1',
            [p.id]
        );
        const existing = existingRes.rows[0];
        const previousPrice = existing ? Number(existing.price) : null;
        const oldImages = existing ? getProductImageUrls(existing).map(getUploadUrl).filter(Boolean) : [];
        const newImages = getProductImageUrls({ main_image: p.mainImage, thumbnails: p.thumbnails })
          .map(getUploadUrl)
          .filter(Boolean);

        await pool.query(
            `INSERT INTO products (id, name, stock, price, weight_grams, specs, detailed_description, material, material_grade, main_image, thumbnails, category)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO UPDATE SET
             name=$2, stock=$3, price=$4, weight_grams=$5, specs=$6, detailed_description=$7, material=$8, material_grade=$9, main_image=$10, thumbnails=$11, category=$12, deleted_at=NULL`,
            [p.id, p.name, p.stock, p.price, p.weightGrams, p.specs, p.detailedDescription, p.material, p.materialGrade, p.mainImage, p.thumbnails, p.category]
        );

        if (previousPrice !== null && Number(p.price) !== previousPrice) {
            const formattedOld = Number(previousPrice).toLocaleString();
            const formattedNew = Number(p.price).toLocaleString();
            await pool.query(
                'INSERT INTO activities (username, action, item) VALUES ($1, $2, $3)',
                [req.user?.username || 'system', 'Price Changed', `ID:${p.id} | ₱${formattedOld} → ₱${formattedNew} | ${p.name}`]
            );
        }

        const newSet = new Set(newImages);
        for (const oldUrl of oldImages) {
            if (!newSet.has(oldUrl)) {
                await removeUploadIfUnused(oldUrl);
            }
        }

        res.json({ success: true });
    } catch (err) { handleError(res, err); }
});

app.patch('/api/products/:id/stock', requireAdmin, async (req, res) => {
    const { stock } = req.body;
    try {
        await pool.query('UPDATE products SET stock = $1 WHERE id = $2', [stock, req.params.id]);
        res.json({ success: true });
    } catch (err) { handleError(res, err); }
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
    try {
        const existingRes = await pool.query(
            'SELECT main_image, thumbnails FROM products WHERE id = $1',
            [req.params.id]
        );
        await pool.query('UPDATE products SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
        const existing = existingRes.rows[0];
        if (existing) {
            const images = getProductImageUrls(existing).map(getUploadUrl).filter(Boolean);
            for (const url of images) {
                await removeUploadIfUnused(url);
            }
        }
        res.json({ success: true });
    } catch (err) { handleError(res, err); }
});

// --- INVENTORY SNAPSHOTS ---
app.get('/api/inventory-snapshots', async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'date query param required (YYYY-MM-DD)' });
    try {
        const result = await pool.query(
            'SELECT product_id, closing_stock, snapshot_date FROM inventory_snapshots WHERE snapshot_date = $1 ORDER BY product_id ASC',
            [date]
        );
        res.json(result.rows);
    } catch (err) { handleError(res, err); }
});

app.post('/api/inventory-snapshots/run', requireAdmin, async (req, res) => {
    const snapshotDate = req.body?.date || new Date().toISOString().split('T')[0];
    try {
        await pool.query(
            `INSERT INTO inventory_snapshots (product_id, closing_stock, snapshot_date)
             SELECT id, stock, $1::date FROM products WHERE deleted_at IS NULL
             ON CONFLICT (product_id, snapshot_date)
             DO UPDATE SET closing_stock = EXCLUDED.closing_stock`,
            [snapshotDate]
        );
        res.json({ success: true, date: snapshotDate });
    } catch (err) { handleError(res, err); }
});

// --- BACKUPS ---
app.post('/api/backup/run', requireAdmin, async (req, res) => {
    try {
        const current = await getBackupSettings();
        const targetDir = req.body?.path || current.path || DEFAULT_BACKUP_DIR;
        const result = await runBackupToDir(targetDir);
        const updated = await mergeBackupSettings({
            path: targetDir,
            lastBackupAt: new Date().toISOString(),
            lastBackupFile: result.filePath,
            lastUploadsZip: result.uploadsZip || null
        });
        res.json({ success: true, files: { sql: result.filePath, uploadsZip: result.uploadsZip }, settings: updated });
    } catch (err) { handleError(res, err); }
});

app.post('/api/backup/schedule', requireAdmin, async (req, res) => {
    const enabled = !!req.body?.enabled;
    const time = req.body?.time || '02:00';
    const pathOverride = req.body?.path;
    const provider = req.body?.provider;
    const taskName = req.body?.taskName || BACKUP_TASK_NAME;
    const backupScriptPath = path.join(process.cwd(), 'scripts', 'backup-db.js');
    const taskCommand = `"${process.execPath}" "${backupScriptPath}"`;

    try {
        if (enabled) {
            if (!fs.existsSync(backupScriptPath)) {
                return res.status(500).json({ message: 'Backup script not found' });
            }
            await execFileAsync('schtasks', [
                '/Create',
                '/SC', 'DAILY',
                '/TN', taskName,
                '/TR', taskCommand,
                '/ST', time,
                '/F'
            ]);
        } else {
            await execFileAsync('schtasks', ['/Delete', '/TN', taskName, '/F']).catch((err) => {
                if (!err.message.includes('cannot find the file')) throw err;
            });
        }

        const current = await getBackupSettings();
        const updated = await mergeBackupSettings({
            enabled,
            time,
            path: pathOverride || current.path || DEFAULT_BACKUP_DIR,
            provider: provider || current.provider || 'local',
            taskName
        });

        res.json({ success: true, taskName, settings: updated });
    } catch (err) { handleError(res, err); }
});

app.post('/api/system/select-folder', requireAdmin, async (req, res) => {
    if (process.platform !== 'win32') {
        return res.status(400).json({ message: 'Folder picker is only supported on Windows hosts.' });
    }

    const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const safeTitle = (rawTitle || 'Select Folder').slice(0, 120).replace(/'/g, "''");
    const script = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '${safeTitle}'
$dialog.ShowNewFolderButton = $true
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialog.SelectedPath
}
`;

    try {
        const stdout = await execFileAsync('powershell', ['-NoProfile', '-STA', '-Command', script]);
        const selectedPath = (stdout || '').trim();
        return res.json({ success: true, path: selectedPath || null });
    } catch (err) {
        return handleError(res, err, 500);
    }
});

app.post('/api/receipts/save-image', async (req, res) => {
    const imageData = typeof req.body?.imageData === 'string' ? req.body.imageData : '';
    const orNumberRaw = typeof req.body?.orNumber === 'string' ? req.body.orNumber : 'receipt';
    const requestedType = typeof req.body?.receiptType === 'string' ? req.body.receiptType.toUpperCase() : 'OR';
    const receiptType = requestedType === 'AR' ? 'AR' : 'OR';
    const overrideSavePath = typeof req.body?.savePath === 'string' ? req.body.savePath.trim() : '';

    const match = imageData.match(/^data:image\/png;base64,(.+)$/);
    if (!match) {
        return res.status(400).json({ message: 'imageData must be a PNG data URL' });
    }

    let imageBuffer;
    try {
        imageBuffer = Buffer.from(match[1], 'base64');
    } catch (err) {
        return res.status(400).json({ message: 'Invalid image payload' });
    }
    if (!imageBuffer || imageBuffer.length === 0) {
        return res.status(400).json({ message: 'Empty image payload' });
    }

    const safeOrNumber = orNumberRaw.replace(/[^a-zA-Z0-9_-]/g, '') || 'receipt';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${receiptType}_${safeOrNumber}_${timestamp}.png`;

    const targetDirs = [];
    if (overrideSavePath) {
        targetDirs.push(path.resolve(overrideSavePath));
    } else {
        targetDirs.push(await getReceiptSaveDir());
    }
    targetDirs.push(path.resolve(path.join(process.cwd(), 'receipts')));

    let lastError = null;
    for (const saveDir of targetDirs) {
        try {
            await fs.promises.mkdir(saveDir, { recursive: true });
            const filePath = path.join(saveDir, fileName);
            await fs.promises.writeFile(filePath, imageBuffer);
            return res.json({ success: true, filePath });
        } catch (err) {
            lastError = err;
        }
    }

    return handleError(res, lastError || new Error('Failed to save receipt image'), 500);
});

// --- SALES ---
app.get('/api/sales/next-or', async (req, res) => {
    try {
        const result = await pool.query(`SELECT nextval('or_number_seq') AS next_or`);
        const nextOr = result.rows[0]?.next_or || 1;
        res.json({ nextOr: nextOr.toString().padStart(4, '0') });
    } catch (err) {
        try {
            const fallback = await pool.query(`
                SELECT MAX(CAST(or_number AS INTEGER)) as last_or
                FROM sales
                WHERE or_number ~ '^[0-9]+$'
            `);
            const nextOr = (fallback.rows[0]?.last_or || 0) + 1;
            res.json({ nextOr: nextOr.toString().padStart(4, '0') });
        } catch (fallbackErr) {
            handleError(res, fallbackErr);
        }
    }
});

app.post('/api/sales', async (req, res) => {
    const { id, orNumber, staff, total, items } = req.body;
    const requestedType = typeof req.body?.receiptType === 'string' ? req.body.receiptType.toUpperCase() : 'OR';
    const receiptType = requestedType === 'AR' ? 'AR' : 'OR';
    const totalAmount = Number(total);
    const amountReceived = req.body?.amountReceived != null ? Number(req.body.amountReceived) : totalAmount;
    const changeAmount = Number((amountReceived - totalAmount).toFixed(2));
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        if (!Number.isFinite(totalAmount) || totalAmount < 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Invalid total amount' });
        }
        if (!Number.isFinite(amountReceived) || amountReceived < totalAmount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Insufficient cash received' });
        }
        if (req.user?.role !== 'admin' && staff !== req.user?.username) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Staff mismatch' });
        }
        const saleId = id || crypto.randomUUID();
        for (const item of items) {
            const prodRes = await client.query('SELECT stock FROM products WHERE id = $1 FOR UPDATE', [item.id]);
            if (prodRes.rows.length === 0) throw new Error(`Product ${item.id} not found`);
            if (prodRes.rows[0].stock < item.quantity) throw new Error(`Insufficient stock for ${item.name}`);
        }
        await client.query(
            'INSERT INTO sales (id, or_number, staff, total, amount_received, change_amount, items, status, receipt_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [saleId, orNumber, staff, totalAmount, amountReceived, changeAmount, JSON.stringify(items), 'completed', receiptType]
        );
        for (const item of items) {
            await client.query(
                'UPDATE products SET stock = stock - $1 WHERE id = $2',
                [item.quantity, item.id]
            );
        }
        await client.query('COMMIT');
        res.json({ success: true, id: saleId, amountReceived, changeAmount });
    } catch (err) {
        await client.query('ROLLBACK');
        handleError(res, err, 400);
    } finally {
        client.release();
    }
});

app.get('/api/sales', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sales ORDER BY timestamp DESC');
        res.json(result.rows);
    } catch (err) { handleError(res, err); }
});

  app.post('/api/sales/:id/void', requireAdmin, async (req, res) => {
    const { pin } = req.body;
    if (!pin) {
        return res.status(400).json({ message: 'Admin PIN is required to void a sale.' });
    }
    const pinOk = await verifyPinAndUpgrade(pin);
    if (!pinOk) {
        return res.status(403).json({ message: 'Invalid admin PIN.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const saleRes = await client.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE', [req.params.id]);
        if (saleRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Sale not found' });
        }
        const sale = saleRes.rows[0];
        if (sale.status === 'void') {
            await client.query('ROLLBACK');
            return res.json({ success: true, status: 'void' });
        }

        let items = sale.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch { items = []; }
        }
        if (!Array.isArray(items)) items = [];
        for (const item of items) {
            await client.query(
                'UPDATE products SET stock = stock + $1 WHERE id = $2',
                [item.quantity || 0, item.id]
            );
        }

        await client.query('UPDATE sales SET status = $1 WHERE id = $2', ['void', req.params.id]);

        const userRes = await client.query('SELECT first_name, last_name, username FROM users WHERE username = $1', [req.user?.username]);
        const userRow = userRes.rows[0];
        const fullName = userRow?.first_name || userRow?.last_name
            ? `${userRow?.first_name || ''} ${userRow?.last_name || ''}`.trim()
            : (userRow?.username || req.user?.username || 'admin');

        await client.query(
            'INSERT INTO activities (username, action, item) VALUES ($1, $2, $3)',
            [req.user?.username || 'admin', 'SALE VOIDED', `OR#${sale.or_number} by ${fullName}`]
        );

        await client.query('COMMIT');
        res.json({ success: true, status: 'void' });
    } catch (err) {
        await client.query('ROLLBACK');
        handleError(res, err, 400);
    } finally {
        client.release();
    }
  });

  // Exchange items in a sale (No-Refund policy, atomic transaction)
  app.post('/api/sales/:id/exchange', requireAdmin, async (req, res) => {
      const { id: saleId } = req.params;
      const { returnItemId, replacementItemId, pin, adminUser } = req.body || {};
      if (!pin) {
          return res.status(400).json({ message: 'Admin PIN is required to process exchange.' });
      }
      if (!returnItemId || !replacementItemId) {
          return res.status(400).json({ message: 'Return and replacement items are required.' });
      }

      const pinOk = await verifyPinAndUpgrade(pin);
      if (!pinOk) {
          return res.status(403).json({ message: 'Invalid admin PIN.' });
      }

      const client = await pool.connect();
      try {
          await client.query('BEGIN');

          const saleRes = await client.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE', [saleId]);
          if (saleRes.rows.length === 0) {
              throw new Error('Sale not found');
          }
          const sale = saleRes.rows[0];
          if (sale.status === 'void') {
              throw new Error('Cannot exchange items in a voided sale');
          }

          let items = sale.items;
          if (typeof items === 'string') {
              try { items = JSON.parse(items); } catch { items = []; }
          }
          if (!Array.isArray(items)) items = [];

          const oldItemIdx = items.findIndex(i => i.id === returnItemId);
          if (oldItemIdx === -1) {
              throw new Error('Item not found in this sale record');
          }
          const oldItem = items[oldItemIdx];
          const quantity = Number(oldItem?.quantity) || 1;

          const prodRes = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [replacementItemId]);
          if (prodRes.rows.length === 0) {
              throw new Error('Replacement product not found');
          }
          const newProd = prodRes.rows[0];

          if (Number(newProd.stock) < quantity) {
              throw new Error(`Replacement item ${newProd.name} is out of stock`);
          }

          const oldPrice = Number(oldItem?.price) || 0;
          const newPrice = Number(newProd.price) || 0;
          const priceDiff = (newPrice - oldPrice) * quantity;

          let newTotal = Number(sale.total);
          if (priceDiff > 0) {
              newTotal += priceDiff;
          }

        // Inventory updates
        // Add returned item back to shelf
        await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [quantity, returnItemId]);
        // Deduct new item from shelf
        await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [quantity, replacementItemId]);

        const updatedItems = [...items];
        updatedItems[oldItemIdx] = {
            ...newProd,
            price: newPrice, // Record the actual price of the new item
            quantity: quantity,
            isExchange: true // Flag for receipt
        };

        await client.query(
            'UPDATE sales SET items = $1, total = $2 WHERE id = $3',
            [JSON.stringify(updatedItems), newTotal, saleId]
        );

        // 7. Insert Audit Logs for Inventory Report
        // These strings are specific so the Daily Report can find them
        const logUser = req.user?.username || adminUser || 'System';
        await client.query(
            'INSERT INTO activities (username, action, item) VALUES ($1, $2, $3)',
            [logUser, 'EXCHANGE_RETURN', `ID:${returnItemId} | QTY:${quantity} | OR:${sale.or_number}`]
        );
        await client.query(
            'INSERT INTO activities (username, action, item) VALUES ($1, $2, $3)',
            [logUser, 'EXCHANGE_OUT', `ID:${replacementItemId} | QTY:${quantity} | OR:${sale.or_number}`]
        );

          await client.query(
              'UPDATE sales SET reissued = true, reissue_date = NOW(), reissue_admin = $1 WHERE id = $2',
              [logUser, saleId]
          );

          await client.query('COMMIT');
          res.json({
              success: true,
              newTotal,
              priceDiff,
              sale: {
                  ...sale,
                  items: updatedItems,
                  total: newTotal,
                  reissued: true,
                  reissueDate: new Date().toISOString(),
                  reissueAdmin: logUser
              }
          });
      } catch (err) {
          await client.query('ROLLBACK');
          handleError(res, err, 400);
      } finally {
          client.release();
      }
  });

// --- SETTINGS ---
app.get('/api/settings', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Missing auth token' });
    }
    try {
        const result = await pool.query('SELECT * FROM settings WHERE id = 1');
        const row = result.rows[0] || {};
        res.json({ ...row, admin_pin: null, has_admin_pin: !!row.admin_pin });
    } catch (err) { handleError(res, err); }
});

app.post('/api/settings', requireAdmin, async (req, res) => {
    const s = req.body;
    try {
        let adminPinValue = undefined;
        const currentRow = await pool.query('SELECT admin_pin FROM settings WHERE id = 1');
        const existingPin = currentRow.rows[0]?.admin_pin || null;
        if (typeof s.adminPin === 'string' && s.adminPin.trim() !== '') {
            if (!/^\d{4,6}$/.test(s.adminPin)) {
                return res.status(400).json({ message: 'Admin PIN must be 4-6 digits.' });
            }
            if (existingPin) {
                const currentProvided = typeof s.currentAdminPin === 'string' ? s.currentAdminPin : '';
                const ok = await verifyPin(currentProvided, existingPin);
                if (!ok) {
                    return res.status(403).json({ message: 'Current admin PIN is incorrect.' });
                }
            }
            adminPinValue = await hashPin(s.adminPin);
        } else {
            adminPinValue = existingPin;
        }
        await pool.query(
            `UPDATE settings SET 
             branch_name=$1, currency_symbol=$2, tax_rate=$3, low_stock_threshold=$4, time_format=$5, 
             receipt_auto_print=$6, profit_margin=$7, max_images_per_product=$8, staff_can_edit_price=$9, 
             admin_pin=$10, session_timeout_minutes=$11, branches=$12, backup_settings=$13, receipt_layout=$14
             WHERE id = 1`,
            [s.branchName, s.currencySymbol, s.taxRate, s.lowStockThreshold, s.timeFormat, s.receiptAutoPrint, s.profitMargin, s.maxImagesPerProduct, s.staffCanEditPrice, adminPinValue, s.sessionTimeoutMinutes, JSON.stringify(s.branches || []), JSON.stringify(s.backupSettings || {}), JSON.stringify(s.receiptLayout || {})]
        );
        res.json({ success: true });
    } catch (err) { handleError(res, err); }
});

// --- LOGS ---
app.get('/api/logs', async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin';
        const result = isAdmin
          ? await pool.query('SELECT * FROM activities ORDER BY timestamp DESC LIMIT 200')
          : await pool.query('SELECT * FROM activities WHERE username = $1 ORDER BY timestamp DESC LIMIT 200', [req.user?.username]);
        const mapped = result.rows.map(r => ({
            id: r.id.toString(),
            timestamp: r.timestamp.toLocaleString(),
            user: r.username,
            action: r.action,
            item: r.item
        }));
        res.json(mapped);
    } catch (err) { handleError(res, err); }
});

app.post('/api/logs', async (req, res) => {
    const { action, item } = req.body || {};
    const user = req.user?.username;
    if (!user) {
        return res.status(401).json({ message: 'Missing auth token' });
    }
    if (typeof action !== 'string' || action.trim() === '' || action.length > 120) {
        return res.status(400).json({ message: 'Invalid action' });
    }
    if (typeof item !== 'string' || item.trim() === '' || item.length > 500) {
        return res.status(400).json({ message: 'Invalid item' });
    }
    try {
        await pool.query(
            'INSERT INTO activities (username, action, item) VALUES ($1, $2, $3)',
            [user, action.trim(), item.trim()]
        );
        res.json({ success: true });
    } catch (err) { handleError(res, err); }
});

// --- REGISTRATION CODES ---
// Generate a new 6-digit one-time code
app.post('/api/codes/generate', requireAdmin, async (req, res) => {
    const adminUser = req.user?.username || 'admin';
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour limit

    try {
        let code = '';
        let inserted = false;
        for (let attempt = 0; attempt < 5; attempt += 1) {
            code = crypto.randomBytes(4).toString('hex').toUpperCase();
            try {
                await pool.query(
                    'INSERT INTO registration_codes (code, created_by, expires_at) VALUES ($1, $2, $3)',
                    [code, adminUser, expiresAt]
                );
                inserted = true;
                break;
            } catch (err) {
                if (err?.code !== '23505') {
                    throw err;
                }
            }
        }
        if (!inserted) {
            throw new Error('Unable to generate unique registration code');
        }
        
        // Log the code generation
        await pool.query(
            'INSERT INTO activities (username, action, item) VALUES ($1, $2, $3)',
            [adminUser, 'Generated Registry Code', `CODE:${code} | EXPIRES:${expiresAt.toISOString()} | 24 HOURS`]
        );
        
        res.json({ success: true, code });
    } catch (err) { handleError(res, err); }
});

// Get all code logs
app.get('/api/codes/logs', requireAdmin, async (req, res) => {
    try {
        // Auto-expire old codes on fetch
        await pool.query("UPDATE registration_codes SET status = 'EXPIRED' WHERE status = 'ACTIVE' AND expires_at < NOW()");
        
        const result = await pool.query('SELECT * FROM registration_codes ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) { handleError(res, err); }
});

const startServer = async () => {
  try {
    await runStartupSecurityMigrations();
  } catch (err) {
    console.error('FATAL: Startup security migration failed:', err.message || err);
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
    console.log(`Database: ${pool.options.database}`);
  });
};

startServer();
