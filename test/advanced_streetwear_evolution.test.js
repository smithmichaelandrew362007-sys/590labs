/**
 * 590 LABS® — ADVANCED STREETWEAR EVOLUTION TEST SUITE
 * Validates Features 1 through 10 across Frontend, Backend APIs, and Admin Intelligence.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const db = require('../server/db');
const app = require('../server/index');

const PORT = 3999;
let server;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n================================================================');
  console.log('   590 LABS® — ADVANCED STREETWEAR EVOLUTION VERIFICATION SUITE   ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✕ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✕ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Static HTML & UI Architecture Tests
  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  const adminHtml = fs.readFileSync(path.resolve('admin.html'), 'utf8');
  const mainCss = fs.readFileSync(path.resolve('css/main.css'), 'utf8');

  test('1. PDP Gallery includes previous/next navigation buttons', () => {
    assert(indexHtml.includes('id="pdpGalleryPrevBtn"'), 'Missing pdpGalleryPrevBtn');
    assert(indexHtml.includes('id="pdpGalleryNextBtn"'), 'Missing pdpGalleryNextBtn');
  });

  test('2. PDP Gallery includes active image counter and fullscreen lightbox trigger', () => {
    assert(indexHtml.includes('id="pdpGalleryCounter"'), 'Missing pdpGalleryCounter');
    assert(indexHtml.includes('id="pdpGalleryExpandBtn"'), 'Missing pdpGalleryExpandBtn');
  });

  test('3. Fullscreen Lightbox Modal markup is present with zoom controls', () => {
    assert(indexHtml.includes('id="pdpLightboxModal"'), 'Missing pdpLightboxModal');
    assert(indexHtml.includes('id="lightboxZoomToggleBtn"'), 'Missing lightboxZoomToggleBtn');
    assert(indexHtml.includes('id="lightboxCloseBtn"'), 'Missing lightboxCloseBtn');
  });

  test('4. Dual Size actions ("FIND MY SIZE" + "SIZE CHART") are present in PDP', () => {
    assert(indexHtml.includes('id="pdpFindSizeTrigger"'), 'Missing pdpFindSizeTrigger');
    assert(indexHtml.includes('id="pdpSizeGuideTrigger"'), 'Missing pdpSizeGuideTrigger');
  });

  test('5. 590 LABS Fit Lab & Smart Size Finder contains 2 tabs and aesthetic cards', () => {
    assert(indexHtml.includes('id="fitlabTabBtnRec"'), 'Missing fitlabTabBtnRec');
    assert(indexHtml.includes('id="fitlabTabBtnTable"'), 'Missing fitlabTabBtnTable');
    assert(indexHtml.includes('data-fit="boxy"'), 'Missing boxy fit card');
    assert(indexHtml.includes('data-fit="oversized"'), 'Missing oversized fit card');
    assert(indexHtml.includes('id="fitlabHeightRange"'), 'Missing fitlabHeightRange');
    assert(indexHtml.includes('id="fitlabWeightRange"'), 'Missing fitlabWeightRange');
  });

  test('6. PDP includes dedicated Wishlist heart toggle button next to Add to Bag', () => {
    assert(indexHtml.includes('id="pdpWishlistToggleBtn"'), 'Missing pdpWishlistToggleBtn');
    assert(indexHtml.includes('id="pdpWishlistIcon"'), 'Missing pdpWishlistIcon');
  });

  test('7. Out-of-Stock Restock Notification alert form is present in PDP', () => {
    assert(indexHtml.includes('id="pdpStockAlertContainer"'), 'Missing pdpStockAlertContainer');
    assert(indexHtml.includes('id="pdpStockAlertForm"'), 'Missing pdpStockAlertForm');
    assert(indexHtml.includes('id="pdpStockAlertEmail"'), 'Missing pdpStockAlertEmail');
  });

  test('8. PDP Personalized Discovery shelves ("MORE FROM THIS DROP" & "RECENTLY EXPLORED") are present', () => {
    assert(indexHtml.includes('id="pdpDiscoverySection"'), 'Missing pdpDiscoverySection');
    assert(indexHtml.includes('id="pdpRecommendationsGrid"'), 'Missing pdpRecommendationsGrid');
    assert(indexHtml.includes('id="pdpRecentlyViewedContainer"'), 'Missing pdpRecentlyViewedContainer');
  });

  test('9. Scheduled Drop Radar and live launch countdown strip are rendered on Homepage', () => {
    assert(indexHtml.includes('id="dropCountdownStrip"'), 'Missing dropCountdownStrip');
    assert(indexHtml.includes('id="dropLiveCountdown"'), 'Missing dropLiveCountdown');
    assert(indexHtml.includes('id="cdDays"'), 'Missing cdDays');
    assert(indexHtml.includes('id="cdHours"'), 'Missing cdHours');
    assert(indexHtml.includes('id="cdMins"'), 'Missing cdMins');
    assert(indexHtml.includes('id="cdSecs"'), 'Missing cdSecs');
  });

  test('10. Storefront Recently Viewed browsing history section is present', () => {
    assert(indexHtml.includes('id="storefrontRecentlyViewedSection"'), 'Missing storefrontRecentlyViewedSection');
    assert(indexHtml.includes('id="storefrontRecentlyViewedGrid"'), 'Missing storefrontRecentlyViewedGrid');
    assert(indexHtml.includes('id="clearRecentlyViewedBtn"'), 'Missing clearRecentlyViewedBtn');
  });

  test('11. Admin console includes CSV export triggers for Inventory and Orders', () => {
    assert(adminHtml.includes('id="btnExportInventoryCsv"'), 'Missing btnExportInventoryCsv');
    assert(adminHtml.includes('id="btnExportOrdersCsv"'), 'Missing btnExportOrdersCsv');
  });

  test('12. Admin console includes Back-in-Stock Demand Forecasting table and export', () => {
    assert(adminHtml.includes('id="anStockAlertsBody"'), 'Missing anStockAlertsBody');
    assert(adminHtml.includes('id="btnExportStockAlertsCsv"'), 'Missing btnExportStockAlertsCsv');
  });

  test('13. Monochrome design system tokens are strictly maintained in CSS additions', () => {
    assert(mainCss.includes('.drop-countdown-strip'), 'Missing drop-countdown-strip styles');
    assert(mainCss.includes('.pdp-recommendation-card'), 'Missing pdp-recommendation-card styles');
    assert(mainCss.includes('#pdpWishlistToggleBtn.active'), 'Missing wishlist pop styles');
  });

  // Start test server for API endpoint validations
  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });

  try {
    // 14. Stock Alerts API Tests
    await asyncTest('14. POST /api/stock-alerts rejects incomplete payload with 400', async () => {
      const res = await makeRequest('POST', '/api/stock-alerts', { email: 'test@example.com' });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    await asyncTest('15. POST /api/stock-alerts rejects invalid email address with 400', async () => {
      const res = await makeRequest('POST', '/api/stock-alerts', {
        productId: 'music-festival-eye-tee',
        size: 'XL',
        email: 'invalid-email'
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
    });

    await asyncTest('16. POST /api/stock-alerts registers valid restock notification', async () => {
      const res = await makeRequest('POST', '/api/stock-alerts', {
        productId: 'music-festival-eye-tee',
        size: 'XL',
        email: 'collector@590labs.com'
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    });

    await asyncTest('17. POST /api/stock-alerts gracefully acknowledges existing alert', async () => {
      const res = await makeRequest('POST', '/api/stock-alerts', {
        productId: 'music-festival-eye-tee',
        size: 'XL',
        email: 'collector@590labs.com'
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.alreadySubscribed, true);
    });

    await asyncTest('18. GET /api/stock-alerts rejects unauthenticated access with 401', async () => {
      const res = await makeRequest('GET', '/api/stock-alerts');
      assert.strictEqual(res.status, 401);
    });

    // 19. Admin Auth & Stock Alerts Intelligence
    let adminToken = '';
    await asyncTest('19. Admin logs in to inspect demand forecasting metrics', async () => {
      const res = await makeRequest('POST', '/api/auth/login', {
        email: 'admin@590labs.com',
        password: 'Admin@590Labs2026'
      });
      assert.strictEqual(res.status, 200);
      assert(res.body.token, 'Missing admin token');
      adminToken = res.body.token;
    });

    await asyncTest('20. GET /api/stock-alerts provides admin with demand forecasting report', async () => {
      const res = await makeRequest('GET', '/api/stock-alerts', null, {
        Authorization: `Bearer ${adminToken}`
      });
      assert.strictEqual(res.status, 200);
      assert(Array.isArray(res.body.alerts), 'Alerts must be an array');
      assert(res.body.alerts.length > 0, 'Alerts should contain registered item');
      assert(Array.isArray(res.body.topDemands), 'topDemands must be an array');
    });

    // 21. Single Product Details & Related recommendations
    await asyncTest('21. GET /api/products/:id returns related recommendations', async () => {
      const res = await makeRequest('GET', '/api/products/music-festival-eye-tee');
      assert.strictEqual(res.status, 200);
      assert(res.body.product, 'Product must exist');
      assert(Array.isArray(res.body.product.related), 'product.related must be an array');
      assert(res.body.product.related.length > 0, 'product.related must not be empty');
      assert(res.body.product.related.every(p => p.id !== 'music-festival-eye-tee'), 'Related items must not include the current product');
    });

  } finally {
    if (server) server.close();
  }

  console.log('\n================================================================');
  console.log(`  EVOLUTION TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  if (server) server.close();
  process.exit(1);
});
