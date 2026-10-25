const bcrypt = require('bcryptjs');
const db = require('./db');

/**
 * 590 LABS® — Production Database Initialization & Integrity Seeder
 * Ensures required system structures, categories, and owner account exist without inserting demo products or fake data.
 */
function seed() {
  console.log('--- 590 LABS Database Initializer Started ---');

  // 1. Ensure Owner Account Exists
  const userCheck = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('owner');
  if (userCheck.count === 0) {
    console.log('Provisioning primary Store Owner account...');
    const adminPasswordHash = bcrypt.hashSync('Admin@590Labs2026', 10);

    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, phone)
      VALUES (?, ?, ?, 'owner', ?)
    `);

    insertUser.run(
      '590 Labs Superadmin',
      'admin@590labs.com',
      adminPasswordHash,
      '+91 98765 43210'
    );

    console.log('✓ Store Owner provisioned: admin@590labs.com');
  }

  // 2. Ensure Core Streetwear Categories Exist
  const catCheck = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (catCheck.count === 0) {
    console.log('Initializing catalog categories...');
    const insertCat = db.prepare(`
      INSERT INTO categories (name, slug, description, display_order, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);
    insertCat.run('Tops', 'tops', 'Heavyweight tees, luxury hoodies, and architectural longsleeves', 1);
    insertCat.run('Bottoms', 'bottoms', 'Tactical cargo pants, heavy terry sweatpants, and nylon trackpants', 2);
    insertCat.run('Outerwear', 'outerwear', 'Tactical vests, weathered denim jackets, and winter outerwear', 3);
    insertCat.run('Accessories', 'accessories', 'Utility rig bags, crossbody carry gear, and minimalist essentials', 4);
    console.log('✓ Standard categories initialized.');
  }

  console.log('✓ No demo products, fake orders, dummy customers, or placeholder reviews seeded.');
  console.log('--- 590 LABS Database Initialization Complete ---');
}

if (require.main === module) {
  seed();
}

module.exports = seed;
