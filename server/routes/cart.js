const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * Helper to identify cart owner (user_id if authenticated, or session_id header/cookie)
 */
function getCartIdentifier(req) {
  const userId = req.user ? req.user.id : null;
  const sessionId = req.headers['x-session-id'] || req.cookies['session_id'] || null;
  return { userId, sessionId };
}

/**
 * GET /api/cart
 * Get cart items with live product data, line totals, and stock availability verification
 */
router.get('/', (req, res) => {
  try {
    const { userId, sessionId } = getCartIdentifier(req);

    if (!userId && !sessionId) {
      return res.json({ success: true, items: [], subtotal: 0, count: 0 });
    }

    let items;
    if (userId) {
      items = db.prepare(`
        SELECT c.*, p.title, p.price, p.compare_price, p.images, p.status,
          COALESCE(v.stock_quantity, 0) as available_stock
        FROM cart_items c
        JOIN products p ON c.product_id = p.id
        LEFT JOIN product_variants v ON v.product_id = c.product_id AND v.size = c.variant_size AND v.color_code = c.variant_color
        WHERE c.user_id = ?
      `).all(userId);
    } else {
      items = db.prepare(`
        SELECT c.*, p.title, p.price, p.compare_price, p.images, p.status,
          COALESCE(v.stock_quantity, 0) as available_stock
        FROM cart_items c
        JOIN products p ON c.product_id = p.id
        LEFT JOIN product_variants v ON v.product_id = c.product_id AND v.size = c.variant_size AND v.color_code = c.variant_color
        WHERE c.session_id = ?
      `).all(sessionId);
    }

    let subtotal = 0;
    let totalCount = 0;

    const formattedItems = items.map(item => {
      let images = [];
      try { images = JSON.parse(item.images || '[]'); } catch (e) {}
      const lineTotal = item.price * item.quantity;
      subtotal += lineTotal;
      totalCount += item.quantity;

      return {
        cartItemId: item.id,
        productId: item.product_id,
        title: item.title,
        price: item.price,
        comparePrice: item.compare_price,
        size: item.variant_size,
        color: item.variant_color,
        quantity: item.quantity,
        availableStock: item.available_stock,
        isOutOfStock: item.available_stock <= 0,
        isStockExceeded: item.quantity > item.available_stock,
        lineTotal,
        image: images[0] || ''
      };
    });

    res.json({
      success: true,
      items: formattedItems,
      subtotal,
      count: totalCount
    });
  } catch (err) {
    console.error('Get cart error:', err);
    res.status(500).json({ success: false, error: 'Could not load shopping cart.' });
  }
});

/**
 * POST /api/cart/add
 * Add item to cart with stock validation
 */
router.post('/add', (req, res) => {
  try {
    const { userId, sessionId } = getCartIdentifier(req);
    const { productId, size, color, quantity = 1 } = req.body;

    if (!productId || !size || !color) {
      return res.status(400).json({ success: false, error: 'Product, size, and color are required.' });
    }

    // Verify stock
    const variant = db.prepare(`
      SELECT stock_quantity FROM product_variants
      WHERE product_id = ? AND size = ? AND color_code = ?
    `).get(productId, size, color);

    const availableStock = variant ? variant.stock_quantity : 0;
    if (availableStock <= 0) {
      return res.status(400).json({ success: false, error: 'This size and color combination is currently sold out.' });
    }

    // Check existing in cart
    let existing;
    if (userId) {
      existing = db.prepare(`
        SELECT * FROM cart_items
        WHERE user_id = ? AND product_id = ? AND variant_size = ? AND variant_color = ?
      `).get(userId, productId, size, color);
    } else {
      existing = db.prepare(`
        SELECT * FROM cart_items
        WHERE session_id = ? AND product_id = ? AND variant_size = ? AND variant_color = ?
      `).get(sessionId, productId, size, color);
    }

    const newQty = (existing ? existing.quantity : 0) + Number(quantity);

    if (newQty > availableStock) {
      return res.status(400).json({
        success: false,
        error: `Only ${availableStock} units available in stock.`
      });
    }

    if (existing) {
      db.prepare(`
        UPDATE cart_items
        SET quantity = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newQty, existing.id);
    } else {
      db.prepare(`
        INSERT INTO cart_items (user_id, session_id, product_id, variant_size, variant_color, quantity)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, userId ? null : sessionId, productId, size, color, newQty);
    }

    res.json({ success: true, message: 'Item added to bag.' });
  } catch (err) {
    console.error('Cart add error:', err);
    res.status(500).json({ success: false, error: 'Could not add item to bag.' });
  }
});

/**
 * PUT /api/cart/:id
 * Update quantity
 */
router.put('/:id', (req, res) => {
  try {
    const { quantity } = req.body;
    const { userId, sessionId } = getCartIdentifier(req);
    const cartId = req.params.id;

    if (quantity <= 0) {
      // Remove if quantity is 0 or less
      db.prepare('DELETE FROM cart_items WHERE id = ?').run(cartId);
      return res.json({ success: true, message: 'Item removed from bag.' });
    }

    // Check item
    const item = db.prepare('SELECT * FROM cart_items WHERE id = ?').get(cartId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Cart item not found.' });
    }

    // Validate ownership
    if (userId && item.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized.' });
    }

    // Check stock
    const variant = db.prepare(`
      SELECT stock_quantity FROM product_variants
      WHERE product_id = ? AND size = ? AND color_code = ?
    `).get(item.product_id, item.variant_size, item.variant_color);

    const availableStock = variant ? variant.stock_quantity : 0;
    if (quantity > availableStock) {
      return res.status(400).json({
        success: false,
        error: `Only ${availableStock} units available in stock.`
      });
    }

    db.prepare('UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(quantity, cartId);

    res.json({ success: true, message: 'Cart updated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not update cart.' });
  }
});

/**
 * DELETE /api/cart/:id
 * Remove item
 */
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM cart_items WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Item removed.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not remove item.' });
  }
});

/**
 * POST /api/cart/sync
 * Merge guest cart items into authenticated user's cart upon login
 */
router.post('/sync', (req, res) => {
  try {
    const { guestItems } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!userId || !Array.isArray(guestItems) || guestItems.length === 0) {
      return res.json({ success: true, message: 'Nothing to sync.' });
    }

    const insertOrUpdate = db.prepare(`
      INSERT INTO cart_items (user_id, product_id, variant_size, variant_color, quantity)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, product_id, variant_size, variant_color)
      DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = CURRENT_TIMESTAMP
    `);

    for (const item of guestItems) {
      // Validate variant exists
      const variant = db.prepare(`
        SELECT stock_quantity FROM product_variants
        WHERE product_id = ? AND size = ? AND color_code = ?
      `).get(item.productId || item.id, item.size, item.color);

      if (variant && variant.stock_quantity > 0) {
        insertOrUpdate.run(
          userId,
          item.productId || item.id,
          item.size,
          item.color,
          Math.min(item.quantity || 1, variant.stock_quantity)
        );
      }
    }

    res.json({ success: true, message: 'Cart synchronized with your account.' });
  } catch (err) {
    console.error('Cart sync error:', err);
    res.status(500).json({ success: false, error: 'Failed to synchronize cart.' });
  }
});

/**
 * POST /api/cart/clear
 */
router.post('/clear', (req, res) => {
  try {
    const { userId, sessionId } = getCartIdentifier(req);
    if (userId) {
      db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
    } else if (sessionId) {
      db.prepare('DELETE FROM cart_items WHERE session_id = ?').run(sessionId);
    }
    res.json({ success: true, message: 'Cart cleared.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to clear cart.' });
  }
});

module.exports = router;
