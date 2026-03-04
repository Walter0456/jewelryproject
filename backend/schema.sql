
-- Optimized Schema for JewelAdmin Pro

-- Ensure existing products table has deleted_at column
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='deleted_at') THEN
        ALTER TABLE products ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
    END IF;
END $$;

-- Ensure users table has deleted_at column for soft-delete
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='deleted_at') THEN
        ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
    END IF;
END $$;

-- Ensure users table has original_name column (saved before deletion)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='original_name') THEN
        ALTER TABLE users ADD COLUMN original_name VARCHAR(200);
    END IF;
END $$;

-- Create Users Table
CREATE TABLE IF NOT EXISTS users (
    username VARCHAR(50) PRIMARY KEY,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'staff',
    status VARCHAR(20) DEFAULT 'active',
    profile_picture TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Products Table
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    stock INTEGER DEFAULT 0,
    price DECIMAL(12, 2) NOT NULL,
    weight_grams DECIMAL(10, 2),
    specs TEXT,
    detailed_description TEXT,
    material VARCHAR(100),
    material_grade VARCHAR(100),
    main_image TEXT,
    thumbnails TEXT[],
    category VARCHAR(100),
    collection VARCHAR(100),
    deleted_at TIMESTAMP DEFAULT NULL
);

-- Create Inventory Snapshots Table
CREATE TABLE IF NOT EXISTS inventory_snapshots (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(50) REFERENCES products(id),
    closing_stock INTEGER NOT NULL,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_snapshots_product_date
ON inventory_snapshots(product_id, snapshot_date);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);

-- Create Sales Table
CREATE TABLE IF NOT EXISTS sales (
    id VARCHAR(50) PRIMARY KEY,
    or_number VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    staff VARCHAR(50) REFERENCES users(username),
    total DECIMAL(12, 2) NOT NULL,
    amount_received DECIMAL(12, 2),
    change_amount DECIMAL(12, 2) DEFAULT 0,
    items JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'completed',
    reissued BOOLEAN DEFAULT FALSE,
    reissue_date TIMESTAMP DEFAULT NULL,
    reissue_admin VARCHAR(50),
    receipt_type VARCHAR(2) DEFAULT 'OR'
);

CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp DESC);

-- OR Number Sequence (prevents concurrency collisions)
CREATE SEQUENCE IF NOT EXISTS or_number_seq;
SELECT setval('or_number_seq', COALESCE((SELECT MAX(CAST(or_number AS INTEGER)) FROM sales WHERE or_number ~ '^[0-9]+$'), 0));

-- Create Activities/Logs Table
CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    username VARCHAR(50),
    action TEXT,
    item TEXT
);

CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC);

-- Create Settings Table
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    branch_name VARCHAR(255),
    currency_symbol VARCHAR(10),
    tax_rate DECIMAL(5, 2),
    low_stock_threshold INTEGER,
    time_format VARCHAR(10),
    receipt_auto_print BOOLEAN,
    profit_margin DECIMAL(5, 2),
    max_images_per_product INTEGER,
    staff_can_edit_price BOOLEAN,
    admin_pin TEXT,
    session_timeout_minutes INTEGER,
    branches JSONB DEFAULT '[]'::jsonb,
    backup_settings JSONB DEFAULT '{}'::jsonb,
    receipt_layout JSONB DEFAULT '{}'::jsonb
);

-- Create QR Tokens Table
CREATE TABLE IF NOT EXISTS qr_tokens (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Create Registration Codes Table
CREATE TABLE IF NOT EXISTS registration_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    created_by VARCHAR(50) REFERENCES users(username),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, USED, EXPIRED
    used_by_name TEXT, -- Full name of the person who used it
    used_by_username VARCHAR(50) -- Username created with this code
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_codes_status ON registration_codes(status);

-- Admin account is created securely by backend startup migration using
-- PBKDF2 and a cryptographically random temporary password.

-- Seed Default Settings
INSERT INTO settings (id, branch_name, currency_symbol, tax_rate, low_stock_threshold, time_format, receipt_auto_print, profit_margin, max_images_per_product, staff_can_edit_price, admin_pin, session_timeout_minutes)
VALUES (1, 'Rodriguez Rizal', '₱', 0, 3, '12h', false, 35, 5, false, NULL, 30)
ON CONFLICT (id) DO NOTHING;
