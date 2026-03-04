# JewelAdmin Pro - Setup Guide

A comprehensive jewelry store admin dashboard with PostgreSQL backend, featuring inventory tracking, sales analytics, QR authentication, and staff management.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Installation Steps](#installation-steps)
3. [Database Setup](#database-setup)
4. [Configuration](#configuration)
5. [Running the Application](#running-the-application)
6. [Project Structure](#project-structure)
7. [Features](#features)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **PostgreSQL** (v14 or higher) - [Download](https://www.postgresql.org/download/)
- **npm** or **yarn** (comes with Node.js)

### System Requirements
- Windows 10/11, macOS, or Linux
- At least 4GB RAM
- At least 500MB disk space

---

## Installation Steps

### Step 1: Install PostgreSQL

1. Download PostgreSQL from https://www.postgresql.org/download/
2. Run the installer
3. **Important**: Note down your password for the `postgres` user
4. Keep the default port: `5432`
5. Complete the installation

### Step 2: Create the Database

1. Open **pgAdmin** or **psql** (Command Line)
2. Run the following command to create the database:

```sql
CREATE DATABASE jewelry_db;
```

Or via command line:
```bash
createdb -U postgres jewelry_db
```

### Step 3: Clone/Transfer the Project

1. Copy the entire `jeweladmin-pro` folder to the new laptop
2. Open a terminal in the project directory:
```bash
cd jeweladmin-pro
```

### Step 4: Install Dependencies

```bash
npm install
```

This will install all required packages including:
- React & ReactDOM
- Express.js
- PostgreSQL client
- Vite (build tool)
- Tailwind CSS
- QR Code libraries

---

## Database Setup

### Method 1: Using the Init Script (Recommended)

Run the database initialization script:

```bash
npm run db:init
```

Or manually:
```bash
node -e "import './scripts/init-db.js'"
```

This will:
- Create all required tables
- Add missing columns for existing databases
- Create performance indexes
- Seed the default admin user
- Set default settings

### Method 2: Manual Import

1. Open pgAdmin or psql
2. Connect to `jewelry_db`
3. Open `schema.sql` file
4. Execute all statements

### Default Admin Credentials

After initialization, login with:
- **Username**: `admin`
- **Password**: `admin`
- **Admin PIN**: `0000`

---

## Configuration

### Database Connection

Edit the database connection in `backend/server.js`:

```javascript
const pool = new Pool({
  user: 'postgres',          // Your PostgreSQL username
  host: 'localhost',         // Database host
  database: 'jewelry_db',    // Database name
  password: 'your_password', // Your PostgreSQL password
  port: 5432,                // PostgreSQL port
});
```

### Environment Variables (Optional)

Create a `.env` file in the project root:

```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=jewelry_db
DB_PASSWORD=your_password
DB_PORT=5432
SERVER_PORT=3001
```

### Application Settings

Default settings are seeded automatically. To change:
1. Login as admin
2. Go to **Settings** tab
3. Modify as needed and click **Apply Changes**

Key settings:
- **Admin PIN**: Required for sensitive operations (default: `0000`)
- **Currency**: Philippine Peso (₱)
- **Tax Rate**: 0% (configurable)
- **Session Timeout**: 60 minutes

---

## Running the Application

### Development Mode

1. Start the backend server:
```bash
npm run backend
```
This runs `node backend/server.js` on port 3001

2. Open a new terminal and start the frontend:
```bash
npm start
```
This runs Vite dev server (usually http://localhost:5173)

### Production Build

1. Build the frontend:
```bash
npm run build
```

2. Serve the build (optional, for production deployment)

### Using Batch Files (Windows)

Quick launch scripts are included in `server-start-stop/`:
- `Start_SERVER.bat` - Starts both backend and frontend
- `Stop_SERVER.bat` - Stops all servers

---

## Project Structure

```
jeweladmin-pro/
├── backend/
│   ├── schema.sql          # Database schema
│   └── server.js           # Express backend API
├── components/
│   ├── DashboardView.tsx   # Main dashboard
│   ├── InventoryView.tsx  # Product catalog
│   ├── POSView.tsx         # Point of sale
│   ├── SettingsView.tsx    # System settings
│   ├── Reports/            # Sales & analytics reports
│   └── ... (other views)
├── scripts/
│   └── init-db.js          # Database initialization
├── server-start-stop/
│   ├── Start_SERVER.bat    # Windows launch script
│   └── Stop_SERVER.bat     # Windows stop script
├── schema.sql              # Root database schema
├── package.json            # Dependencies
├── vite.config.ts          # Vite configuration
└── README.md              # This file
```

---

## Features

### Core Features
- 📦 **Inventory Management** - Add, edit, delete products with images
- 💰 **Point of Sale** - Quick sales processing with receipt generation
- 📊 **Sales Reports** - Daily, weekly, monthly analytics
- 👥 **Staff Management** - Add staff with role-based access
- 🔐 **QR Authentication** - Staff can login with QR badges
- 🔔 **Low Stock Alerts** - Configurable threshold notifications

### Security Features
- Master Admin PIN for sensitive operations
- Role-based access (admin vs staff)
- Session timeout (configurable)
- Password change with PIN override
- Activity logging

### Additional Features
- Multi-branch support
- Customizable text sizes
- Export/import data
- Dark/light theme ready

---

## Troubleshooting

### Issue: "Connection refused" / Database not connecting

**Problem**: PostgreSQL is not running or credentials are wrong

**Solutions**:
1. Start PostgreSQL service:
   - Windows: Open Services app → Find PostgreSQL → Start
   - Or: `pg_ctl start -D "C:\Program Files\PostgreSQL\14\data"`

2. Verify credentials in `backend/server.js`:
```javascript
password: 'princes2006',  // Your actual password
```

3. Test connection:
```bash
psql -U postgres -d jewelry_db
```

### Issue: "Module not found" / Import errors

**Problem**: Dependencies not installed

**Solution**:
```bash
npm install
```

### Issue: Port already in use

**Problem**: Port 3001 or 5173 is busy

**Solution**:
- Change port in `backend/server.js`: `const port = 3002;`
- Or stop the conflicting application

### Issue: Tables don't exist

**Problem**: Database not initialized

**Solution**:
```bash
npm run db:init
```

### Issue: Admin login not working

**Problem**: Wrong credentials or user not seeded

**Solution**:
1. Check if admin user exists:
```sql
SELECT * FROM users WHERE username = 'admin';
```

2. If not, run schema.sql manually or reinitialize database

### Issue: Images not loading

**Problem**: Base64 images too large or CORS issue

**Solutions**:
- Image size limit: 5MB max per image
- Ensure CORS is enabled in backend
- Clear browser cache

### Issue: Changes not reflecting

**Problem**: Vite hot reload not working

**Solutions**:
1. Stop and restart `npm start`
2. Clear browser cache (Ctrl+F5)
3. Check browser console for errors

### Issue: QR Code not scanning

**Problem**: Camera permission or QR format

**Solutions**:
1. Allow camera permission in browser
2. Ensure adequate lighting
3. QR code should be printed or displayed clearly

---

## Database Schema Overview

### Tables

| Table | Purpose |
|-------|---------|
| `users` | Staff accounts and admin |
| `products` | Inventory items |
| `sales` | Transaction records |
| `activities` | Audit log |
| `settings` | System configuration |
| `qr_tokens` | QR login tokens |
| `registration_codes` | Staff signup codes |

### Key Columns

**users**:
- `username` - Unique login ID
- `first_name`, `last_name` - Display names
- `role` - 'admin' or 'staff'
- `status` - 'active', 'disabled', or 'deleted'
- `profile_picture` - Base64 image

**products**:
- `id` - Unique SKU
- `name` - Product name
- `price` - Selling price
- `stock` - Quantity on hand
- `material`, `material_grade` - Jewelry details
- `main_image` - Primary image (base64)
- `thumbnails` - Additional images array

**sales**:
- `or_number` - Official Receipt number
- `staff` - Cashier username
- `items` - JSON array of purchased products
- `total` - Sale total

---

## Support

For issues not covered here:
1. Check browser console (F12) for error messages
2. Check terminal output for backend errors
3. Verify PostgreSQL logs

---

## License

This project is custom-built for jewelry store management. All rights reserved.

---

**Last Updated**: February 2024
**Version**: 1.0.0
