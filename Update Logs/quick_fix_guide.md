# Quick Fix Guide - Critical Security Vulnerabilities

## 🚨 STOP - DO NOT DEPLOY TO PRODUCTION

This guide provides immediate fixes for the most critical vulnerabilities. Implement these before any production deployment.

---

## 1. SQL Injection - IMMEDIATE FIX REQUIRED

### ❌ VULNERABLE CODE (Lines 157-166 in backend/server.js)
```javascript
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await pool.query(
    `SELECT * FROM users WHERE username = '${username}' AND status = 'active'`
  );
});
```

### ✅ SECURE CODE
```javascript
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Input validation
  if (!username || !password) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  
  // Use parameterized query ($1, $2 placeholders)
  const result = await pool.query(
    'SELECT * FROM users WHERE username = $1 AND status = $2',
    [username, 'active']  // Parameters passed separately
  );
});
```

**Apply this fix to ALL database queries in:**
- `/api/login` (line 157)
- `/api/users` (line 187)
- `/api/products` (lines 268, 301)
- `/api/sales` (line 341)
- `/api/activities` (line 364)

---

## 2. Password Hashing - IMMEDIATE FIX REQUIRED

### ❌ VULNERABLE CODE (db.ts line 30)
```javascript
function hashPassword(password: string, salt: string): string {
  return CryptoJS.MD5(password + salt).toString();  // MD5 is broken!
}
```

### ✅ SECURE CODE
```bash
# Install bcrypt first
npm install bcrypt @types/bcrypt
```

```typescript
import bcrypt from 'bcrypt';

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;  // Industry standard
  return await bcrypt.hash(password, saltRounds);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// Update login method
async login(username: string, password: string): Promise<User | null> {
  const user = await this.getUsers().then(users => 
    users.find(u => u.username === username && u.status === 'active')
  );
  
  if (!user || !user.passwordHash) return null;
  
  // Use bcrypt instead of MD5
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) return null;
  
  return user;
}
```

**IMPORTANT**: Existing passwords need to be reset or migrated!

---

## 3. Hardcoded Credentials - IMMEDIATE FIX REQUIRED

### ❌ VULNERABLE CODE (backend/server.js lines 6-12)
```javascript
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'jewelrydb',
  password: 'admin',  // NEVER hardcode passwords!
  port: 5432,
});
```

### ✅ SECURE CODE

**Step 1**: Install dotenv
```bash
npm install dotenv
```

**Step 2**: Create `.env` file (add to .gitignore!)
```env
DB_USER=jewelry_app
DB_PASSWORD=YourStrongPasswordHere123!@#
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jewelrydb
JWT_SECRET=your-jwt-secret-min-32-chars-random
NODE_ENV=production
```

**Step 3**: Update backend/server.js
```javascript
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Validate required env vars
if (!process.env.DB_PASSWORD) {
  console.error('FATAL: DB_PASSWORD must be set');
  process.exit(1);
}
```

**Step 4**: Update `.gitignore`
```
.env
.env.local
.env.production
```

---

## 4. Missing Authentication - IMMEDIATE FIX REQUIRED

### ❌ VULNERABLE CODE
```javascript
app.get('/api/products', async (req, res) => {
  // No authentication check - anyone can access!
  const result = await pool.query('SELECT * FROM products ORDER BY name');
  res.json(result.rows);
});
```

### ✅ SECURE CODE

**Step 1**: Install JWT
```bash
npm install jsonwebtoken
```

**Step 2**: Create authentication middleware
```javascript
const jwt = require('jsonwebtoken');

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
```

**Step 3**: Protect all endpoints
```javascript
// Public endpoint - no auth needed
app.post('/api/login', async (req, res) => { /* ... */ });

// Require authentication
app.get('/api/products', authenticateJWT, async (req, res) => { /* ... */ });
app.get('/api/sales', authenticateJWT, async (req, res) => { /* ... */ });

// Require admin role
app.post('/api/products', authenticateJWT, requireAdmin, async (req, res) => { /* ... */ });
app.delete('/api/products/:id', authenticateJWT, requireAdmin, async (req, res) => { /* ... */ });
app.get('/api/users', authenticateJWT, requireAdmin, async (req, res) => { /* ... */ });
app.delete('/api/users/:username', authenticateJWT, requireAdmin, async (req, res) => { /* ... */ });
```

**Step 4**: Update login to return JWT
```javascript
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  const result = await pool.query(
    'SELECT * FROM users WHERE username = $1 AND status = $2',
    [username, 'active']
  );
  
  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const user = result.rows[0];
  const isValid = await bcrypt.compare(password, user.password_hash);
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Generate JWT token
  const token = jwt.sign(
    { 
      username: user.username, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
  
  res.json({ 
    token, 
    user: { 
      username: user.username, 
      role: user.role 
    } 
  });
});
```

---

## 5. Command Injection - IMMEDIATE FIX REQUIRED

### ❌ VULNERABLE CODE (scripts/backup-db.js)
```javascript
const command = `pg_dump -U ${dbConfig.user} ... > "${fullPath}"`;
exec(command, { env: { PGPASSWORD: dbConfig.password } });
```

### ✅ SECURE CODE
```javascript
const { spawn } = require('child_process');
const path = require('path');

async function createBackup() {
  const backupPath = 'D:\\Backups';  // Hardcode allowed paths
  const sanitizedPath = path.resolve(backupPath);
  
  // Whitelist validation
  const allowedPaths = ['D:\\Backups', 'C:\\Backups'];
  if (!allowedPaths.some(allowed => sanitizedPath.startsWith(allowed))) {
    throw new Error('Invalid backup path');
  }
  
  const filename = `backup-${Date.now()}.sql`;
  const fullPath = path.join(sanitizedPath, filename);
  
  // Use spawn instead of exec - prevents injection
  const pgDump = spawn('pg_dump', [
    '-U', dbConfig.user,
    '-h', dbConfig.host,
    '-p', dbConfig.port.toString(),
    dbConfig.database,
    '-f', fullPath
  ], {
    env: { PGPASSWORD: dbConfig.password }
  });
  
  return new Promise((resolve, reject) => {
    pgDump.on('close', (code) => {
      if (code === 0) resolve(fullPath);
      else reject(new Error(`Backup failed with code ${code}`));
    });
  });
}
```

---

## 6. Rate Limiting - HIGH PRIORITY

### ✅ SECURE CODE
```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

// Login rate limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, try again later',
  standardHeaders: true,
  legacyHeaders: false
});

app.post('/api/login', loginLimiter, async (req, res) => {
  // ... login logic
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests'
});

app.use('/api/', apiLimiter);
```

---

## 7. Security Headers

### ✅ SECURE CODE
```bash
npm install helmet
```

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));
```

---

## 8. Input Validation

### ✅ SECURE CODE
```bash
npm install validator
```

```javascript
const validator = require('validator');

// Validation middleware
const validateInput = (schema) => {
  return (req, res, next) => {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];
      
      if (rules.required && !value) {
        errors.push(`${field} is required`);
      }
      
      if (value && rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${field} too long`);
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }
    next();
  };
};

// Usage
app.post('/api/users',
  validateInput({
    username: { required: true, maxLength: 50 },
    password: { required: true, maxLength: 100 },
    firstName: { required: true, maxLength: 100 }
  }),
  async (req, res) => {
    // ... handler
  }
);
```

---

## 9. File Upload Security

### ✅ SECURE CODE
```javascript
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

const handleImageUpload = async (file) => {
  // Validate type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Invalid file type');
  }
  
  // Validate size
  if (file.size > MAX_SIZE) {
    throw new Error('File too large');
  }
  
  // Validate extension
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
    throw new Error('Invalid extension');
  }
  
  // Verify it's actually an image
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
  
  // Read as base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
```

---

## Implementation Checklist

### Critical (Do First - Week 1)
- [ ] Fix all SQL injection vulnerabilities (use parameterized queries)
- [ ] Replace MD5 with bcrypt for password hashing
- [ ] Move database credentials to environment variables
- [ ] Implement JWT authentication middleware
- [ ] Protect all API endpoints with authentication
- [ ] Fix command injection in backup scripts
- [ ] Remove hardcoded admin PIN, force reset

### High Priority (Week 2)
- [ ] Add rate limiting to all endpoints
- [ ] Implement RBAC (role-based access control)
- [ ] Add input validation middleware
- [ ] Secure file upload handling
- [ ] Fix IDOR vulnerabilities
- [ ] Add security headers (Helmet.js)

### Medium Priority (Week 3-4)
- [ ] Implement proper session management
- [ ] Add CSRF protection
- [ ] Implement security logging and monitoring
- [ ] Add XSS protection (sanitize inputs)
- [ ] Create incident response plan
- [ ] Set up automated security scanning

### Testing
- [ ] Test all authentication flows
- [ ] Attempt SQL injection on all inputs
- [ ] Test rate limiting
- [ ] Verify file upload restrictions
- [ ] Test session timeout
- [ ] Penetration testing

---

## Required Package Installations

```bash
# Critical security packages
npm install bcrypt dotenv jsonwebtoken express-rate-limit helmet validator

# Optional but recommended
npm install express-session connect-redis redis
```

---

## Environment Variables Template

Create `.env` file:
```env
# Database
DB_USER=jewelry_app
DB_PASSWORD=<generate-strong-password>
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jewelrydb

# Security
JWT_SECRET=<generate-32-char-random-string>
SESSION_SECRET=<generate-32-char-random-string>
NODE_ENV=production

# Optional
REDIS_HOST=localhost
REDIS_PORT=6379
```

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Quick Security Test Commands

### Test SQL Injection
```bash
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin'\'' OR '\''1'\''='\''1", "password":"test"}'
```
**Expected**: Should return "Invalid credentials" (not bypass auth)

### Test Missing Authentication
```bash
curl http://localhost:3001/api/products
```
**Expected**: Should return 401 Unauthorized

### Test Rate Limiting
```bash
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}'
done
```
**Expected**: Should get rate limited after 5 attempts

---

## Emergency Response

If you suspect a breach:

1. **Immediately**:
   - Take application offline
   - Rotate all credentials (database, JWT secrets)
   - Review access logs
   - Notify affected users

2. **Investigate**:
   - Check database for unauthorized access
   - Review application logs
   - Check for data exfiltration
   - Identify attack vector

3. **Remediate**:
   - Fix vulnerability
   - Update all passwords
   - Implement fixes from this guide
   - Add monitoring/alerting

4. **Prevent**:
   - Security training
   - Code review process
   - Automated security scanning
   - Regular penetration testing

---

**Remember**: Security is not a one-time fix. Implement continuous security practices!
