const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

/**
 * POST /api/stock-alerts
 * Subscribe to restock notification for a specific product and size
 */
router.post('/', (req, res) => {
  try {
    const { productId, size, email } = req.body;

    if (!productId || !size || !email) {
      return res.status(400).json({
        success: false,
        error: 'Product ID, size, and email address are required.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanSize = size.trim().toUpperCase();

    // Verify product exists
    const product = db.prepare('SELECT id, title FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found.'
      });
    }

    // Check if already subscribed
    const existing = db.prepare(`
      SELECT id FROM stock_alerts
      WHERE product_id = ? AND size = ? AND email = ? AND status = 'pending'
    `).get(productId, cleanSize, cleanEmail);

    if (existing) {
      return res.json({
        success: true,
        alreadySubscribed: true,
        message: `You are already registered for ${product.title} in Size ${cleanSize}. We'll notify you first!`
      });
    }

    db.prepare(`
      INSERT INTO stock_alerts (product_id, product_title, size, email, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(productId, product.title, cleanSize, cleanEmail);

    res.json({
      success: true,
      message: `RESTOCK PRIORITY CONFIRMED. We will notify ${cleanEmail} as soon as Size ${cleanSize} drops.`
    });
  } catch (err) {
    console.error('Stock alert registration error:', err);
    res.status(500).json({
      success: false,
      error: 'Could not register stock alert. Please try again.'
    });
  }
});

/**
 * GET /api/stock-alerts
 * Admin only: view pending stock alerts for inventory forecasting
 */
router.get('/', requireAdmin, (req, res) => {
  try {
    const alerts = db.prepare(`
      SELECT sa.*, p.title as product_title, p.category, p.price,
        (SELECT stock_quantity FROM product_variants WHERE product_id = sa.product_id AND size = sa.size LIMIT 1) as current_stock
      FROM stock_alerts sa
      LEFT JOIN products p ON sa.product_id = p.id
      ORDER BY sa.created_at DESC
      LIMIT 100
    `).all();

    const summary = db.prepare(`
      SELECT product_id, product_title, size, COUNT(*) as demand_count
      FROM stock_alerts
      WHERE status = 'pending'
      GROUP BY product_id, size
      ORDER BY demand_count DESC
      LIMIT 10
    `).all();

    res.json({ success: true, alerts, topDemands: summary });
  } catch (err) {
    console.error('Stock alerts fetch error:', err);
    res.status(500).json({ success: false, error: 'Could not load stock alerts.' });
  }
});

module.exports = router;
