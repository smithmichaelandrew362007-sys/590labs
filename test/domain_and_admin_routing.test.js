/**
 * 590 LABS® — CUSTOM DOMAIN & ADMIN ROUTING VERIFICATION SUITE
 * Tests direct navigation, nested admin routes, SPA fallback, security, and asset paths.
 */

const http = require('http');
const assert = require('assert');
const fs = require('fs');

console.log('================================================================');
console.log('   590 LABS® — CUSTOM DOMAIN & ADMIN ROUTING VERIFICATION SUITE  ');
console.log('================================================================\n');

const BASE = 'http://localhost:3000';

function fetchUrl(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const req = http.request(url, { method }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: data
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

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

async function run() {
  // 1. Direct navigation to /admin
  await test('1. GET /admin serves admin.html with 200 OK and no-cache headers', async () => {
    const res = await fetchUrl('/admin');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('590 LABS® — STORE MANAGEMENT SYSTEM'));
    assert.ok(res.headers['cache-control'].includes('no-cache'));
  });

  // 2. HEAD /admin
  await test('2. HEAD /admin returns 200 OK (for uptime monitors & CDN health checks)', async () => {
    const res = await fetchUrl('/admin', 'HEAD');
    assert.strictEqual(res.status, 200);
  });

  // 3. Direct navigation to /admin/login
  await test('3. GET /admin/login serves admin.html with 200 OK', async () => {
    const res = await fetchUrl('/admin/login');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('adminLoginForm'));
  });

  // 4. Nested route: /admin/products
  await test('4. GET /admin/products serves admin.html for nested section routing', async () => {
    const res = await fetchUrl('/admin/products');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('590 LABS® — STORE MANAGEMENT SYSTEM'));
  });

  // 5. Nested route: /admin/orders
  await test('5. GET /admin/orders serves admin.html for nested order management', async () => {
    const res = await fetchUrl('/admin/orders');
    assert.strictEqual(res.status, 200);
  });

  // 6. Nested route: /admin/inventory
  await test('6. GET /admin/inventory serves admin.html for live inventory routing', async () => {
    const res = await fetchUrl('/admin/inventory');
    assert.strictEqual(res.status, 200);
  });

  // 7. Security: Unauthenticated access to /api/admin/stats returns 401
  await test('7. Knowing /admin URL grants 0 API privileges (strict 401 on protected backend)', async () => {
    const res = await fetchUrl('/api/admin/stats');
    assert.strictEqual(res.status, 401);
  });

  // 8. Security: Unauthenticated access to /api/admin/products returns 401
  await test('8. Protected product management endpoint rejects unauthenticated visitor with 401', async () => {
    const res = await fetchUrl('/api/admin/products');
    assert.strictEqual(res.status, 401);
  });

  // 9. Public storefront preserved
  await test('9. Public storefront at root / returns index.html with 200 OK', async () => {
    const res = await fetchUrl('/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('590 LABS'));
  });

  // 10. Public API preserved
  await test('10. Public product API /api/products returns 200 OK', async () => {
    const res = await fetchUrl('/api/products');
    assert.strictEqual(res.status, 200);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
  });

  // 11. Absolute asset paths resolve cleanly
  await test('11. Absolute asset paths /css/admin.css and /js/admin.js load cleanly with 200 OK', async () => {
    const cssRes = await fetchUrl('/css/admin.css');
    assert.strictEqual(cssRes.status, 200);
    const jsRes = await fetchUrl('/js/admin.js');
    assert.strictEqual(jsRes.status, 200);
  });

  // 12. Reverse proxy support in server/index.js
  await test('12. Trust proxy configured for production HTTPS custom-domain deployment', async () => {
    const serverCode = fs.readFileSync('server/index.js', 'utf8');
    assert.ok(serverCode.includes("app.enable('trust proxy')") || serverCode.includes("trust proxy"));
  });

  console.log('\n================================================================');
  console.log(`  ROUTING TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

run();
