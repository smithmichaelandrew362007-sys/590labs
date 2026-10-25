#!/usr/bin/env node
/**
 * 590 LABS® — Secure Initial Owner Account Setup Utility
 * 
 * Controlled, one-time administrator initialization.
 * Permanently locks once an owner account has been established.
 * 
 * Usage:
 *   node server/setup-owner.js <email> <password> [name] [phone]
 * Example:
 *   node server/setup-owner.js owner@590labs.com MySuperSecretPass! "Store Founder" "+91 98765 43210"
 */

const bcrypt = require('bcryptjs');
const db = require('./db');

function setupOwner() {
  console.log('====================================================');
  console.log('   590 LABS® — SECURE INITIAL OWNER ACCOUNT SETUP   ');
  console.log('====================================================\n');

  // 1. Guard: Check if an owner account already exists
  const ownerCheck = db.prepare("SELECT id, email, name FROM users WHERE role = 'owner'").get();
  if (ownerCheck) {
    console.error(' [ACCESS DENIED / SECURITY LOCK]');
    console.error(`An active store Owner account already exists: ${ownerCheck.email} (ID: ${ownerCheck.id}).`);
    console.error('Initial setup is permanently locked and cannot be re-executed.');
    console.error('To add additional administrators, log in as the Owner at /admin and visit the Administrators section.\n');
    process.exit(1);
  }

  // 2. Read arguments
  const args = process.argv.slice(2);
  const email = args[0];
  const password = args[1];
  const name = args[2] || 'Store Owner';
  const phone = args[3] || null;

  if (!email || !password) {
    console.log('Usage: node server/setup-owner.js <email> <password> [name] [phone]');
    console.log('Requirements: Password must be at least 8 characters long.\n');
    process.exit(1);
  }

  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    console.error('Error: Please provide a valid email address.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: Administrator password must be at least 8 characters long for security.');
    process.exit(1);
  }

  // 3. Check if user already exists with this email (e.g. existing customer or admin)
  const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(cleanEmail);
  const passwordHash = bcrypt.hashSync(password, 10);

  if (existing) {
    // Elevate to owner
    db.prepare('UPDATE users SET role = ?, password_hash = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('owner', passwordHash, name.trim(), existing.id);
    
    db.logActivity({ id: existing.id, name: name.trim(), email: cleanEmail }, 'OWNER_INITIALIZED', 'user', existing.id, {
      method: 'CLI_SETUP',
      action: 'ELEVATED_EXISTING_USER'
    });

    console.log(`✓ Account ${cleanEmail} (ID: ${existing.id}) has been elevated to store Owner.`);
  } else {
    // Insert new owner
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, phone)
      VALUES (?, ?, ?, 'owner', ?)
    `);
    const info = stmt.run(name.trim(), cleanEmail, passwordHash, phone ? phone.trim() : null);
    const newId = Number(info.lastInsertRowid);

    db.logActivity({ id: newId, name: name.trim(), email: cleanEmail }, 'OWNER_INITIALIZED', 'user', newId, {
      method: 'CLI_SETUP',
      action: 'NEW_OWNER_CREATED'
    });

    console.log(`✓ New store Owner created successfully: ${cleanEmail} (ID: ${newId}).`);
  }

  console.log('\n--- SETUP PERMANENTLY LOCKED ---');
  console.log('You can now log in securely at: http://localhost:3000/admin/login\n');
}

if (require.main === module) {
  setupOwner();
}

module.exports = setupOwner;
