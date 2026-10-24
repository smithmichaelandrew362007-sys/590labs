const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/reviews/product/:productId
 * Get approved customer reviews and rating metrics
 */
router.get('/product/:productId', (req, res) => {
  try {
    const reviews = db.prepare(`
      SELECT id, author_name, rating, title, comment, verified_purchase, created_at
      FROM reviews
      WHERE product_id = ? AND is_approved = 1
      ORDER BY created_at DESC
    `).all(req.params.productId);

    const stats = db.prepare(`
      SELECT
        COUNT(*) as totalReviews,
        COALESCE(AVG(rating), 5.0) as avgRating
      FROM reviews
      WHERE product_id = ? AND is_approved = 1
    `).get(req.params.productId);

    res.json({
      success: true,
      totalReviews: stats.totalReviews,
      avgRating: Math.round(stats.avgRating * 10) / 10,
      reviews
    });
  } catch (err) {
    console.error('Reviews load error:', err);
    res.status(500).json({ success: false, error: 'Could not load reviews.' });
  }
});

/**
 * POST /api/reviews
 * Submit a verified customer review
 */
router.post('/', (req, res) => {
  try {
    const { productId, authorName, rating, title, comment } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!productId || !rating || !comment || !comment.trim()) {
      return res.status(400).json({ success: false, error: 'Product, star rating, and review text are required.' });
    }

    const numRating = Number(rating);
    if (numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5 stars.' });
    }

    // Check verified purchase
    let verifiedPurchase = 0;
    if (userId) {
      const purchase = db.prepare(`
        SELECT oi.id
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.user_id = ? AND oi.product_id = ? AND o.fulfillment_status = 'delivered'
      `).get(userId, productId);

      if (purchase) {
        verifiedPurchase = 1;
      }
    }

    const name = authorName ? authorName.trim() : (req.user ? req.user.name : 'Anonymous Streetwear Collector');

    const stmt = db.prepare(`
      INSERT INTO reviews (product_id, user_id, author_name, rating, title, comment, verified_purchase, is_approved)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const info = stmt.run(
      productId,
      userId,
      name,
      numRating,
      title ? title.trim() : null,
      comment.trim(),
      verifiedPurchase
    );

    res.status(201).json({
      success: true,
      message: 'Thank you for your feedback. Review published!',
      reviewId: Number(info.lastInsertRowid)
    });
  } catch (err) {
    console.error('Review submit error:', err);
    res.status(500).json({ success: false, error: 'Could not submit review.' });
  }
});

module.exports = router;
