const assert = require('assert');

const BASE_URL = 'http://localhost:3000/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function testConcurrency() {
  console.log('Testing simultaneous concurrent checkout to prevent overselling...');

  // 1. Log in admin to set a specific variant to exactly 2 units in stock
  const adminRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@590labs.com', password: 'Admin@590Labs2026' })
  });
  const adminToken = adminRes.data.token;

  // Get product variant
  const pRes = await request('/products/lab-identifier-beanie');
  const variant = pRes.data.product.variants[0];

  // Set stock to exactly 2
  await request(`/admin/products/lab-identifier-beanie/stock`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ variantId: variant.id, stockQuantity: 2 })
  });

  // Verify stock is 2
  const pCheck = await request('/products/lab-identifier-beanie');
  console.log('Initial stock set to:', pCheck.data.product.variants[0].stock_quantity);

  // 2. Fire 8 simultaneous checkout requests each attempting to buy 1 unit
  const attempts = 8;
  const promises = [];

  for (let i = 0; i < attempts; i++) {
    promises.push(
      request('/orders/create', {
        method: 'POST',
        body: JSON.stringify({
          customerName: `Buyer ${i}`,
          customerEmail: `buyer${i}@example.com`,
          customerPhone: '+91 99887 76655',
          shippingAddress: {
            fullName: `Buyer ${i}`,
            phone: '+91 99887 76655',
            addressLine1: 'Test Avenue',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400001'
          },
          paymentMethod: 'cod',
          items: [
            {
              productId: 'lab-identifier-beanie',
              size: variant.size,
              color: variant.color_code,
              quantity: 1
            }
          ]
        })
      })
    );
  }

  const results = await Promise.all(promises);

  const successful = results.filter(r => r.status === 201 && r.data.success);
  const rejected = results.filter(r => r.status === 400 && !r.data.success);

  console.log(`Concurrent results: ${successful.length} succeeded, ${rejected.length} rejected safely.`);

  // Assert exactly 2 succeeded and 6 rejected
  assert.strictEqual(successful.length, 2, 'Only 2 orders should succeed since initial stock was 2');
  assert.strictEqual(rejected.length, 6, 'Remaining 6 concurrent attempts must be rejected');

  // Verify remaining stock is 0 (never negative!)
  const pFinal = await request('/products/lab-identifier-beanie');
  const finalStock = pFinal.data.product.variants[0].stock_quantity;
  console.log('Final verified stock in database:', finalStock);
  assert.strictEqual(finalStock, 0, 'Final stock must be exactly 0, preventing overselling');

  console.log('✓ Concurrency test passed: Atomic database transactions prevent overselling perfectly!\n');
}

testConcurrency().catch(err => {
  console.error('Concurrency test failed:', err);
  process.exit(1);
});
