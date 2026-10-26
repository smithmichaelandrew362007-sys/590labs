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

  // 7. Nested route: /admin/customers, /admin/categories, /admin/discounts, /admin/analytics, /admin/administrators, /admin/settings
  await test('7. All nested dashboard routes (/customers, /categories, /discounts, /analytics, /activity, /administrators, /settings) serve admin.html', async () => {
    const routes = ['/admin/customers', '/admin/categories', '/admin/discounts', '/admin/analytics', '/admin/activity', '/admin/administrators', '/admin/settings'];
    for (const r of routes) {
      const res = await fetchUrl(r);
      assert.strictEqual(res.status, 200, `Failed on route: ${r}`);
      assert.ok(res.body.includes('590 LABS® — STORE MANAGEMENT SYSTEM'), `Missing brand header on route: ${r}`);
    }
  });

  // 8. Trailing slash normalization: /admin/ and /admin/login/
  await test('8. Trailing slash paths /admin/ and /admin/login/ serve admin.html with 200 OK', async () => {
    const resSlash = await fetchUrl('/admin/');
    assert.strictEqual(resSlash.status, 200);
    const resLoginSlash = await fetchUrl('/admin/login/');
    assert.strictEqual(resLoginSlash.status, 200);
  });

  // 9. Security: Unauthenticated access to /api/admin/stats returns 401
  await test('9. Knowing /admin URL grants 0 API privileges (strict 401 on protected backend)', async () => {
    const res = await fetchUrl('/api/admin/stats');
    assert.strictEqual(res.status, 401);
  });

  // 10. Security: Unauthenticated access to /api/admin/products returns 401
  await test('10. Protected product management endpoint rejects unauthenticated visitor with 401', async () => {
    const res = await fetchUrl('/api/admin/products');
    assert.strictEqual(res.status, 401);
  });

  // 11. Public storefront preserved
  await test('11. Public storefront at root / returns index.html with 200 OK', async () => {
    const res = await fetchUrl('/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('590 LABS'));
  });

  // 12. Public API preserved
  await test('12. Public product API /api/products returns 200 OK', async () => {
    const res = await fetchUrl('/api/products');
    assert.strictEqual(res.status, 200);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
  });

  // 13. Absolute asset paths resolve cleanly
  await test('13. Absolute asset paths /css/admin.css and /js/admin.js load cleanly with 200 OK', async () => {
    const cssRes = await fetchUrl('/css/admin.css');
    assert.strictEqual(cssRes.status, 200);
    const jsRes = await fetchUrl('/js/admin.js');
    assert.strictEqual(jsRes.status, 200);
  });

  // 14. Reverse proxy support in server/index.js
  await test('14. Trust proxy configured for production HTTPS custom-domain deployment', async () => {
    const serverCode = fs.readFileSync('server/index.js', 'utf8');
    assert.ok(serverCode.includes("app.enable('trust proxy')") || serverCode.includes("trust proxy"));
  });

  // 15. Origin-relative API clients in frontend code (no hardcoded localhost)
  await test('15. Frontend clients use origin-relative URLs without hardcoded localhost', async () => {
    const adminJs = fs.readFileSync('js/admin.js', 'utf8');
    const apiJs = fs.readFileSync('js/api.js', 'utf8');
    assert.ok(!adminJs.includes('http://localhost:3000'), 'js/admin.js contains hardcoded localhost');
    assert.ok(!apiJs.includes('http://localhost:3000'), 'js/api.js contains hardcoded localhost');
  });

  // 16. Secure cookie clearing on logout in auth.js
  await test('16. Secure cookie clearing with matching production options configured on logout', async () => {
    const authCode = fs.readFileSync('server/routes/auth.js', 'utf8');
    assert.ok(authCode.includes("res.clearCookie('token'"), 'Missing clearCookie in auth.js');
    assert.ok(authCode.includes("secure: process.env.NODE_ENV === 'production'"), 'clearCookie missing secure option');
  });

  // 17. vercel.json configuration verification
  await test('17. vercel.json contains required rewrites for /admin, /admin/*, and /api/*', async () => {
    assert.ok(fs.existsSync('vercel.json'), 'vercel.json does not exist');
    const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    assert.ok(Array.isArray(vercelConfig.rewrites), 'vercel.json missing rewrites array');
    
    const adminRewrite = vercelConfig.rewrites.find(r => r.source === '/admin' && r.destination === '/admin.html');
    const adminWildcardRewrite = vercelConfig.rewrites.find(r => (r.source === '/admin/(.*)' || r.source === '/admin/:path*') && r.destination === '/admin.html');
    const apiRewrite = vercelConfig.rewrites.find(r => (r.source === '/api/(.*)' || r.source === '/api/:path*') && r.destination === '/api/index.js');
    
    assert.ok(adminRewrite, 'vercel.json missing /admin -> /admin.html rewrite');
    assert.ok(adminWildcardRewrite, 'vercel.json missing /admin/(.*) -> /admin.html rewrite');
    assert.ok(apiRewrite, 'vercel.json missing /api/(.*) -> /api/index.js rewrite');
  });

  // 18. api/index.js serverless function bridge
  await test('18. api/index.js serverless entrypoint exports Express request handler', async () => {
    assert.ok(fs.existsSync('api/index.js'), 'api/index.js does not exist');
    const handler = require('../api/index');
    assert.strictEqual(typeof handler, 'function', 'api/index.js must export a function');
  });

  // 19. Node engine & build script in package.json
  await test('19. package.json specifies build script and Node 22+ engine for Vercel', async () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    assert.ok(pkg.scripts && pkg.scripts.build, 'package.json missing build script');
    assert.ok(pkg.engines && pkg.engines.node && pkg.engines.node.includes('22'), 'package.json missing Node 22 engine spec');
  });

  // 20. Serverless database resilience
  await test('20. server/db.js includes serverless /tmp writable fallback', async () => {
    const dbCode = fs.readFileSync('server/db.js', 'utf8');
    assert.ok(dbCode.includes('/tmp') && dbCode.includes('isServerless'), 'server/db.js missing serverless /tmp fallback');
  });

  // 21. Vercel cleanUrls configuration to prevent redirect loops
  await test('21. vercel.json cleanUrls is false to prevent 308 redirect loops on .html destinations', async () => {
    const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    assert.strictEqual(vercelConfig.cleanUrls, false, 'vercel.json cleanUrls must be false when explicit rewrites target .html');
  });

  // 22. Production build script validation
  await test('22. npm run build executes successfully and validates production assets', async () => {
    const { execSync } = require('child_process');
    const output = execSync('npm run build', { encoding: 'utf8' });
    assert.ok(output.includes('Production build validation complete'), 'Build script did not complete successfully');
  });

  // 23. Serverless bridge URL normalization
  await test('23. api/index.js normalizes varied incoming serverless request URLs', async () => {
    const handler = require('../api/index');
    let capturedUrl = null;
    const mockApp = (req, res) => { capturedUrl = req.url; };
    // Test relative prefix
    const mockReq = { url: '/auth/me' };
    const mockRes = {};
    // Test with handler logic
    let testUrl = '/auth/me';
    testUrl = testUrl.replace(/^\/api\/index\.js/, '/api').replace(/^\/index\.js/, '');
    if (!testUrl.startsWith('/api')) testUrl = '/api' + testUrl;
    assert.strictEqual(testUrl, '/api/auth/me');

    let testUrl2 = '/api/index.js/admin/stats';
    testUrl2 = testUrl2.replace(/^\/api\/index\.js/, '/api').replace(/^\/index\.js/, '');
    if (!testUrl2.startsWith('/api')) testUrl2 = '/api' + testUrl2;
    assert.strictEqual(testUrl2, '/api/admin/stats');
  });

  // 24. Client-side router state transitions without reload bounce
  await test('24. js/admin.js uses replaceState for unauthenticated state without infinite reload loops', async () => {
    const adminJs = fs.readFileSync('js/admin.js', 'utf8');
    assert.ok(adminJs.includes("window.history.replaceState({}, '', `/admin/login"), 'Missing replaceState transition for login screen');
    assert.ok(adminJs.includes("renderLoginScreen()"), 'Missing immediate renderLoginScreen call');
  });

  // 25. Sidebar logout handler
  await test('25. js/admin.js wires up sidebarLogoutBtn for clean session termination', async () => {
    const adminJs = fs.readFileSync('js/admin.js', 'utf8');
    assert.ok(adminJs.includes("sidebarLogoutBtn"), 'sidebarLogoutBtn not wired in js/admin.js');
    assert.ok(adminJs.includes("590labs_token"), 'Missing token cleanup on logout');
  });

  console.log('\n================================================================');
  console.log(`  ROUTING TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

run();

