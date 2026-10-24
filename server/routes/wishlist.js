const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/wishlist
 * List wishlist items with product information
 */
router.get('/', requireAuth, (req, res) => {
  try {
    const items = db.prepare(`
      SELECT w.id as wishlist_id, w.created_at as added_at,
        p.id, p.title, p.subtitle, p.category, p.price, p.compare_price,
        p.images, p.status, p.is_new_drop
      FROM wishlist_items w
      JOIN products p ON w.product_id = p.id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
    `).all(req.user.id);

    const formatted = items.map(item => {
      let images = [];
      try { images = JSON.parse(item.images || '[]'); } catch (e) {}
      return {
        wishlistId: item.wishlist_id,
        productId: item.id,
        title: item.title,
        subtitle: item.subtitle,
        category: item.category,
        price: item.price,
        comparePrice: item.compare_price,
        isNewDrop: Boolean(item.is_new_drop),
        image: images[0] || '',
        addedAt: item.added_at
      };
    });

    res.json({ success: true, items: formatted });
  } catch (err) {
    console.error('Wishlist fetch error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch wishlist.' });
  }
});

/**
 * POST /api/wishlist/toggle
 * Add or remove product from wishlist
 */
router.post('/toggle', requireAuth, (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, error: 'Product ID is required.' });
    }

    const existing = db.prepare(`
      SELECT id FROM wishlist_items
      WHERE user_id = ? AND product_id = ?
    `).get(req.user.id, productId);

    if (existing) {
      db.prepare('DELETE FROM wishlist_items WHERE id = ?').run(existing.id);
      return res.json({ success: true, inWishlist: false, message: 'Removed from wishlist.' });
    } else {
      db.prepare(`
        INSERT INTO wishlist_items (user_id, product_id)
        VALUES (?, ?)
      `).run(req.user.id, productId);
      return res.json({ success: true, inWishlist: true, message: 'Added to wishlist.' });
    }
  } catch (err) {
    console.error('Wishlist toggle error:', err);
    res.status(500).json({ success: false, error: 'Could not update wishlist.' });
  }
});

/**
 * POST /api/wishlist/move-to-cart
 */
router.post('/move-to-cart', requireAuth, (req, res) => {
  try {
    const { productId, size = 'M', color = 'obsidian' } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, error: 'Product ID required.' });
    }

    // Verify stock
    const variant = db.prepare(`
      SELECT stock_quantity FROM product_variants
      WHERE product_id = ? AND size = ?
    `).get(productId, size);

    if (!variant || variant.stock_quantity <= 0) {
      return res.status(400).json({ success: false, error: 'Selected size is currently out of stock.' });
    }

    // Add to cart
    db.prepare(`
      INSERT INTO cart_items (user_id, product_id, variant_size, variant_color, quantity)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(user_id, product_id, variant_size, variant_color)
      DO UPDATE SET quantity = quantity + 1, updated_at = CURRENT_TIMESTAMP
    `).run(req.user.id, productId, size, color);

    // Remove from wishlist
    db.prepare('DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?')
      .run(req.user.id, productId);

    res.json({ success: true, message: 'Moved to shopping bag.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not move item to bag.' });
  }
});

module.exports = router;
