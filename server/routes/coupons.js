const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * POST /api/coupons/validate
 * Validates promotional coupon against current cart subtotal
 */
router.post('/validate', (req, res) => {
  try {
    const { code, subtotal } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, error: 'Coupon code is required.' });
    }

    const orderSubtotal = Number(subtotal) || 0;
    const cleanCode = code.trim().toUpperCase();

    const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1').get(cleanCode);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: `Coupon "${cleanCode}" is invalid or expired.`
      });
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: `Coupon "${cleanCode}" has expired.`
      });
    }

    if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) {
      return res.status(400).json({
        success: false,
        error: `Coupon "${cleanCode}" usage limit has been reached.`
      });
    }

    if (orderSubtotal < coupon.min_order_value) {
      return res.status(400).json({
        success: false,
        error: `Coupon "${cleanCode}" requires a minimum order value of ₹${coupon.min_order_value}.`
      });
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (coupon.discount_type === 'percent') {
      discountAmount = Math.round((orderSubtotal * coupon.discount_value) / 100);
      if (coupon.max_discount && discountAmount > coupon.max_discount) {
        discountAmount = coupon.max_discount;
      }
    } else if (coupon.discount_type === 'fixed') {
      discountAmount = Math.min(coupon.discount_value, orderSubtotal);
    }

    res.json({
      success: true,
      valid: true,
      coupon: {
        code: coupon.code,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
        discountAmount,
        minOrderValue: coupon.min_order_value
      },
      message: `Coupon "${coupon.code}" applied! You saved ₹${discountAmount}.`
    });
  } catch (err) {
    console.error('Coupon validation error:', err);
    res.status(500).json({ success: false, error: 'Could not validate coupon.' });
  }
});

module.exports = router;
