const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

let dbPath = path.resolve(__dirname, '../database.sqlite');

// In serverless environments (Vercel / AWS Lambda), the root deployment filesystem is read-only.
// We copy the database to /tmp if not already present so SQLite can read, write, and manage locks safely.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
if (isServerless) {
  const tmpDbPath = path.join('/tmp', 'database.sqlite');
  try {
    const candidatePaths = [
      dbPath,
      path.join(process.cwd(), 'database.sqlite'),
      path.resolve(__dirname, 'database.sqlite'),
      path.resolve(__dirname, '../../database.sqlite'),
      path.join(process.cwd(), 'public', 'database.sqlite')
    ];
    const sourceDb = candidatePaths.find(p => fs.existsSync(p));
    if (sourceDb) {
      let needsCopy = !fs.existsSync(tmpDbPath);
      if (!needsCopy) {
        try {
          const srcStat = fs.statSync(sourceDb);
          const dstStat = fs.statSync(tmpDbPath);
          if (srcStat.mtimeMs > dstStat.mtimeMs || srcStat.size !== dstStat.size) {
            needsCopy = true;
          }
        } catch (e) {
          needsCopy = true;
        }
      }
      if (needsCopy) {
        fs.copyFileSync(sourceDb, tmpDbPath);
        console.log(`Serverless DB synchronized in /tmp from: ${sourceDb}`);
      }
    } else {
      console.warn('Serverless DB: source database.sqlite not found in bundle, initializing in /tmp');
    }
    dbPath = tmpDbPath;
  } catch (err) {
    console.error('Serverless DB path initialization error:', err.message);
  }
}

const db = new DatabaseSync(dbPath);

// Enable foreign keys and WAL mode for high reliability and concurrency
db.exec('PRAGMA foreign_keys = ON;');
try {
  db.exec('PRAGMA journal_mode = WAL;');
} catch (e) {
  // If WAL is restricted (e.g. read-only or unsupported storage), fallback to standard DELETE journal
  try {
    db.exec('PRAGMA journal_mode = DELETE;');
  } catch (err) {}
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'customer',
      google_id TEXT,
      avatar TEXT,
      phone TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT,
      locality TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT NOT NULL,
      landmark TEXT,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT,
      category TEXT NOT NULL,
      type TEXT,
      price INTEGER NOT NULL,
      compare_price INTEGER,
      gsm TEXT,
      fabric TEXT,
      fit TEXT,
      description TEXT,
      care TEXT,
      images TEXT NOT NULL, -- JSON array
      badges TEXT, -- JSON array
      specs TEXT, -- JSON array
      colors TEXT NOT NULL, -- JSON array of {name, hex, code}
      is_new_drop INTEGER DEFAULT 0,
      is_bestseller INTEGER DEFAULT 0,
      status TEXT DEFAULT 'published',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      size TEXT NOT NULL,
      color_code TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id, size, color_code)
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      variant_size TEXT NOT NULL,
      variant_color TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id, variant_size, variant_color),
      UNIQUE(session_id, product_id, variant_size, variant_color)
    );

    CREATE TABLE IF NOT EXISTS wishlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      customer_email TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      shipping_address TEXT NOT NULL, -- JSON snapshot
      subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL DEFAULT 0,
      coupon_code TEXT,
      shipping_charge INTEGER NOT NULL DEFAULT 0,
      tax_amount INTEGER NOT NULL DEFAULT 0,
      total_amount INTEGER NOT NULL,
      payment_method TEXT NOT NULL, -- 'razorpay' | 'cod'
      payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'failed' | 'refunded'
      fulfillment_status TEXT NOT NULL DEFAULT 'confirmed', -- 'pending' | 'confirmed' | 'packing' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled'
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      tracking_number TEXT,
      carrier TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      product_title TEXT NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      image_url TEXT,
      sku TEXT
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL COLLATE NOCASE,
      discount_type TEXT NOT NULL, -- 'percent' | 'fixed'
      discount_value INTEGER NOT NULL,
      min_order_value INTEGER DEFAULT 0,
      max_discount INTEGER,
      usage_limit INTEGER,
      times_used INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      title TEXT,
      comment TEXT NOT NULL,
      verified_purchase INTEGER DEFAULT 0,
      is_approved INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      image_url TEXT,
      display_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      admin_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      product_title TEXT,
      size TEXT NOT NULL,
      email TEXT NOT NULL,
      status TEXT DEFAULT 'pending', -- 'pending' | 'notified'
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Indices for quick querying
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
    CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_cart_session ON cart_items(session_id);
    CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
    CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
    CREATE INDEX IF NOT EXISTS idx_activity_admin ON activity_logs(admin_id);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_stock_alerts ON stock_alerts(product_id, size);
  `);

  // Seed default streetwear categories if empty
  try {
    const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
    if (catCount.count === 0) {
      const insertCat = db.prepare(`
        INSERT INTO categories (name, slug, description, display_order, is_active)
        VALUES (?, ?, ?, ?, 1)
      `);
      insertCat.run('Tops', 'tops', 'Heavyweight tees, luxury hoodies, and architectural longsleeves', 1);
      insertCat.run('Bottoms', 'bottoms', 'Tactical cargo pants, heavy terry sweatpants, and nylon trackpants', 2);
      insertCat.run('Outerwear', 'outerwear', 'Tactical vests, weathered denim jackets, and winter outerwear', 3);
      insertCat.run('Accessories', 'accessories', 'Utility rig bags, crossbody carry gear, and minimalist essentials', 4);
    }
  } catch (e) {
    console.warn('Categories init notice:', e.message);
  }

  // Ensure an Owner account exists (auto-provision initial owner if database is freshly initialized)
  try {
    const ownerCheck = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'owner'").get();
    if (ownerCheck.count === 0) {
      const adminExists = db.prepare("SELECT id FROM users WHERE email = 'admin@590labs.com'").get();
      if (adminExists) {
        db.prepare("UPDATE users SET role = 'owner' WHERE email = 'admin@590labs.com'").run();
      } else {
        const bcrypt = require('bcryptjs');
        const adminPasswordHash = bcrypt.hashSync('Admin@590Labs2026', 10);
        db.prepare(`
          INSERT INTO users (name, email, password_hash, role, phone)
          VALUES (?, ?, ?, 'owner', ?)
        `).run('590 Labs Superadmin', 'admin@590labs.com', adminPasswordHash, '+91 98765 43210');
      }
    }
  } catch (e) {
    console.warn('Owner provisioning notice:', e.message);
  }
}


initDatabase();

/**
 * Log administrative operations for compliance, auditability and tamper protection
 */
function logActivity(adminUser, action, entityType, entityId = null, details = null) {
  try {
    const adminId = adminUser ? adminUser.id : null;
    const adminName = adminUser ? (adminUser.name || adminUser.email || 'Admin') : 'System';
    const detailString = typeof details === 'object' ? JSON.stringify(details) : (details ? String(details) : null);

    db.prepare(`
      INSERT INTO activity_logs (admin_id, admin_name, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(adminId, adminName, action, entityType, entityId ? String(entityId) : null, detailString);
  } catch (err) {
    console.error('Failed to record activity log:', err.message);
  }
}

db.logActivity = logActivity;

module.exports = db;

