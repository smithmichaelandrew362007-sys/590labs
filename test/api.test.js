const assert = require('assert');

const BASE_URL = 'http://localhost:3000/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('   590 LABS® — BACKEND API & INTEGRATION TEST SUITE  ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return (async () => {
      try {
        await fn();
        console.log(`  ✓ ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    Error: ${err.message}`);
        failed++;
      }
    })();
  }

  // 1. Health check
  await test('API Health Check responds with online status', async () => {
    const res = await request('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'online');
    assert.strictEqual(res.data.brand, '590 LABS®');
  });

  // 2. Products Catalog API
  let testProductId = null;
  await test('GET /api/products returns 12 published items with variants', async () => {
    const res = await request('/products');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.products.length, 12);
    const p1 = res.data.products[0];
    assert.ok(p1.id);
    assert.ok(p1.title);
    assert.ok(p1.price > 0);
    assert.ok(p1.availableSizes.length > 0);
    testProductId = p1.id;
  });

  // 3. Product Search and Filter
  await test('GET /api/products?category=bottoms filters accurately', async () => {
    const res = await request('/products?category=bottoms');
    assert.strictEqual(res.status, 200);
    for (const p of res.data.products) {
      assert.strictEqual(p.category.toLowerCase(), 'bottoms');
    }
  });

  await test('GET /api/products?search=cargo finds matching product', async () => {
    const res = await request('/products?search=cargo');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.products.length >= 1);
    assert.ok(res.data.products.some(p => p.id.includes('cargo')));
  });

  // 4. Product Details API
  await test('GET /api/products/:id returns full variants, reviews and related items', async () => {
    const res = await request(`/products/${testProductId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.product.variants.length > 0);
    assert.ok(Array.isArray(res.data.product.related));
  });

  // 5. Coupon validation
  await test('POST /api/coupons/validate validates valid coupon DROP10', async () => {
    const res = await request('/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'DROP10', subtotal: 2000 })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.valid, true);
    assert.strictEqual(res.data.coupon.discountAmount, 200); // 10% of 2000
  });

  await test('POST /api/coupons/validate enforces min_order_value for LABS590', async () => {
    const res = await request('/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'LABS590', subtotal: 1000 }) // requires 2999
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
  });

  // 6. User Registration & Validation
  const testEmail = `collector_${Date.now()}@example.com`;
  let customerToken = null;
  let customerUser = null;

  await test('POST /api/auth/register creates user and returns JWT token', async () => {
    const res = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Arjun Verma',
        email: testEmail,
        password: 'Password@590Labs',
        confirmPassword: 'Password@590Labs',
        phone: '+91 99887 76655'
      })
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.token);
    assert.strictEqual(res.data.user.email, testEmail);
    assert.strictEqual(res.data.user.role, 'customer');
    customerToken = res.data.token;
    customerUser = res.data.user;
  });

  await test('POST /api/auth/register prevents duplicate email registration', async () => {
    const res = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Arjun Verma',
        email: testEmail,
        password: 'Password@590Labs'
      })
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
  });

  // 7. Customer Login
  await test('POST /api/auth/login authenticates with valid credentials', async () => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: 'Password@590Labs'
      })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.token);
  });

  await test('POST /api/auth/login rejects incorrect password safely', async () => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword'
      })
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
  });

  // 8. Protected Customer Endpoints
  await test('GET /api/orders/my-orders rejects unauthenticated requests', async () => {
    const res = await request('/orders/my-orders');
    assert.strictEqual(res.status, 401);
  });

  await test('GET /api/orders/my-orders succeeds with customer Bearer token', async () => {
    const res = await request('/orders/my-orders', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.orders));
  });

  // 9. Order Creation (COD & Razorpay) and Atomic Stock Decrement
  let placedOrderId = null;
  await test('POST /api/orders/create places COD order, decrements stock atomically', async () => {
    // Check initial stock for M
    const pRes = await request(`/products/core-graphic-tee`);
    const initialStockM = pRes.data.product.stock.M;

    const res = await request('/orders/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        customerName: 'Arjun Verma',
        customerEmail: testEmail,
        customerPhone: '+91 99887 76655',
        shippingAddress: {
          fullName: 'Arjun Verma',
          phone: '+91 99887 76655',
          addressLine1: 'Studio 12, Indiranagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560038'
        },
        paymentMethod: 'cod',
        couponCode: 'DROP10',
        items: [
          {
            productId: 'core-graphic-tee',
            title: 'CORE GRAPHIC TEE // 001',
            size: 'M',
            color: 'obsidian',
            quantity: 1
          }
        ]
      })
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.orderId);
    assert.strictEqual(res.data.order.paymentMethod, 'cod');
    assert.strictEqual(res.data.order.fulfillmentStatus, 'confirmed');
    placedOrderId = res.data.orderId;

    // Verify stock decreased by 1
    const pResAfter = await request(`/products/core-graphic-tee`);
    const newStockM = pResAfter.data.product.stock.M;
    assert.strictEqual(newStockM, initialStockM - 1);
  });

  // 10. Order Tracking timeline verification
  await test('GET /api/orders/:id returns order details with live status timeline', async () => {
    const res = await request(`/orders/${placedOrderId}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.order.id, placedOrderId);
    assert.ok(res.data.order.timeline.length >= 4);
    assert.strictEqual(res.data.order.timeline[0].completed, true);
  });

  // 11. Customer Order Cancellation
  await test('POST /api/orders/:id/cancel cancels order and restores inventory', async () => {
    const pBefore = await request(`/products/core-graphic-tee`);
    const stockBefore = pBefore.data.product.stock.M;

    const res = await request(`/orders/${placedOrderId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);

    const pAfter = await request(`/products/core-graphic-tee`);
    assert.strictEqual(pAfter.data.product.stock.M, stockBefore + 1);
  });

  // 12. Admin RBAC and Dashboard
  await test('GET /api/admin/stats rejects normal customer with 403 Forbidden', async () => {
    const res = await request('/admin/stats', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.strictEqual(res.status, 403);
  });

  // Log in as Superadmin
  let adminToken = null;
  await test('POST /api/auth/login authenticates Superadmin account', async () => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@590labs.com',
        password: 'Admin@590Labs2026'
      })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.user.role, 'admin');
    adminToken = res.data.token;
  });

  await test('GET /api/admin/stats succeeds for Superadmin with real store analytics', async () => {
    const res = await request('/admin/stats', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.stats.totalOrders >= 1);
    assert.ok(typeof res.data.stats.totalRevenue === 'number');
    assert.ok(Array.isArray(res.data.stats.lowStockVariants));
  });

  await test('PATCH /api/admin/orders/:id/status updates fulfillment status to in_transit', async () => {
    const res = await request(`/admin/orders/${placedOrderId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        fulfillmentStatus: 'in_transit',
        carrier: 'Delhivery Surface',
        trackingNumber: 'DEL590-TEST-9988'
      })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
  });

  // 13. Password Recovery Flow
  let resetToken = null;
  await test('POST /api/auth/forgot-password generates time-limited reset token', async () => {
    const res = await request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: testEmail })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    resetToken = res.data.resetToken;
    assert.ok(resetToken);
  });

  await test('POST /api/auth/reset-password resets password using valid token', async () => {
    const res = await request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token: resetToken,
        newPassword: 'NewPassword@590Labs2026',
        confirmPassword: 'NewPassword@590Labs2026'
      })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);

    // Verify login with new password
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: 'NewPassword@590Labs2026'
      })
    });
    assert.strictEqual(loginRes.status, 200);
  });

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
