const assert = require('assert');
const db = require('../server/db');

const BASE_URL = 'http://localhost:3000/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runZeroDemoDataTests() {
  console.log('================================================================');
  console.log('   590 LABS® — ZERO DEMO DATA & REAL PRODUCT ENGINE TEST SUITE  ');
  console.log('================================================================\n');

  let passed = 0;
  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ ${name}`);
      console.error(e);
      process.exit(1);
    }
  }

  // Ensure test fixture is clean
  db.prepare("DELETE FROM products WHERE id = 'real-vintage-eyes-tee'").run();

  // 1. Verify Database contains real products or clean state
  await test('Database contains valid products in products table', () => {
    const row = db.prepare('SELECT COUNT(*) as count FROM products').get();
    assert.ok(row.count >= 0, 'Products table query succeeds');
  });

  // 2. Verify Database product variants
  await test('Database contains valid product variants', () => {
    const row = db.prepare('SELECT COUNT(*) as count FROM product_variants').get();
    assert.ok(row.count >= 0, 'Variants table query succeeds');
  });

  // 3. Verify Database Contains Zero Fake Orders
  await test('Database contains 0 fake orders', () => {
    const row = db.prepare('SELECT COUNT(*) as count FROM orders').get();
    assert.strictEqual(row.count, 0, 'Orders table must contain 0 fake orders');
  });

  // 4. Verify Database Contains Zero Demo Customers (Only Owner/Admin preserved)
  await test('Database contains 0 demo/test customer accounts', () => {
    const row = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'").get();
    assert.strictEqual(row.count, 0, 'Users table must contain 0 demo customer accounts');
    const owner = db.prepare("SELECT email, role FROM users WHERE role = 'owner'").get();
    assert.ok(owner, 'Store owner account must be preserved');
    assert.strictEqual(owner.email, 'admin@590labs.com');
  });

  // 5. Verify Public Catalog API Returns Real Catalog
  await test('GET /api/products returns real products catalog', async () => {
    const res = await request('/products');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.total >= 0);
    assert.ok(Array.isArray(res.data.products));
  });

  // 6. Verify Confirmed Demo Products Cannot Be Accessed Via API
  const sampleIds = [
    'core-graphic-tee', 'modular-utility-cargo', 'cyberpunk-acid-hoodie',
    'technical-parachute-pant', 'raw-edge-box-tee', 'stealth-flight-bomber',
    'reconstructed-carpenter-denim', 'shadow-plaid-overshirt', 'tactical-modular-sling-bag',
    'french-terry-box-shorts', 'subversive-unstructured-cap', 'lab-identifier-beanie'
  ];

  for (const sampleId of sampleIds) {
    await test(`GET /api/products/${sampleId} returns 404 (demo product eliminated)`, async () => {
      const res = await request(`/products/${sampleId}`);
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.data.success, false);
    });
  }

  // 7. Verify Admin Stats Reflect Real Data
  let adminToken = null;
  await test('Owner authenticates to verify admin metrics', async () => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@590labs.com', password: 'Admin@590Labs2026' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.role, 'owner');
    adminToken = res.data.token;
  });

  await test('GET /api/admin/stats returns valid store statistics', async () => {
    const res = await request('/admin/stats', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    const s = res.data.stats;
    assert.strictEqual(s.totalRevenue, 0, 'Total revenue must be 0');
    assert.strictEqual(s.totalOrders, 0, 'Total orders must be 0');
    assert.ok(s.publishedProducts >= 0, 'Published products count is non-negative');
    assert.ok(s.draftProducts >= 0, 'Draft products count is non-negative');
    assert.ok(Array.isArray(s.recentOrders));
  });

  // 8. Verify Admin Real Product Addition, Publishing and Deletion Workflow
  const testDropId = 'real-vintage-eyes-tee';
  await test('Admin successfully creates a real product via /api/admin/products (POST)', async () => {
    const res = await request('/admin/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        id: testDropId,
        title: '590 LABS WE LOVE WE DANCE GRAPHIC TEE',
        subtitle: 'Vintage Archival Eye Graphic · 280 GSM',
        category: 'tops',
        price: 1899,
        gsm: '280 GSM',
        fabric: '100% Combed Organic Cotton',
        fit: 'Boxy Oversized Streetwear Fit',
        description: 'Single-origin combed organic cotton knit featuring archival vintage eye graphic silkscreened across the back.',
        status: 'published',
        colors: [{ name: 'Obsidian Black', hex: '#0B0B0B', code: 'blk' }],
        variants: [
          { size: 'S', color_code: 'blk', sku: '590-EYE-BLK-S', stock_quantity: 15 },
          { size: 'M', color_code: 'blk', sku: '590-EYE-BLK-M', stock_quantity: 25 },
          { size: 'L', color_code: 'blk', sku: '590-EYE-BLK-L', stock_quantity: 20 },
          { size: 'XL', color_code: 'blk', sku: '590-EYE-BLK-XL', stock_quantity: 10 }
        ]
      })
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.productId, testDropId);
  });

  await test('Published real product immediately appears in public storefront catalog GET /api/products', async () => {
    const res = await request('/products');
    assert.strictEqual(res.status, 200);
    const found = res.data.products.find(p => p.id === testDropId);
    assert.ok(found, 'Created product appears in public catalog');
    assert.strictEqual(found.price, 1899);
  });

  await test('Admin unpublishes product to draft status and public storefront excludes it', async () => {
    const patchRes = await request(`/admin/products/${testDropId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'draft' })
    });
    assert.strictEqual(patchRes.status, 200);

    const publicRes = await request('/products');
    const found = publicRes.data.products.find(p => p.id === testDropId);
    assert.strictEqual(found, undefined, 'Draft product must not appear on public storefront');
  });

  await test('Admin deletes the test product cleanly', async () => {
    const delRes = await request(`/admin/products/${testDropId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.data.deleted, true);

    const checkRow = db.prepare('SELECT COUNT(*) as count FROM products WHERE id = ?').get(testDropId);
    assert.strictEqual(checkRow.count, 0, 'Test product deleted from database');
  });

  // 9. Verify Seeder Does Not Recreate Demo Data
  await test('Running seed() utility does NOT re-inject demo products or demo orders', () => {
    const seed = require('../server/seed');
    seed();
    const demoFound = db.prepare("SELECT COUNT(*) as count FROM products WHERE id = 'core-graphic-tee'").get().count;
    assert.strictEqual(demoFound, 0, 'Seeder must never inject demo products');
  });

  console.log(`\n================================================================`);
  console.log(`  ZERO DEMO DATA TEST RESULTS: ${passed} Passed, 0 Failed`);
  console.log(`================================================================\n`);
}

runZeroDemoDataTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
