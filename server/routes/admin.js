const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

// All admin routes are strictly guarded by requireAdmin
router.use(requireAdmin);

/**
 * GET /api/admin/stats
 * Real database-backed operational metrics
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

    // 5. Low stock alerts (stock <= 3)
    const lowStockVariants = db.prepare(`
      SELECT v.id, v.product_id, p.title as product_title, v.size, v.color_code, v.sku, v.stock_quantity
      FROM product_variants v
      JOIN products p ON v.product_id = p.id
      WHERE v.stock_quantity <= 3 AND p.status = 'published'
      ORDER BY v.stock_quantity ASC
      LIMIT 10
    `).all();

    // 6. Recent 5 orders
    const recentOrders = db.prepare(`
      SELECT id, customer_name, customer_email, total_amount, payment_method,
        payment_status, fulfillment_status, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 8
    `).all();

    res.json({
      success: true,
      stats: {
        totalRevenue: revenueRow.totalRevenue,
        totalOrders: totalOrdersRow.totalOrders,
        pendingFulfillment: pendingFulfillmentRow.pendingCount,
        totalCustomers: totalCustomersRow.totalCustomers,
        lowStockCount: lowStockVariants.length,
        lowStockVariants,
        recentOrders
      }
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ success: false, error: 'Could not calculate store metrics.' });
  }
});

/**
 * GET /api/admin/orders
 * Search, filter and list orders
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
 * PATCH /api/admin/orders/:id/status
 * Update order fulfillment or payment status
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

    res.json({ success: true, message: 'Order updated successfully.' });
  } catch (err) {
    console.error('Admin update order error:', err);
    res.status(500).json({ success: false, error: 'Could not update order status.' });
  }
});

/**
 * GET /api/admin/products
 * List products with full inventory variant counts
 */
router.get('/products', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
    const variantStmt = db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY size');

    const formatted = products.map(p => {
      let images = [];
      let colors = [];
      try { images = JSON.parse(p.images || '[]'); } catch (e) {}
      try { colors = JSON.parse(p.colors || '[]'); } catch (e) {}

      const variants = variantStmt.all(p.id);
      const totalStock = variants.reduce((sum, v) => sum + v.stock_quantity, 0);

      return {
        ...p,
        images,
        colors,
        variants,
        totalStock
      };
    });

    res.json({ success: true, products: formatted });
  } catch (err) {
    console.error('Admin products error:', err);
    res.status(500).json({ success: false, error: 'Could not load products catalogue.' });
  }
});

/**
 * POST /api/admin/products
 * Create a new product with variants
 */
router.post('/products', (req, res) => {
  try {
    const {
      id, title, subtitle, category, type, price, comparePrice,
      gsm, fabric, fit, description, care, images, colors, sizes, stockQuantity = 10
    } = req.body;

    if (!id || !title || !category || !price) {
      return res.status(400).json({ success: false, error: 'ID, title, category, and price are required.' });
    }

    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(cleanId);
    if (existing) {
      return res.status(400).json({ success: false, error: `Product ID "${cleanId}" already exists.` });
    }

    const pImages = Array.isArray(images) ? images : (images ? [images] : []);
    const pColors = Array.isArray(colors) ? colors : [{ name: 'Obsidian Black', hex: '#0b0b0b', code: 'obsidian' }];
    const pSizes = Array.isArray(sizes) ? sizes : ['S', 'M', 'L', 'XL'];

    db.prepare(`
      INSERT INTO products (
        id, title, subtitle, category, type, price, compare_price,
        gsm, fabric, fit, description, care, images, badges, specs,
        colors, is_new_drop, is_bestseller, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '["NEW DROP"]', '[]', ?, 1, 0, 'published')
    `).run(
      cleanId,
      title.trim(),
      subtitle ? subtitle.trim() : null,
      category.trim().toLowerCase(),
      type ? type.trim() : null,
      Number(price),
      comparePrice ? Number(comparePrice) : null,
      gsm || null,
      fabric || null,
      fit || null,
      description || null,
      care || null,
      JSON.stringify(pImages),
      JSON.stringify(pColors)
    );

    // Insert variants
    const insertVariant = db.prepare(`
      INSERT INTO product_variants (product_id, size, color_code, sku, stock_quantity)
      VALUES (?, ?, ?, ?, ?)
    `);

    const pCode = cleanId.split('-').map(w => w[0].toUpperCase()).join('').substring(0, 4);

    for (const col of pColors) {
      for (const sz of pSizes) {
        const sku = `590-${pCode}-${col.code.toUpperCase().substring(0, 3)}-${sz}`;
        try {
          insertVariant.run(cleanId, sz, col.code, sku, Number(stockQuantity) || 10);
        } catch (e) {}
      }
    }

    res.status(201).json({ success: true, message: 'Product created successfully.', productId: cleanId });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ success: false, error: 'Could not create product.' });
  }
});

/**
 * PATCH /api/admin/products/:id/stock
 * Quickly update stock quantity for a variant
 */
router.patch('/products/:id/stock', (req, res) => {
  try {
    const { variantId, stockQuantity } = req.body;

    if (!variantId || stockQuantity === undefined) {
      return res.status(400).json({ success: false, error: 'variantId and stockQuantity are required.' });
    }

    db.prepare(`
      UPDATE product_variants
      SET stock_quantity = ?
      WHERE id = ? AND product_id = ?
    `).run(Number(stockQuantity), variantId, req.params.id);

    res.json({ success: true, message: 'Inventory updated successfully.' });
  } catch (err) {
    console.error('Update stock error:', err);
    res.status(500).json({ success: false, error: 'Failed to update stock.' });
  }
});

/**
 * GET /api/admin/customers
 * List customers with order volume and spend
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

    res.json({ success: true, customers });
  } catch (err) {
    console.error('Admin customers error:', err);
    res.status(500).json({ success: false, error: 'Could not load customer list.' });
  }
});

/**
 * Coupon management
 */
router.get('/coupons', (req, res) => {
  try {
    const coupons = db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all();
    res.json({ success: true, coupons });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not load coupons.' });
  }
});

router.post('/coupons', (req, res) => {
  try {
    const { code, discountType, discountValue, minOrderValue, maxDiscount, usageLimit } = req.body;

    if (!code || !discountType || !discountValue) {
      return res.status(400).json({ success: false, error: 'Code, type, and value are required.' });
    }

    const cleanCode = code.trim().toUpperCase();

    db.prepare(`
      INSERT INTO coupons (code, discount_type, discount_value, min_order_value, max_discount, usage_limit, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(
      cleanCode,
      discountType,
      Number(discountValue),
      Number(minOrderValue) || 0,
      maxDiscount ? Number(maxDiscount) : null,
      usageLimit ? Number(usageLimit) : null
    );

    res.status(201).json({ success: true, message: `Coupon ${cleanCode} created.` });
  } catch (err) {
    console.error('Create coupon error:', err);
    res.status(500).json({ success: false, error: 'Could not create coupon.' });
  }
});

/**
 * Review moderation
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
    res.json({ success: true, message: 'Review moderation updated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Moderation action failed.' });
  }
});

module.exports = router;
