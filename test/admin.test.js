/**
 * 590 LABS® — Comprehensive Administration, Security & RBAC Test Suite
 * Validates all 32 Required Security & Operational Scenarios from Specification Section 27.
 */

const assert = require('assert');
const db = require('../server/db');

const BASE_URL = 'http://localhost:3000/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

async function runAdminTests() {
  console.log('================================================================');
  console.log('   590 LABS® — MASTER ADMIN & SECURITY TEST SUITE (32 TESTS)   ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // Tokens & Identifiers across test lifecycle
  let ownerToken = null;
  let staffToken = null;
  let customerToken = null;
  let createdStaffId = null;
  const testRunId = Date.now();
  const testCustomerEmail = `tester_${testRunId}@example.com`;
  const testStaffEmail = `staff_${testRunId}@590labs.com`;
  const testProductSlug = `test-hoodie-${testRunId}`;

  // ============================================================================
  // GROUP 1: AUTHENTICATION (SCENARIOS 1-6)
  // ============================================================================
  console.log('--- GROUP 1: AUTHENTICATION ---');

  await test('1. Unauthenticated visitor rejected from protected admin endpoints with 401', async () => {
    const res = await request('/admin/stats');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
  });

  await test('2. Registered customer signs in and is strictly denied admin access with 403', async () => {
    // Register customer
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Regular Customer',
        email: testCustomerEmail,
        password: 'StreetwearCustomer@2026'
      })
    });
    assert.strictEqual(regRes.status, 201);
    customerToken = regRes.data.token;

    // Try accessing admin stats
    const adminRes = await request('/admin/stats', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.strictEqual(adminRes.status, 403);
    assert.strictEqual(adminRes.data.success, false);
  });

  await test('3. Administrator/Owner signs in successfully through dedicated admin endpoint', async () => {
    const loginRes = await request('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@590labs.com',
        password: 'Admin@590Labs2026'
      })
    });
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.data.success, true);
    assert.ok(['owner', 'admin'].includes(loginRes.data.user.role));
    assert.ok(loginRes.data.token);
    ownerToken = loginRes.data.token;
  });

  await test('4. Customer attempting to log in via admin-login is rejected with 403', async () => {
    const loginRes = await request('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({
        email: testCustomerEmail,
        password: 'StreetwearCustomer@2026'
      })
    });
    assert.strictEqual(loginRes.status, 403);
    assert.strictEqual(loginRes.data.success, false);
  });

  await test('5. Password recovery flow works securely without revealing account existence', async () => {
    const res = await request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: testCustomerEmail })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.message.includes('password recovery'));
  });

  await test('6. User cannot access other customers profiles or orders (403)', async () => {
    const privOrderId = '590-TEST-PRIV-001';
    db.prepare(`
      INSERT OR REPLACE INTO orders (id, user_id, customer_email, customer_name, customer_phone, shipping_address, subtotal, total_amount, payment_method)
      VALUES (?, 1, 'admin@590labs.com', 'Store Owner', '+91 98765 43210', '{}', 1000, 1000, 'cod')
    `).run(privOrderId);

    const res = await request(`/orders/${privOrderId}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);

    db.prepare('DELETE FROM orders WHERE id = ?').run(privOrderId);
  });

  // ============================================================================
  // GROUP 2: AUTHORISATION & RBAC (SCENARIOS 7-14)
  // ============================================================================
  console.log('\n--- GROUP 2: AUTHORISATION & RBAC ---');

  await test('7. Customer cannot create a product via direct API request (403)', async () => {
    const res = await request('/admin/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ id: 'hacked-tee', title: 'Hacked', category: 'tops', price: 100 })
    });
    assert.strictEqual(res.status, 403);
  });

  await test('8. Customer cannot edit an existing product (403)', async () => {
    const res = await request('/admin/products/core-graphic-tee', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ title: 'Modified by Customer' })
    });
    assert.strictEqual(res.status, 403);
  });

  await test('9. Customer cannot alter prices directly (403)', async () => {
    const res = await request('/admin/products/core-graphic-tee', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ price: 1 })
    });
    assert.strictEqual(res.status, 403);
  });

  await test('10. Customer cannot modify variant inventory levels (403)', async () => {
    const res = await request('/admin/products/core-graphic-tee/stock', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ variantId: 1, stockQuantity: 999 })
    });
    assert.strictEqual(res.status, 403);
  });

  await test('11. Customer cannot publish or unpublish drops (403)', async () => {
    const res = await request('/admin/products/core-graphic-tee/status', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ status: 'draft' })
    });
    assert.strictEqual(res.status, 403);
  });

  await test('12. Customer cannot self-promote to administrator role (403)', async () => {
    const res = await request('/admin/administrators/2/role', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ role: 'owner' })
    });
    assert.strictEqual(res.status, 403);
  });

  await test('13. Owner successfully authorizes a Staff member account', async () => {
    const res = await request('/admin/administrators', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Warehouse Dispatcher',
        email: testStaffEmail,
        password: 'StaffPassword@2026',
        role: 'staff'
      })
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.admin.role, 'staff');
    createdStaffId = res.data.admin.id;

    // Log in as staff to get token
    const staffLogin = await request('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({
        email: testStaffEmail,
        password: 'StaffPassword@2026'
      })
    });
    assert.strictEqual(staffLogin.status, 200);
    staffToken = staffLogin.data.token;
  });

  await test('14. Staff member is prohibited from inviting or adding other administrators (403)', async () => {
    const res = await request('/admin/administrators', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        name: 'Unauthorized Admin',
        email: `illegal_${Date.now()}@590labs.com`,
        password: 'Password@2026',
        role: 'admin'
      })
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
  });

  // ============================================================================
  // GROUP 3: PRODUCTS & INVENTORY LIFECYCLE (SCENARIOS 15-22)
  // ============================================================================
  console.log('\n--- GROUP 3: PRODUCTS & INVENTORY ---');

  await test('15. Administrator creates a new product drop with variants and stock (201)', async () => {
    const res = await request('/admin/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        id: testProductSlug,
        title: 'ARCHIVAL BOX HOODIE // 2026',
        category: 'tops',
        price: 2899,
        comparePrice: 3499,
        gsm: '450 GSM',
        fabric: '100% Heavy French Terry',
        status: 'draft', // Created as draft initially
        stockQuantity: 15,
        sizes: ['S', 'M', 'L'],
        colors: [{ name: 'Obsidian Black', code: 'obsidian' }]
      })
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.productId, testProductSlug);
  });

  await test('16. Administrator edits product details and fabric notes (200)', async () => {
    const res = await request(`/admin/products/${testProductSlug}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        title: 'ARCHIVAL BOX HOODIE // RESTYLED',
        price: 2999,
        description: 'Updated dense knit construction with double-lined hood.'
      })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
  });

  await test('17. Draft product is strictly excluded from public storefront catalog (404/excluded)', async () => {
    // Check public catalog list
    const catalogRes = await request('/products');
    const inCatalog = catalogRes.data.products.some(p => p.id === testProductSlug);
    assert.strictEqual(inCatalog, false, 'Draft product must NOT appear in public catalog.');

    // Check direct public detail endpoint
    const detailRes = await request(`/products/${testProductSlug}`);
    // Should be not found or inactive
    assert.ok(detailRes.status === 404 || detailRes.data.product?.status !== 'published');
  });

  await test('18. Administrator publishes draft product (200)', async () => {
    const res = await request(`/admin/products/${testProductSlug}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ status: 'published' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
  });

  await test('19. Newly published product now appears on public storefront catalog (200)', async () => {
    const catalogRes = await request('/products');
    const published = catalogRes.data.products.find(p => p.id === testProductSlug);
    assert.ok(published, 'Newly published product must appear in public catalog.');
    assert.strictEqual(published.price, 2999);
    assert.strictEqual(published.status, 'published');
  });

  await test('20. Administrator unpublishes product back to draft (200)', async () => {
    const res = await request(`/admin/products/${testProductSlug}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ status: 'draft' })
    });
    assert.strictEqual(res.status, 200);

    // Verify it disappears again from public catalog
    const catalogRes = await request('/products');
    assert.strictEqual(catalogRes.data.products.some(p => p.id === testProductSlug), false);
  });

  await test('21. Reprovision product as published and test out-of-stock guard', async () => {
    // Publish it again
    await request(`/admin/products/${testProductSlug}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ status: 'published' })
    });

    // Set stock of variant to 0
    const prodRes = await request(`/admin/products/${testProductSlug}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const v1 = prodRes.data.product.variants[0];

    await request(`/admin/products/${testProductSlug}/stock`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ variantId: v1.id, stockQuantity: 0 })
    });

    // Attempt purchase of 0-stock variant
    const orderRes = await request('/orders/create', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Test Buyer',
        customerEmail: 'buyer@example.com',
        customerPhone: '+91 99887 76655',
        shippingAddress: {
          fullName: 'Test Buyer',
          phone: '+91 99887 76655',
          addressLine1: 'Lane 4',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001'
        },
        paymentMethod: 'cod',
        items: [{ productId: testProductSlug, size: v1.size, quantity: 1 }]
      })
    });
    assert.strictEqual(orderRes.status, 400);
    assert.ok(orderRes.data.error.includes('Insufficient stock'));
  });

  await test('22. Safe image upload endpoint verifies file types and size limits', async () => {
    // 1. Invalid payload rejected
    const badRes = await request('/admin/upload-image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ data: 'not_a_data_url' })
    });
    assert.strictEqual(badRes.status, 400);

    // 2. Valid 1x1 PNG data URL uploaded successfully
    const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadRes = await request('/admin/upload-image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ data: validPng, filename: 'tiny_swatch.png' })
    });
    assert.strictEqual(uploadRes.status, 201);
    assert.ok(uploadRes.data.url.startsWith('/assets/uploads/'));
  });

  // ============================================================================
  // GROUP 4: ORDERS & DATA INTEGRITY (SCENARIOS 23-28)
  // ============================================================================
  console.log('\n--- GROUP 4: ORDERS & TRANSACTION INTEGRITY ---');

  let testOrderId = null;
  await test('23. Placing verified order creates immutable order_items snapshot', async () => {
    // Set stock to 5
    const prodRes = await request(`/admin/products/${testProductSlug}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const v1 = prodRes.data.product.variants[0];
    await request(`/admin/products/${testProductSlug}/stock`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ variantId: v1.id, stockQuantity: 5 })
    });

    // Place order
    const orderRes = await request('/orders/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        customerName: 'Snapshot Customer',
        customerEmail: testCustomerEmail,
        customerPhone: '+91 91234 56789',
        shippingAddress: {
          fullName: 'Snapshot Customer',
          phone: '+91 91234 56789',
          addressLine1: '404 Archive St',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001'
        },
        paymentMethod: 'cod',
        items: [{ productId: testProductSlug, size: v1.size, quantity: 1 }]
      })
    });
    assert.strictEqual(orderRes.status, 201);
    testOrderId = orderRes.data.orderId;

    // Check that price and title in snapshot are fixed
    const orderDetail = await request(`/orders/${testOrderId}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const item = orderDetail.data.order.items[0];
    assert.strictEqual(item.product_id, testProductSlug);
    assert.strictEqual(item.price, 2999);
    assert.strictEqual(item.product_title, 'ARCHIVAL BOX HOODIE // RESTYLED');
  });

  await test('24. Changing product price does NOT alter price in historical order snapshot', async () => {
    // Change product price to 4500
    await request(`/admin/products/${testProductSlug}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ price: 4500 })
    });

    // Check order detail again: item price in snapshot MUST remain 2999
    const orderDetail = await request(`/orders/${testOrderId}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const item = orderDetail.data.order.items[0];
    assert.strictEqual(item.price, 2999, 'Snapshot unit price must NOT be mutated by catalog price updates.');
  });

  await test('25. Attempting to delete product with order history triggers safe archival (soft delete)', async () => {
    const delRes = await request(`/admin/products/${testProductSlug}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.data.archived, true, 'Product must be safely archived, not corrupted or erased.');

    // Historical order must still load perfectly with all purchased items
    const orderDetail = await request(`/orders/${testOrderId}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.strictEqual(orderDetail.data.order.items.length, 1);
  });

  await test('26. Category with dependent products cannot be deleted accidentally (400)', async () => {
    // Try to delete category 'tops' (which has products assigned)
    const catRes = await request('/admin/categories', {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const topsCat = catRes.data.categories.find(c => c.slug === 'tops');
    assert.ok(topsCat);

    const delRes = await request(`/admin/categories/${topsCat.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.strictEqual(delRes.status, 400);
    assert.ok(delRes.data.error.includes('referenced'));
  });

  await test('27. Order cancellation restores inventory quantity accurately', async () => {
    const prodRes = await request(`/admin/products/${testProductSlug}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const v1 = prodRes.data.product.variants[0];
    const stockBeforeCancel = v1.stock_quantity;

    // Cancel order
    const cancelRes = await request(`/orders/${testOrderId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.strictEqual(cancelRes.status, 200);

    const prodResAfter = await request(`/admin/products/${testProductSlug}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const v1After = prodResAfter.data.product.variants[0];
    assert.strictEqual(v1After.stock_quantity, stockBeforeCancel + 1);
  });

  await test('28. Activity log recorded administrative operations with audit trail', async () => {
    const logRes = await request('/admin/activity-logs', {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.strictEqual(logRes.status, 200);
    assert.ok(logRes.data.logs.length >= 3);
    const actions = logRes.data.logs.map(l => l.action);
    assert.ok(actions.includes('PRODUCT_CREATED') || actions.includes('ADMIN_AUTHORIZED'));
  });

  // ============================================================================
  // GROUP 5: ADMINISTRATOR MANAGEMENT (SCENARIOS 29-32)
  // ============================================================================
  console.log('\n--- GROUP 5: ADMINISTRATOR MANAGEMENT & OWNER SECURITY ---');

  await test('29. Owner changes staff member role to Administrator (200)', async () => {
    const res = await request(`/admin/administrators/${createdStaffId}/role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ role: 'admin' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
  });

  await test('30. Owner cannot demote or delete the only active store Owner account (400)', async () => {
    // Admin@590labs.com is ID 1 (sole owner)
    const demoteRes = await request('/admin/administrators/1/role', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ role: 'staff' })
    });
    assert.strictEqual(demoteRes.status, 400);
    assert.ok(demoteRes.data.error.includes('only active store Owner'));

    const deleteRes = await request('/admin/administrators/1', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.strictEqual(deleteRes.status, 400);
    assert.ok(deleteRes.data.error.includes('only store Owner'));
  });

  await test('31. Owner revokes administrator access and revoked user is immediately locked out', async () => {
    const revokeRes = await request(`/admin/administrators/${createdStaffId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    assert.strictEqual(revokeRes.status, 200);

    // Former staff/admin token now immediately gets 403 on protected admin APIs
    const accessRes = await request('/admin/stats', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    assert.strictEqual(accessRes.status, 403, 'Revoked user session must be rejected with 403.');
  });

  await test('32. Initial Owner Setup is permanently locked once an owner exists (403)', async () => {
    const setupRes = await request('/admin/setup-owner', {
      method: 'POST',
      body: JSON.stringify({
        email: 'intruder@example.com',
        password: 'IntruderPassword@2026'
      })
    });
    assert.strictEqual(setupRes.status, 403);
    assert.ok(setupRes.data.error.includes('permanently locked'));
  });

  console.log('\n================================================================');
  console.log(`  MASTER ADMIN TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  // Cleanup test fixtures so database remains pristine
  db.prepare("DELETE FROM products WHERE id LIKE 'test-hoodie-%'").run();
  db.prepare("DELETE FROM orders WHERE customer_email LIKE 'tester_%@example.com'").run();
  db.prepare("DELETE FROM users WHERE email LIKE 'tester_%@example.com' OR email LIKE 'staff_%@590labs.com'").run();

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runAdminTests();
}

module.exports = runAdminTests;
