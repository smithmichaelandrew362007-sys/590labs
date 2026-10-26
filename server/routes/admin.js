const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAdmin, requireOwner } = require('../middleware/auth');

/**
 * ============================================================================
 * UNGUARDED / PUBLIC SETUP ENDPOINT (LOCKED ONCE OWNER IS ESTABLISHED)
 * ============================================================================
 * POST /api/admin/setup-owner
 * Allows creating the initial store owner account ONLY if no owner exists.
 * Permanently locks once an owner account has been established.
 */
router.post('/setup-owner', (req, res) => {
  try {
    const ownerCheck = db.prepare("SELECT id, email FROM users WHERE role = 'owner'").get();
    if (ownerCheck) {
      return res.status(403).json({
        success: false,
        error: 'Initial owner setup is permanently locked. An owner account already exists.'
      });
    }

    const { email, password, name = 'Store Owner', phone } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Administrator password must be at least 8 characters long.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);

    let ownerId;
    if (existing) {
      db.prepare('UPDATE users SET role = ?, password_hash = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('owner', passwordHash, name.trim(), existing.id);
      ownerId = existing.id;
    } else {
      const stmt = db.prepare(`
        INSERT INTO users (name, email, password_hash, role, phone)
        VALUES (?, ?, ?, 'owner', ?)
      `);
      const info = stmt.run(name.trim(), cleanEmail, passwordHash, phone ? phone.trim() : null);
      ownerId = Number(info.lastInsertRowid);
    }

    if (db.logActivity) {
      db.logActivity({ id: ownerId, name: name.trim(), email: cleanEmail }, 'OWNER_INITIALIZED', 'user', ownerId, {
        method: 'API_SETUP',
        email: cleanEmail
      });
    }

    res.status(201).json({
      success: true,
      message: 'Store Owner account established successfully. Setup is now permanently locked.',
      owner: { id: ownerId, email: cleanEmail, name: name.trim(), role: 'owner' }
    });
  } catch (err) {
    console.error('Owner setup error:', err);
    res.status(500).json({ success: false, error: 'Could not complete owner setup.' });
  }
});

// ============================================================================
// ALL SUBSEQUENT ROUTES ARE STRICTLY GUARDED BY requireAdmin
// ============================================================================
router.use(requireAdmin);

/**
 * ============================================================================
 * 1. OVERVIEW & METRICS
 * ============================================================================
 * GET /api/admin/stats
 */
router.get('/stats', (req, res) => {
  try {
    // 1. Total revenue from verified paid orders
    const revenueRow = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as totalRevenue
      FROM orders
      WHERE payment_status = 'paid'
    `).get();

    // 2. Orders awaiting fulfillment
    const pendingFulfillmentRow = db.prepare(`
      SELECT COUNT(*) as pendingCount
      FROM orders
      WHERE fulfillment_status IN ('confirmed', 'packing')
    `).get();

    // 3. Total orders
    const totalOrdersRow = db.prepare('SELECT COUNT(*) as totalOrders FROM orders').get();

    // 4. Total registered customers
    const totalCustomersRow = db.prepare("SELECT COUNT(*) as totalCustomers FROM users WHERE role = 'customer'").get();

    // 5. Total published products
    const publishedCountRow = db.prepare("SELECT COUNT(*) as count FROM products WHERE status = 'published'").get();

    // 6. Total draft products
    const draftCountRow = db.prepare("SELECT COUNT(*) as count FROM products WHERE status = 'draft'").get();

    // 7. Low stock alerts (stock <= 3)
    const lowStockVariants = db.prepare(`
      SELECT v.id, v.product_id, p.title as product_title, v.size, v.color_code, v.sku, v.stock_quantity
      FROM product_variants v
      JOIN products p ON v.product_id = p.id
      WHERE v.stock_quantity <= 3 AND p.status = 'published'
      ORDER BY v.stock_quantity ASC
      LIMIT 15
    `).all();

    // 8. Recent 8 orders
    const recentOrders = db.prepare(`
      SELECT id, customer_name, customer_email, total_amount, payment_method,
        payment_status, fulfillment_status, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 8
    `).all();

    // 9. Recent 6 activity log entries
    const recentActivity = db.prepare(`
      SELECT id, admin_name, action, entity_type, entity_id, details, created_at
      FROM activity_logs
      ORDER BY created_at DESC
      LIMIT 6
    `).all();

    res.json({
      success: true,
      stats: {
        totalRevenue: revenueRow.totalRevenue,
        totalOrders: totalOrdersRow.totalOrders,
        pendingFulfillment: pendingFulfillmentRow.pendingCount,
        totalCustomers: totalCustomersRow.totalCustomers,
        publishedProducts: publishedCountRow.count,
        draftProducts: draftCountRow.count,
        lowStockCount: lowStockVariants.length,
        lowStockVariants,
        recentOrders,
        recentActivity
      }
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ success: false, error: 'Could not calculate store metrics.' });
  }
});

/**
 * ============================================================================
 * 2. PRODUCT MANAGEMENT & CRUD
 * ============================================================================
 * GET /api/admin/products
 */
router.get('/products', (req, res) => {
  try {
    const { status, category, search } = req.query;

    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (category && category !== 'all') {
      query += ' AND LOWER(category) = LOWER(?)';
      params.push(category);
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ' AND (LOWER(title) LIKE ? OR LOWER(id) LIKE ? OR LOWER(description) LIKE ?)';
      params.push(term, term, term);
    }

    query += ' ORDER BY created_at DESC';

    const products = db.prepare(query).all(...params);
    const variantStmt = db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY size');

    const formatted = products.map(p => {
      let images = [];
      let colors = [];
      let badges = [];
      let specs = [];
      try { images = JSON.parse(p.images || '[]'); } catch (e) {}
      try { colors = JSON.parse(p.colors || '[]'); } catch (e) {}
      try { badges = JSON.parse(p.badges || '[]'); } catch (e) {}
      try { specs = JSON.parse(p.specs || '[]'); } catch (e) {}

      const variants = variantStmt.all(p.id);
      const totalStock = variants.reduce((sum, v) => sum + v.stock_quantity, 0);

      return {
        ...p,
        images,
        colors,
        badges,
        specs,
        variants,
        totalStock,
        isNewDrop: Boolean(p.is_new_drop),
        isBestseller: Boolean(p.is_bestseller)
      };
    });

    res.json({ success: true, count: formatted.length, products: formatted });
  } catch (err) {
    console.error('Admin products error:', err);
    res.status(500).json({ success: false, error: 'Could not load products catalog.' });
  }
});

/**
 * GET /api/admin/products/:id
 */
router.get('/products/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found.' });
    }

    const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY size').all(product.id);
    let images = [];
    let colors = [];
    let badges = [];
    let specs = [];
    try { images = JSON.parse(product.images || '[]'); } catch (e) {}
    try { colors = JSON.parse(product.colors || '[]'); } catch (e) {}
    try { badges = JSON.parse(product.badges || '[]'); } catch (e) {}
    try { specs = JSON.parse(product.specs || '[]'); } catch (e) {}

    const totalStock = variants.reduce((sum, v) => sum + v.stock_quantity, 0);

    res.json({
      success: true,
      product: {
        ...product,
        images,
        colors,
        badges,
        specs,
        variants,
        totalStock,
        isNewDrop: Boolean(product.is_new_drop),
        isBestseller: Boolean(product.is_bestseller)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not load product details.' });
  }
});

/**
 * POST /api/admin/products
 */
router.post('/products', (req, res) => {
  try {
    const {
      id, title, subtitle, category, type, price, comparePrice,
      gsm, fabric, fit, description, care, images, colors, sizes,
      stockQuantity = 10, status = 'published', isNewDrop = false, isBestseller = false
    } = req.body;

    if (!id || !title || !category || price === undefined) {
      return res.status(400).json({ success: false, error: 'Slug/ID, title, category, and price are required.' });
    }

    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(cleanId);
    if (existing) {
      return res.status(400).json({ success: false, error: `Product slug "${cleanId}" already exists.` });
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ success: false, error: 'Price must be a valid non-negative number.' });
    }

    const pImages = Array.isArray(images) ? images : (images ? [images] : []);
    const pColors = Array.isArray(colors) && colors.length > 0
      ? colors
      : [{ name: 'Obsidian Black', hex: '#0b0b0b', code: 'obsidian' }];
    const pSizes = Array.isArray(sizes) && sizes.length > 0
      ? sizes
      : ['S', 'M', 'L', 'XL'];

    const validStatus = ['draft', 'published', 'archived'].includes(status) ? status : 'published';

    db.prepare(`
      INSERT INTO products (
        id, title, subtitle, category, type, price, compare_price,
        gsm, fabric, fit, description, care, images, badges, specs,
        colors, is_new_drop, is_bestseller, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '["NEW DROP"]', '[]', ?, ?, ?, ?)
    `).run(
      cleanId,
      title.trim(),
      subtitle ? subtitle.trim() : null,
      category.trim().toLowerCase(),
      type ? type.trim() : null,
      numPrice,
      comparePrice ? Number(comparePrice) : null,
      gsm || null,
      fabric || null,
      fit || null,
      description || null,
      care || null,
      JSON.stringify(pImages),
      JSON.stringify(pColors),
      isNewDrop ? 1 : 0,
      isBestseller ? 1 : 0,
      validStatus
    );

    // Insert variants
    const insertVariant = db.prepare(`
      INSERT INTO product_variants (product_id, size, color_code, sku, stock_quantity)
      VALUES (?, ?, ?, ?, ?)
    `);

    const pCode = cleanId.split('-').map(w => w[0] ? w[0].toUpperCase() : 'X').join('').substring(0, 4) || '590';

    for (const col of pColors) {
      const colCode = (col.code || 'STD').toUpperCase().substring(0, 3);
      for (const sz of pSizes) {
        const uniqueSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
        const sku = `590-${pCode}-${colCode}-${sz}-${uniqueSuffix}`;
        try {
          insertVariant.run(cleanId, sz, col.code || 'std', sku, Math.max(0, Number(stockQuantity) || 10));
        } catch (e) {
          console.error('Variant insert error:', e.message);
        }
      }
    }

    if (db.logActivity) {
      db.logActivity(req.user, 'PRODUCT_CREATED', 'product', cleanId, {
        title: title.trim(),
        price: numPrice,
        status: validStatus,
        category: category.trim()
      });
    }

    res.status(201).json({
      success: true,
      message: `Product "${title.trim()}" created successfully.`,
      productId: cleanId
    });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ success: false, error: 'Could not create product.' });
  }
});

/**
 * PUT /api/admin/products/:id
 */
router.put('/products/:id', (req, res) => {
  try {
    const productId = req.params.id;
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Product not found.' });
    }

    const {
      title, subtitle, category, type, price, comparePrice,
      gsm, fabric, fit, description, care, images, colors,
      status, isNewDrop, isBestseller
    } = req.body;

    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title.trim());
    }
    if (subtitle !== undefined) {
      updates.push('subtitle = ?');
      params.push(subtitle ? subtitle.trim() : null);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category.trim().toLowerCase());
    }
    if (type !== undefined) {
      updates.push('type = ?');
      params.push(type ? type.trim() : null);
    }
    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) {
        return res.status(400).json({ success: false, error: 'Price must be a non-negative number.' });
      }
      updates.push('price = ?');
      params.push(numPrice);
    }
    if (comparePrice !== undefined) {
      updates.push('compare_price = ?');
      params.push(comparePrice ? Number(comparePrice) : null);
    }
    if (gsm !== undefined) {
      updates.push('gsm = ?');
      params.push(gsm || null);
    }
    if (fabric !== undefined) {
      updates.push('fabric = ?');
      params.push(fabric || null);
    }
    if (fit !== undefined) {
      updates.push('fit = ?');
      params.push(fit || null);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }
    if (care !== undefined) {
      updates.push('care = ?');
      params.push(care || null);
    }
    if (images !== undefined) {
      const pImages = Array.isArray(images) ? images : (images ? [images] : []);
      updates.push('images = ?');
      params.push(JSON.stringify(pImages));
    }
    if (colors !== undefined) {
      const pColors = Array.isArray(colors) ? colors : [];
      updates.push('colors = ?');
      params.push(JSON.stringify(pColors));
    }
    if (status !== undefined) {
      if (['draft', 'published', 'archived'].includes(status)) {
        updates.push('status = ?');
        params.push(status);
      }
    }
    if (isNewDrop !== undefined) {
      updates.push('is_new_drop = ?');
      params.push(isNewDrop ? 1 : 0);
    }
    if (isBestseller !== undefined) {
      updates.push('is_bestseller = ?');
      params.push(isBestseller ? 1 : 0);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(productId);

    db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    if (db.logActivity) {
      db.logActivity(req.user, 'PRODUCT_UPDATED', 'product', productId, {
        fieldsUpdated: updates.length,
        priceUpdated: price !== undefined ? price : undefined,
        statusUpdated: status !== undefined ? status : undefined
      });
    }

    res.json({ success: true, message: 'Product updated successfully.' });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ success: false, error: 'Could not update product.' });
  }
});

/**
 * PATCH /api/admin/products/:id/status
 */
router.patch('/products/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be draft, published, or archived.' });
    }

    const product = db.prepare('SELECT id, title, status FROM products WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found.' });
    }

    db.prepare('UPDATE products SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(status, req.params.id);

    if (db.logActivity) {
      db.logActivity(req.user, 'PRODUCT_STATUS_CHANGED', 'product', req.params.id, {
        from: product.status,
        to: status,
        title: product.title
      });
    }

    res.json({ success: true, message: `Product status changed to ${status.toUpperCase()}.` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not update product status.' });
  }
});

/**
 * PATCH /api/admin/products/:id/stock
 */
router.patch('/products/:id/stock', (req, res) => {
  try {
    const { variantId, stockQuantity } = req.body;

    if (!variantId || stockQuantity === undefined) {
      return res.status(400).json({ success: false, error: 'variantId and stockQuantity are required.' });
    }

    const qty = Math.max(0, parseInt(stockQuantity, 10));

    const variant = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?')
      .get(variantId, req.params.id);

    if (!variant) {
      return res.status(404).json({ success: false, error: 'Product variant not found.' });
    }

    db.prepare(`
      UPDATE product_variants
      SET stock_quantity = ?
      WHERE id = ? AND product_id = ?
    `).run(qty, variantId, req.params.id);

    if (db.logActivity) {
      db.logActivity(req.user, 'STOCK_ADJUSTED', 'variant', variant.sku, {
        productId: req.params.id,
        size: variant.size,
        color: variant.color_code,
        previousStock: variant.stock_quantity,
        newStock: qty
      });
    }

    res.json({ success: true, message: `Stock for ${variant.sku} updated to ${qty}.`, newStock: qty });
  } catch (err) {
    console.error('Update stock error:', err);
    res.status(500).json({ success: false, error: 'Failed to update stock.' });
  }
});

/**
 * DELETE /api/admin/products/:id
 * Safe product deletion / archival:
 * If product is referenced in historical orders, safely archives it to preserve transactional integrity.
 * If not referenced in any orders, cleanly deletes product and variants.
 */
router.delete('/products/:id', (req, res) => {
  try {
    const productId = req.params.id;
    const product = db.prepare('SELECT id, title FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found.' });
    }

    // Check historical order dependency
    const orderItemCheck = db.prepare('SELECT COUNT(*) as count FROM order_items WHERE product_id = ?').get(productId);

    if (orderItemCheck.count > 0) {
      // Historical orders depend on this product! Soft archive to preserve order details.
      db.prepare("UPDATE products SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(productId);

      if (db.logActivity) {
        db.logActivity(req.user, 'PRODUCT_ARCHIVED', 'product', productId, {
          reason: 'Safely archived because product is referenced in historical orders',
          orderCount: orderItemCheck.count
        });
      }

      return res.json({
        success: true,
        archived: true,
        message: `Product "${product.title}" is referenced in historical customer orders. To preserve order integrity, it has been safely ARCHIVED from public sales instead of permanently deleted.`
      });
    }

    // No historical orders depend on this product: safe to hard delete
    db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM products WHERE id = ?').run(productId);

    if (db.logActivity) {
      db.logActivity(req.user, 'PRODUCT_DELETED', 'product', productId, { title: product.title });
    }

    res.json({
      success: true,
      deleted: true,
      message: `Product "${product.title}" and its variants were permanently deleted.`
    });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ success: false, error: 'Could not remove product.' });
  }
});

/**
 * ============================================================================
 * 3. IMAGE UPLOAD HANDLER
 * ============================================================================
 * POST /api/admin/upload-image
 * Secure image upload with size restriction (5MB), MIME verification,
 * and safe random filename generation.
 */
router.post('/upload-image', async (req, res) => {
  try {
    const { data, filename, originalName } = req.body;

    if (!data) {
      return res.status(400).json({ success: false, error: 'Image payload data is required.' });
    }

    // Base64 format: data:image/png;base64,iVBORw0KGgo...
    const matches = data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, error: 'Invalid image format. Expected valid Base64 data URL.' });
    }

    const mimeType = matches[1].toLowerCase();
    const allowedMimeTypes = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/svg+xml': '.svg'
    };

    if (!allowedMimeTypes[mimeType]) {
      return res.status(400).json({
        success: false,
        error: `Unsupported image type (${mimeType}). Allowed formats: JPEG, PNG, WEBP, GIF, SVG.`
      });
    }

    const buffer = Buffer.from(matches[2], 'base64');

    // 5MB max size limit
    const MAX_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({ success: false, error: 'Image exceeds maximum allowable size of 5MB.' });
    }

    const ext = allowedMimeTypes[mimeType];
    const uniqueName = `img_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    let publicUrl = null;

    // 1. Option C: Cloudinary persistent cloud storage (if environment variables are provided)
    let cldConfig = null;
    if (process.env.CLOUDINARY_URL) {
      try {
        const parsed = new URL(process.env.CLOUDINARY_URL);
        cldConfig = {
          cloudName: parsed.hostname,
          apiKey: parsed.username,
          apiSecret: parsed.password
        };
      } catch (e) {}
    } else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      cldConfig = {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET
      };
    }

    if (cldConfig && cldConfig.cloudName && cldConfig.apiKey && cldConfig.apiSecret) {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const folder = '590labs';
        const signatureString = `folder=${folder}&timestamp=${timestamp}${cldConfig.apiSecret}`;
        const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

        const cldRes = await fetch(`https://api.cloudinary.com/v1_1/${cldConfig.cloudName}/image/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: data,
            api_key: cldConfig.apiKey,
            timestamp,
            signature,
            folder
          })
        });

        const cldJson = await cldRes.json();
        if (cldJson && cldJson.secure_url) {
          publicUrl = cldJson.secure_url;
        } else {
          console.warn('Cloudinary upload warning:', cldJson?.error?.message || 'Unknown response');
        }
      } catch (cldErr) {
        console.error('Cloudinary upload error:', cldErr.message);
      }
    }

    // 2. Local disk or serverless /tmp fallback (Option A + B)
    if (!publicUrl) {
      const uploadsDir = path.resolve(__dirname, '../../assets/uploads');
      try {
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filePath = path.join(uploadsDir, uniqueName);
        fs.writeFileSync(filePath, buffer);
        publicUrl = `/assets/uploads/${uniqueName}`;
      } catch (fsErr) {
        // Fallback for serverless read-only root filesystems
        const tmpUploadsDir = path.join('/tmp', 'uploads');
        if (!fs.existsSync(tmpUploadsDir)) {
          fs.mkdirSync(tmpUploadsDir, { recursive: true });
        }
        const tmpFilePath = path.join(tmpUploadsDir, uniqueName);
        fs.writeFileSync(tmpFilePath, buffer);
        publicUrl = `/assets/uploads/${uniqueName}`;
      }
    }

    if (db.logActivity) {
      db.logActivity(req.user, 'IMAGE_UPLOADED', 'image', uniqueName, {
        mimeType,
        sizeBytes: buffer.length,
        url: publicUrl,
        originalName: originalName || filename || null
      });
    }

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully.',
      url: publicUrl,
      sizeBytes: buffer.length
    });
  } catch (err) {
    console.error('Upload image error:', err);
    res.status(500).json({ success: false, error: 'Could not upload image.' });
  }
});

/**
 * ============================================================================
 * 4. CATEGORY MANAGEMENT
 * ============================================================================
 * GET /api/admin/categories
 */
router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON LOWER(c.slug) = LOWER(p.category)
      GROUP BY c.id
      ORDER BY c.display_order ASC, c.name ASC
    `).all();

    res.json({ success: true, count: categories.length, categories });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ success: false, error: 'Could not load categories.' });
  }
});

/**
 * POST /api/admin/categories
 */
router.post('/categories', (req, res) => {
  try {
    const { name, slug, description, imageUrl, displayOrder = 0 } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Category name is required.' });
    }

    const cleanSlug = (slug || name).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const existing = db.prepare('SELECT id FROM categories WHERE slug = ? OR LOWER(name) = LOWER(?)').get(cleanSlug, name.trim());
    if (existing) {
      return res.status(400).json({ success: false, error: 'A category with this name or slug already exists.' });
    }

    const info = db.prepare(`
      INSERT INTO categories (name, slug, description, image_url, display_order, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(name.trim(), cleanSlug, description ? description.trim() : null, imageUrl || null, Number(displayOrder) || 0);

    const newId = Number(info.lastInsertRowid);

    if (db.logActivity) {
      db.logActivity(req.user, 'CATEGORY_CREATED', 'category', newId, { name: name.trim(), slug: cleanSlug });
    }

    res.status(201).json({
      success: true,
      message: `Category "${name.trim()}" created.`,
      category: { id: newId, name: name.trim(), slug: cleanSlug }
    });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ success: false, error: 'Could not create category.' });
  }
});

/**
 * PUT /api/admin/categories/:id
 */
router.put('/categories/:id', (req, res) => {
  try {
    const { name, slug, description, imageUrl, displayOrder, isActive } = req.body;
    const catId = req.params.id;

    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Category not found.' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined && name.trim()) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (slug !== undefined && slug.trim()) {
      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      updates.push('slug = ?');
      params.push(cleanSlug);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description ? description.trim() : null);
    }
    if (imageUrl !== undefined) {
      updates.push('image_url = ?');
      params.push(imageUrl || null);
    }
    if (displayOrder !== undefined) {
      updates.push('display_order = ?');
      params.push(Number(displayOrder) || 0);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(catId);

    db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    if (db.logActivity) {
      db.logActivity(req.user, 'CATEGORY_UPDATED', 'category', catId, { name, slug });
    }

    res.json({ success: true, message: 'Category updated successfully.' });
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ success: false, error: 'Could not update category.' });
  }
});

/**
 * DELETE /api/admin/categories/:id
 */
router.delete('/categories/:id', (req, res) => {
  try {
    const catId = req.params.id;
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId);
    if (!category) {
      return res.status(404).json({ success: false, error: 'Category not found.' });
    }

    // Check if any products depend on this category
    const productCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE LOWER(category) = LOWER(?)').get(category.slug);
    if (productCount.count > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete category "${category.name}". It is currently referenced by ${productCount.count} products. Reassign or archive these products first.`
      });
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(catId);

    if (db.logActivity) {
      db.logActivity(req.user, 'CATEGORY_DELETED', 'category', catId, { name: category.name, slug: category.slug });
    }

    res.json({ success: true, message: `Category "${category.name}" removed.` });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ success: false, error: 'Could not delete category.' });
  }
});

/**
 * ============================================================================
 * 5. ORDER MANAGEMENT
 * ============================================================================
 * GET /api/admin/orders
 */
router.get('/orders', (req, res) => {
  try {
    const { fulfillmentStatus, paymentStatus, search } = req.query;

    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (fulfillmentStatus && fulfillmentStatus !== 'all') {
      query += ' AND fulfillment_status = ?';
      params.push(fulfillmentStatus);
    }

    if (paymentStatus && paymentStatus !== 'all') {
      query += ' AND payment_status = ?';
      params.push(paymentStatus);
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ' AND (LOWER(id) LIKE ? OR LOWER(customer_name) LIKE ? OR LOWER(customer_email) LIKE ? OR LOWER(customer_phone) LIKE ?)';
      params.push(term, term, term, term);
    }

    query += ' ORDER BY created_at DESC';

    const orders = db.prepare(query).all(...params);
    const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');

    const formatted = orders.map(o => {
      let shippingAddress = {};
      try { shippingAddress = JSON.parse(o.shipping_address); } catch (e) {}
      return {
        ...o,
        shippingAddress,
        items: itemsStmt.all(o.id)
      };
    });

    res.json({ success: true, count: formatted.length, orders: formatted });
  } catch (err) {
    console.error('Admin orders error:', err);
    res.status(500).json({ success: false, error: 'Could not load orders list.' });
  }
});

/**
 * GET /api/admin/orders/:id
 */
router.get('/orders/:id', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    let shippingAddress = {};
    try { shippingAddress = JSON.parse(order.shipping_address); } catch (e) {}

    res.json({
      success: true,
      order: {
        ...order,
        shippingAddress,
        items
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not load order.' });
  }
});

/**
 * PATCH /api/admin/orders/:id/status
 */
router.patch('/orders/:id/status', (req, res) => {
  try {
    const { fulfillmentStatus, paymentStatus, carrier, trackingNumber, notes } = req.body;
    const orderId = req.params.id;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    const updates = [];
    const params = [];

    if (fulfillmentStatus) {
      const validStatuses = ['pending', 'confirmed', 'packing', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];
      if (!validStatuses.includes(fulfillmentStatus)) {
        return res.status(400).json({ success: false, error: 'Invalid fulfillment status.' });
      }
      updates.push('fulfillment_status = ?');
      params.push(fulfillmentStatus);
    }

    if (paymentStatus) {
      const validPayments = ['pending', 'paid', 'failed', 'refunded'];
      if (!validPayments.includes(paymentStatus)) {
        return res.status(400).json({ success: false, error: 'Invalid payment status.' });
      }
      updates.push('payment_status = ?');
      params.push(paymentStatus);
    }

    if (carrier !== undefined) {
      updates.push('carrier = ?');
      params.push(carrier);
    }

    if (trackingNumber !== undefined) {
      updates.push('tracking_number = ?');
      params.push(trackingNumber);
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(orderId);

    db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    if (db.logActivity) {
      db.logActivity(req.user, 'ORDER_STATUS_CHANGED', 'order', orderId, {
        fulfillmentStatus,
        paymentStatus,
        trackingNumber: trackingNumber || undefined
      });
    }

    res.json({ success: true, message: `Order #${orderId} updated successfully.` });
  } catch (err) {
    console.error('Admin update order error:', err);
    res.status(500).json({ success: false, error: 'Could not update order status.' });
  }
});

/**
 * ============================================================================
 * 6. CUSTOMER MANAGEMENT (PRIVACY-PROTECTED)
 * ============================================================================
 * GET /api/admin/customers
 */
router.get('/customers', (req, res) => {
  try {
    const customers = db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.created_at,
        COUNT(DISTINCT o.id) as orderCount,
        COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_amount ELSE 0 END), 0) as totalSpent
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.role = 'customer'
      GROUP BY u.id
      ORDER BY totalSpent DESC, u.created_at DESC
    `).all();

    res.json({ success: true, count: customers.length, customers });
  } catch (err) {
    console.error('Admin customers error:', err);
    res.status(500).json({ success: false, error: 'Could not load customer list.' });
  }
});

/**
 * GET /api/admin/customers/:id
 */
router.get('/customers/:id', (req, res) => {
  try {
    const customer = db.prepare(`
      SELECT id, name, email, phone, role, created_at, updated_at
      FROM users WHERE id = ? AND role = 'customer'
    `).get(req.params.id);

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found.' });
    }

    const addresses = db.prepare('SELECT * FROM addresses WHERE user_id = ?').all(customer.id);
    const orders = db.prepare(`
      SELECT id, total_amount, payment_status, fulfillment_status, created_at
      FROM orders WHERE user_id = ? ORDER BY created_at DESC
    `).all(customer.id);

    res.json({
      success: true,
      customer: {
        ...customer,
        addresses,
        orders
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not load customer profile.' });
  }
});

/**
 * ============================================================================
 * 7. COUPONS & PROMOTIONAL DISCOUNTS
 * ============================================================================
 * GET /api/admin/coupons
 */
router.get('/coupons', (req, res) => {
  try {
    const coupons = db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all();
    res.json({ success: true, coupons });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not load coupons.' });
  }
});

/**
 * POST /api/admin/coupons
 */
router.post('/coupons', (req, res) => {
  try {
    const { code, discountType, discountValue, minOrderValue = 0, maxDiscount, usageLimit } = req.body;

    if (!code || !discountType || discountValue === undefined) {
      return res.status(400).json({ success: false, error: 'Code, type, and discount value are required.' });
    }

    if (!['percent', 'fixed'].includes(discountType)) {
      return res.status(400).json({ success: false, error: 'Discount type must be "percent" or "fixed".' });
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = db.prepare('SELECT id FROM coupons WHERE code = ?').get(cleanCode);
    if (existing) {
      return res.status(400).json({ success: false, error: `Coupon code "${cleanCode}" already exists.` });
    }

    const val = Number(discountValue);
    if (discountType === 'percent' && (val <= 0 || val > 100)) {
      return res.status(400).json({ success: false, error: 'Percentage discount must be between 1 and 100.' });
    }

    db.prepare(`
      INSERT INTO coupons (code, discount_type, discount_value, min_order_value, max_discount, usage_limit, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(
      cleanCode,
      discountType,
      val,
      Number(minOrderValue) || 0,
      maxDiscount ? Number(maxDiscount) : null,
      usageLimit ? Number(usageLimit) : null
    );

    if (db.logActivity) {
      db.logActivity(req.user, 'COUPON_CREATED', 'coupon', cleanCode, { discountType, discountValue: val });
    }

    res.status(201).json({ success: true, message: `Coupon ${cleanCode} created successfully.` });
  } catch (err) {
    console.error('Create coupon error:', err);
    res.status(500).json({ success: false, error: 'Could not create coupon.' });
  }
});

/**
 * PATCH /api/admin/coupons/:id/toggle
 */
router.patch('/coupons/:id/toggle', (req, res) => {
  try {
    const coupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, error: 'Coupon not found.' });
    }

    const newStatus = coupon.is_active ? 0 : 1;
    db.prepare('UPDATE coupons SET is_active = ? WHERE id = ?').run(newStatus, req.params.id);

    if (db.logActivity) {
      db.logActivity(req.user, 'COUPON_TOGGLED', 'coupon', coupon.code, { isActive: Boolean(newStatus) });
    }

    res.json({ success: true, message: `Coupon ${coupon.code} is now ${newStatus ? 'ACTIVE' : 'INACTIVE'}.` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not update coupon status.' });
  }
});

/**
 * DELETE /api/admin/coupons/:id
 */
router.delete('/coupons/:id', (req, res) => {
  try {
    const coupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, error: 'Coupon not found.' });
    }

    db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);

    if (db.logActivity) {
      db.logActivity(req.user, 'COUPON_DELETED', 'coupon', coupon.code);
    }

    res.json({ success: true, message: `Coupon ${coupon.code} removed.` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not delete coupon.' });
  }
});

/**
 * ============================================================================
 * 8. REAL SALES ANALYTICS & REPORTS
 * ============================================================================
 * GET /api/admin/analytics
 */
router.get('/analytics', (req, res) => {
  try {
    // 1. Gross revenue & net revenue
    const revenueRow = db.prepare(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as grossRevenue,
        COALESCE(SUM(discount), 0) as totalDiscounts,
        COUNT(id) as totalPaidOrders
      FROM orders
      WHERE payment_status = 'paid'
    `).get();

    // 2. Average Order Value (AOV)
    const aov = revenueRow.totalPaidOrders > 0
      ? Math.round(revenueRow.grossRevenue / revenueRow.totalPaidOrders)
      : 0;

    // 3. Top selling products by revenue & units
    const topProducts = db.prepare(`
      SELECT 
        oi.product_id,
        oi.product_title,
        SUM(oi.quantity) as totalUnitsSold,
        SUM(oi.price * oi.quantity) as totalRevenue,
        MAX(oi.image_url) as image
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.payment_status = 'paid'
      GROUP BY oi.product_id
      ORDER BY totalRevenue DESC
      LIMIT 5
    `).all();

    // 4. Category breakdown
    const categoryBreakdown = db.prepare(`
      SELECT 
        p.category,
        COALESCE(SUM(oi.price * oi.quantity), 0) as revenue,
        COALESCE(SUM(oi.quantity), 0) as unitsSold
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE o.payment_status = 'paid'
      GROUP BY p.category
      ORDER BY revenue DESC
    `).all();

    // 5. Order fulfillment status breakdown
    const statusBreakdown = db.prepare(`
      SELECT fulfillment_status, COUNT(*) as count
      FROM orders
      GROUP BY fulfillment_status
    `).all();

    // 6. Last 14 days daily sales timeline
    const dailySales = db.prepare(`
      SELECT 
        substr(created_at, 1, 10) as date,
        COUNT(*) as orderCount,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM orders
      WHERE payment_status = 'paid'
      GROUP BY substr(created_at, 1, 10)
      ORDER BY date DESC
      LIMIT 14
    `).all().reverse();

    res.json({
      success: true,
      analytics: {
        grossRevenue: revenueRow.grossRevenue,
        totalDiscounts: revenueRow.totalDiscounts,
        netRevenue: revenueRow.grossRevenue,
        totalPaidOrders: revenueRow.totalPaidOrders,
        aov,
        topProducts,
        categoryBreakdown,
        statusBreakdown,
        dailySales
      }
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success: false, error: 'Could not calculate analytics.' });
  }
});

/**
 * ============================================================================
 * 9. ADMINISTRATOR MANAGEMENT (OWNER-ONLY)
 * ============================================================================
 * GET /api/admin/administrators
 */
router.get('/administrators', requireOwner, (req, res) => {
  try {
    const admins = db.prepare(`
      SELECT id, name, email, role, phone, created_at, updated_at
      FROM users
      WHERE role IN ('owner', 'admin', 'staff')
      ORDER BY 
        CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
        created_at ASC
    `).all();

    res.json({ success: true, count: admins.length, administrators: admins });
  } catch (err) {
    console.error('Get administrators error:', err);
    res.status(500).json({ success: false, error: 'Could not load administrators list.' });
  }
});

/**
 * POST /api/admin/administrators
 */
router.post('/administrators', requireOwner, (req, res) => {
  try {
    const { name, email, password, role = 'admin', phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
    }

    if (!['admin', 'staff'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Role must be "admin" or "staff".' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }

    const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(cleanEmail);
    const passwordHash = bcrypt.hashSync(password, 10);

    let targetId;
    if (existing) {
      if (['owner', 'admin', 'staff'].includes(existing.role)) {
        return res.status(400).json({ success: false, error: 'An administrator account with this email already exists.' });
      }
      // Elevate customer account to admin/staff
      db.prepare('UPDATE users SET role = ?, password_hash = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(role, passwordHash, name.trim(), existing.id);
      targetId = existing.id;
    } else {
      const stmt = db.prepare(`
        INSERT INTO users (name, email, password_hash, role, phone)
        VALUES (?, ?, ?, ?, ?)
      `);
      const info = stmt.run(name.trim(), cleanEmail, passwordHash, role, phone ? phone.trim() : null);
      targetId = Number(info.lastInsertRowid);
    }

    if (db.logActivity) {
      db.logActivity(req.user, 'ADMIN_AUTHORIZED', 'user', targetId, {
        name: name.trim(),
        email: cleanEmail,
        assignedRole: role
      });
    }

    res.status(201).json({
      success: true,
      message: `Authorized ${name.trim()} as ${role.toUpperCase()}.`,
      admin: { id: targetId, name: name.trim(), email: cleanEmail, role }
    });
  } catch (err) {
    console.error('Authorize admin error:', err);
    res.status(500).json({ success: false, error: 'Could not authorize administrator.' });
  }
});

/**
 * PATCH /api/admin/administrators/:id/role
 */
router.patch('/administrators/:id/role', requireOwner, (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const { role } = req.body;

    if (!['owner', 'admin', 'staff'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Role must be owner, admin, or staff.' });
    }

    const targetUser = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(targetId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Administrator account not found.' });
    }

    // Safety guard: prevent demoting the sole owner
    if (targetUser.role === 'owner' && role !== 'owner') {
      const ownerCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'owner'").get();
      if (ownerCount.count <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Action prohibited: You cannot demote the only active store Owner account.'
        });
      }
    }

    db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(role, targetId);

    if (db.logActivity) {
      db.logActivity(req.user, 'ADMIN_ROLE_CHANGED', 'user', targetId, {
        targetEmail: targetUser.email,
        fromRole: targetUser.role,
        toRole: role
      });
    }

    res.json({ success: true, message: `Role for ${targetUser.name} updated to ${role.toUpperCase()}.` });
  } catch (err) {
    console.error('Update admin role error:', err);
    res.status(500).json({ success: false, error: 'Could not update administrator role.' });
  }
});

/**
 * DELETE /api/admin/administrators/:id
 */
router.delete('/administrators/:id', requireOwner, (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const targetUser = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(targetId);

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Administrator not found.' });
    }

    // Guard: Prevent deleting or revoking the sole owner
    if (targetUser.role === 'owner') {
      const ownerCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'owner'").get();
      if (ownerCount.count <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Action prohibited: Cannot revoke or delete the only store Owner account.'
        });
      }
    }

    // Demote to customer
    db.prepare("UPDATE users SET role = 'customer', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(targetId);

    if (db.logActivity) {
      db.logActivity(req.user, 'ADMIN_ACCESS_REVOKED', 'user', targetId, {
        revokedName: targetUser.name,
        revokedEmail: targetUser.email,
        formerRole: targetUser.role
      });
    }

    res.json({
      success: true,
      message: `Administrative access for ${targetUser.name} has been revoked.`
    });
  } catch (err) {
    console.error('Revoke admin error:', err);
    res.status(500).json({ success: false, error: 'Could not revoke administrator access.' });
  }
});

/**
 * ============================================================================
 * 10. ACTIVITY LOG
 * ============================================================================
 * GET /api/admin/activity-logs
 */
router.get('/activity-logs', (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;

    let query = 'SELECT * FROM activity_logs WHERE 1=1';
    const params = [];

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ' AND (LOWER(admin_name) LIKE ? OR LOWER(action) LIKE ? OR LOWER(entity_type) LIKE ? OR LOWER(details) LIKE ?)';
      params.push(term, term, term, term);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit) || 50, Number(offset) || 0);

    const logs = db.prepare(query).all(...params);
    const totalCount = db.prepare('SELECT COUNT(*) as total FROM activity_logs').get().total;

    res.json({ success: true, count: logs.length, total: totalCount, logs });
  } catch (err) {
    console.error('Activity logs error:', err);
    res.status(500).json({ success: false, error: 'Could not load activity log.' });
  }
});

/**
 * ============================================================================
 * 11. STOREFRONT MERCHANDISING
 * ============================================================================
 * GET /api/admin/merchandising
 */
router.get('/merchandising', (req, res) => {
  try {
    const rows = db.prepare("SELECT key, value FROM store_settings WHERE key LIKE 'merch_%'").all();
    const settings = {};
    for (const r of rows) {
      try { settings[r.key] = JSON.parse(r.value); } catch (e) { settings[r.key] = r.value; }
    }

    // If no custom merchandising set yet, provide defaults
    if (!settings.merch_banner) {
      settings.merch_banner = {
        enabled: true,
        text: 'FREE EXPRESS SHIPPING ON ALL ORDERS OVER ₹1,999 // USE CODE DROP10 FOR 10% OFF'
      };
    }

    res.json({ success: true, merchandising: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not load merchandising settings.' });
  }
});

/**
 * POST /api/admin/merchandising
 */
router.post('/merchandising', (req, res) => {
  try {
    const { banner, featuredProductIds, heroHeadline } = req.body;

    const upsert = db.prepare(`
      INSERT INTO store_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    if (banner !== undefined) {
      upsert.run('merch_banner', JSON.stringify(banner));
    }
    if (featuredProductIds !== undefined) {
      upsert.run('merch_featured', JSON.stringify(featuredProductIds));
    }
    if (heroHeadline !== undefined) {
      upsert.run('merch_hero_headline', JSON.stringify(heroHeadline));
    }

    if (db.logActivity) {
      db.logActivity(req.user, 'MERCHANDISING_UPDATED', 'settings', 'merchandising');
    }

    res.json({ success: true, message: 'Merchandising configuration saved.' });
  } catch (err) {
    console.error('Update merchandising error:', err);
    res.status(500).json({ success: false, error: 'Could not save merchandising settings.' });
  }
});

/**
 * ============================================================================
 * 12. REVIEW MODERATION
 * ============================================================================
 */
router.get('/reviews', (req, res) => {
  try {
    const reviews = db.prepare(`
      SELECT r.*, p.title as product_title
      FROM reviews r
      JOIN products p ON r.product_id = p.id
      ORDER BY r.created_at DESC
    `).all();
    res.json({ success: true, reviews });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not load reviews.' });
  }
});

router.patch('/reviews/:id/moderate', (req, res) => {
  try {
    const { isApproved } = req.body;
    db.prepare('UPDATE reviews SET is_approved = ? WHERE id = ?').run(isApproved ? 1 : 0, req.params.id);

    if (db.logActivity) {
      db.logActivity(req.user, 'REVIEW_MODERATED', 'review', req.params.id, { isApproved: Boolean(isApproved) });
    }

    res.json({ success: true, message: 'Review moderation updated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Moderation action failed.' });
  }
});

module.exports = router;
