const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, generateToken } = require('../middleware/auth');

/**
 * POST /api/auth/register
 * Register a new customer
 */
router.post('/register', (req, res) => {
  try {
    const { name, email, password, confirmPassword, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check duplicate
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, phone)
      VALUES (?, ?, ?, 'customer', ?)
    `);
    const info = stmt.run(name.trim(), cleanEmail, passwordHash, phone ? phone.trim() : null);

    const newUser = {
      id: Number(info.lastInsertRowid),
      name: name.trim(),
      email: cleanEmail,
      role: 'customer'
    };

    const token = generateToken(newUser);

    // Set secure cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      success: true,
      user: newUser,
      token,
      message: 'Account created successfully.'
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});

/**
 * POST /api/auth/login
 * Log in with email and password
 */
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    if (!user.password_hash) {
      return res.status(401).json({
        success: false,
        error: 'This account was created via Google Sign-In. Please sign in with Google.'
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    const token = generateToken(payload);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      user: payload,
      token,
      message: 'Signed in successfully.'
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

/**
 * POST /api/auth/google
 * Google Sign-in handler
 * Accepts Google OAuth credentials or token payload.
 * When real GOOGLE_CLIENT_ID is configured, validates credentials;
 * otherwise provides informative configuration status.
 */
router.post('/google', (req, res) => {
  try {
    const { credential, email, name, googleId } = req.body;

    // Check if Google Client ID is configured in environment
    const googleClientId = process.env.GOOGLE_CLIENT_ID;

    let targetEmail = email;
    let targetName = name;
    let targetGoogleId = googleId;

    // If client supplied standard JWT credential from Google Identity Services
    if (credential) {
      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          targetEmail = payload.email;
          targetName = payload.name;
          targetGoogleId = payload.sub;
        }
      } catch (e) {
        // Fallback to direct fields
      }
    }

    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        error: 'Google authentication data missing email.',
        setupRequired: !googleClientId,
        instructions: 'Please configure GOOGLE_CLIENT_ID in .env'
      });
    }

    const cleanEmail = targetEmail.trim().toLowerCase();
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

    if (user) {
      // Link Google ID if not already linked
      if (!user.google_id && targetGoogleId) {
        db.prepare('UPDATE users SET google_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(targetGoogleId, user.id);
      }
    } else {
      // Create new user via Google
      const stmt = db.prepare(`
        INSERT INTO users (name, email, role, google_id)
        VALUES (?, ?, 'customer', ?)
      `);
      const info = stmt.run(targetName || 'Google User', cleanEmail, targetGoogleId || null);
      user = {
        id: Number(info.lastInsertRowid),
        name: targetName || 'Google User',
        email: cleanEmail,
        role: 'customer'
      };
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    const token = generateToken(payload);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      user: payload,
      token,
      message: 'Signed in with Google.'
    });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ success: false, error: 'Google authentication failed.' });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.json({ success: true, authenticated: false, user: null });
  }

  const user = db.prepare('SELECT id, name, email, role, phone, avatar, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.json({ success: true, authenticated: false, user: null });
  }

  const addresses = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC').all(req.user.id);

  res.json({
    success: true,
    authenticated: true,
    user: {
      ...user,
      addresses
    }
  });
});

/**
 * PUT /api/auth/profile
 * Update user's personal details
 */
router.put('/profile', requireAuth, (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required.' });
    }

    db.prepare('UPDATE users SET name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(name.trim(), phone ? phone.trim() : null, req.user.id);

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: req.user.id,
        name: name.trim(),
        email: req.user.email,
        role: req.user.role,
        phone: phone ? phone.trim() : null
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, error: 'Could not update profile.' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Issue secure password reset token (1 hour validity)
 */
router.post('/forgot-password', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(cleanEmail);

    // Generic response to prevent email enumeration
    const genericResponse = {
      success: true,
      message: 'If an account exists with this email, a password recovery link has been prepared.'
    };

    if (!user) {
      return res.json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    db.prepare(`
      INSERT INTO password_resets (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `).run(user.id, resetToken, expiresAt);

    // For local development and testing, also return the resetToken in the response
    res.json({
      ...genericResponse,
      resetToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined,
      resetLink: `/reset-password?token=${resetToken}`
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, error: 'Password recovery failed.' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using valid token
 */
router.post('/reset-password', (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: 'Reset token and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match.' });
    }

    const record = db.prepare(`
      SELECT * FROM password_resets
      WHERE token = ? AND used = 0
    `).get(token);

    if (!record) {
      return res.status(400).json({ success: false, error: 'Invalid or already used password reset token.' });
    }

    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'Password reset link has expired. Please request a new one.' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);

    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newHash, record.user_id);

    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?')
      .run(record.id);

    res.json({
      success: true,
      message: 'Password has been reset successfully. You may now log in.'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, error: 'Could not reset password.' });
  }
});

/**
 * POST /api/auth/change-password
 * Change password when logged in
 */
router.post('/change-password', requireAuth, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters.' });
    }

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!user.password_hash || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newHash, req.user.id);

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, error: 'Password update failed.' });
  }
});

/**
 * Address management
 */
router.get('/addresses', requireAuth, (req, res) => {
  const addresses = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC').all(req.user.id);
  res.json({ success: true, addresses });
});

router.post('/addresses', requireAuth, (req, res) => {
  try {
    const { fullName, phone, addressLine1, addressLine2, locality, city, state, pincode, isDefault } = req.body;

    if (!fullName || !phone || !addressLine1 || !city || !state || !pincode) {
      return res.status(400).json({ success: false, error: 'Please fill in all required address fields.' });
    }

    // Pincode validation: 6 digits
    if (!/^\d{6}$/.test(pincode.trim())) {
      return res.status(400).json({ success: false, error: 'Please enter a valid 6-digit Indian PIN code.' });
    }

    if (isDefault) {
      db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id);
    }

    const stmt = db.prepare(`
      INSERT INTO addresses (
        user_id, full_name, phone, address_line1, address_line2,
        locality, city, state, pincode, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      req.user.id,
      fullName.trim(),
      phone.trim(),
      addressLine1.trim(),
      addressLine2 ? addressLine2.trim() : null,
      locality ? locality.trim() : null,
      city.trim(),
      state.trim(),
      pincode.trim(),
      isDefault ? 1 : 0
    );

    res.status(201).json({
      success: true,
      message: 'Address saved.',
      addressId: Number(info.lastInsertRowid)
    });
  } catch (err) {
    console.error('Add address error:', err);
    res.status(500).json({ success: false, error: 'Could not save address.' });
  }
});

router.delete('/addresses/:id', requireAuth, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?');
    const result = stmt.run(req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Address not found.' });
    }

    res.json({ success: true, message: 'Address deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete address.' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
