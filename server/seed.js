const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

function seed() {
  console.log('--- 590 LABS Database Seeder Started ---');

  // 1. Seed Users
  const userCheck = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCheck.count === 0) {
    console.log('Seeding administrative and demo customer accounts...');
    const adminPasswordHash = bcrypt.hashSync('Admin@590Labs2026', 10);
    const customerPasswordHash = bcrypt.hashSync('Streetwear@2026', 10);

    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, phone)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertUser.run(
      '590 Labs Superadmin',
      'admin@590labs.com',
      adminPasswordHash,
      'owner',
      '+91 98765 43210'
    );

    insertUser.run(
      'Karan Sharma',
      'karan@example.com',
      customerPasswordHash,
      'customer',
      '+91 91234 56789'
    );

    console.log('✓ Users created: admin@590labs.com (Admin@590Labs2026) and karan@example.com (Streetwear@2026)');

    // Seed default address for Karan
    const insertAddr = db.prepare(`
      INSERT INTO addresses (user_id, full_name, phone, address_line1, address_line2, locality, city, state, pincode, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAddr.run(
      2,
      'Karan Sharma',
      '+91 91234 56789',
      'Flat 402, Skyline Residency',
      '14th Main, 4th Sector',
      'HSR Layout',
      'Bengaluru',
      'Karnataka',
      '560102',
      1
    );
  }

  // 2. Seed Products from js/products.js
  const productCheck = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (productCheck.count === 0) {
    console.log('Migrating 12 products from catalog into database...');
    const code = fs.readFileSync(path.resolve(__dirname, '../js/products.js'), 'utf8');
    const fn = new Function(code + '; return PRODUCTS;');
    const catalog = fn();

    const insertProduct = db.prepare(`
      INSERT INTO products (
        id, title, subtitle, category, type, price, compare_price,
        gsm, fabric, fit, description, care, images, badges, specs,
        colors, is_new_drop, is_bestseller, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')
    `);

    const insertVariant = db.prepare(`
      INSERT INTO product_variants (
        product_id, size, color_code, sku, stock_quantity
      ) VALUES (?, ?, ?, ?, ?)
    `);

    for (const p of catalog) {
      insertProduct.run(
        p.id,
        p.title,
        p.subtitle || null,
        p.category,
        p.type || null,
        p.price,
        p.comparePrice || null,
        p.gsm || null,
        p.fabric || null,
        p.fit || null,
        p.description || null,
        p.care || null,
        JSON.stringify(p.images || []),
        JSON.stringify(p.badges || []),
        JSON.stringify(p.specs || []),
        JSON.stringify(p.colors || []),
        p.isNewDrop ? 1 : 0,
        p.isBestseller ? 1 : 0
      );

      // Create variants for all sizes and colors
      const sizes = p.sizes && p.sizes.length > 0 ? p.sizes : ['S', 'M', 'L', 'XL'];
      const colors = p.colors && p.colors.length > 0 ? p.colors : [{ name: 'Black', code: 'blk' }];
      
      const pCode = p.id.split('-').map(w => w[0].toUpperCase()).join('').substring(0, 4);

      for (const col of colors) {
        for (const sz of sizes) {
          const sku = `590-${pCode}-${col.code.toUpperCase().substring(0, 3)}-${sz}`;
          // Get realistic stock or default to realistic streetwear stock numbers
          const stock = (p.stock && p.stock[sz] !== undefined) ? p.stock[sz] : 8;
          try {
            insertVariant.run(p.id, sz, col.code, sku, stock);
          } catch (e) {
            // Variant duplicate guard
          }
        }
      }
    }
    console.log(`✓ ${catalog.length} products and variants seeded successfully.`);
  }

  // 3. Seed Coupons
  const couponCheck = db.prepare('SELECT COUNT(*) as count FROM coupons').get();
  if (couponCheck.count === 0) {
    console.log('Seeding active promotional coupons...');
    const insertCoupon = db.prepare(`
      INSERT INTO coupons (code, discount_type, discount_value, min_order_value, max_discount, usage_limit, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    insertCoupon.run('DROP10', 'percent', 10, 0, 500, 1000);
    insertCoupon.run('LABS590', 'fixed', 590, 2999, 590, 500);
    insertCoupon.run('VIPMEMBER', 'percent', 15, 1999, 1000, 250);
    console.log('✓ Coupons seeded: DROP10 (10% off), LABS590 (₹590 off >₹2999), VIPMEMBER (15% off >₹1999)');
  }

  // 4. Seed Reviews
  const reviewCheck = db.prepare('SELECT COUNT(*) as count FROM reviews').get();
  if (reviewCheck.count === 0) {
    console.log('Seeding authentic customer reviews...');
    const insertReview = db.prepare(`
      INSERT INTO reviews (product_id, user_id, author_name, rating, title, comment, verified_purchase, is_approved)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    insertReview.run(
      'core-graphic-tee',
      2,
      'Karan Sharma',
      5,
      'Unmatched GSM density',
      'The collar thickness is insane. Doesn\'t bacon-neck after wash and the 280 GSM drape feels like high-end Japanese streetwear.',
      1
    );

    insertReview.run(
      'core-graphic-tee',
      null,
      'Rhea M.',
      5,
      'Perfect oversized cut',
      'Ordered an M for a relaxed silhouette. Double silkscreen ink quality is buttery smooth.',
      1
    );

    insertReview.run(
      'modular-utility-cargo',
      2,
      'Karan Sharma',
      5,
      'Tactical detailing on point',
      'The bungee ankle cinches allow switching between wide drape and sneaker stacks effortlessly. 10/10.',
      1
    );

    insertReview.run(
      'cyberpunk-acid-hoodie',
      null,
      'Aditya V.',
      5,
      'Heavy 450 GSM winter armor',
      'No drawstrings on hood gives that clean minimalist Yeezy/Fear of God aesthetic. Best drop so far.',
      1
    );
    console.log('✓ Reviews seeded.');
  }

  // 5. Seed sample order for Karan so order history & tracking has real data
  const orderCheck = db.prepare('SELECT COUNT(*) as count FROM orders').get();
  if (orderCheck.count === 0) {
    console.log('Seeding initial verified customer order for history and tracking test...');
    const orderId = '590-2026-84920';
    const addressJson = JSON.stringify({
      fullName: 'Karan Sharma',
      phone: '+91 91234 56789',
      addressLine1: 'Flat 402, Skyline Residency',
      addressLine2: '14th Main, 4th Sector',
      locality: 'HSR Layout',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560102'
    });

    db.prepare(`
      INSERT INTO orders (
        id, user_id, customer_email, customer_name, customer_phone,
        shipping_address, subtotal, discount, coupon_code, shipping_charge,
        tax_amount, total_amount, payment_method, payment_status,
        fulfillment_status, tracking_number, carrier
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      2,
      'karan@example.com',
      'Karan Sharma',
      '+91 91234 56789',
      addressJson,
      3798,
      380,
      'DROP10',
      0,
      0,
      3418,
      'razorpay',
      'paid',
      'in_transit',
      '590DEL-9843210-BLR',
      'Bluedart Express'
    );

    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, product_title, size, color, price, quantity, image_url, sku
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertOrderItem.run(
      orderId,
      'core-graphic-tee',
      'CORE GRAPHIC TEE // 001',
      'M',
      'Obsidian Black',
      1299,
      1,
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=900&auto=format&fit=crop&q=80',
      '590-CGT-OBS-M'
    );

    insertOrderItem.run(
      orderId,
      'modular-utility-cargo',
      'MODULAR UTILITY CARGO PANT',
      'L',
      'Obsidian Black',
      2499,
      1,
      'https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=900&auto=format&fit=crop&q=80',
      '590-MUC-OBS-L'
    );

    console.log('✓ Order 590-2026-84920 seeded with status in_transit.');
  }

  console.log('--- 590 LABS Database Seeding Complete ---');
}

if (require.main === module) {
  seed();
}

module.exports = seed;
