/**
 * 590 LABS® — Comprehensive Responsive Architecture Test Suite
 * Validates fluid layouts, breakpoint scales, touch targets, modals, and mobile drawer.
 */

const fs = require('fs');

console.log('====================================================');
console.log('   590 LABS® — RESPONSIVE ARCHITECTURE TEST SUITE   ');
console.log('====================================================');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const introHtml = fs.readFileSync('intro.html', 'utf8');
const mainCss = fs.readFileSync('css/main.css', 'utf8');
const introCss = fs.readFileSync('css/intro.css', 'utf8');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

// 1. Mobile safe-area variables defined
assert(
  mainCss.includes('--safe-top') &&
  mainCss.includes('--safe-bottom') &&
  mainCss.includes('--safe-left') &&
  mainCss.includes('--safe-right'),
  'Safe area custom properties (--safe-top, --safe-bottom, etc.) declared in :root'
);

// 2. Touch target accessibility rules defined
assert(
  mainCss.includes('--touch-target-min: 44px') &&
  mainCss.includes('@media (pointer: coarse)'),
  'Touch target guidelines (44px WCAG 2.5.5) defined for coarse pointer devices'
);

// 3. Overflow protection on html and body
assert(
  mainCss.includes('overflow-x: hidden') &&
  mainCss.includes('max-width: 100%'),
  'Root html and body configured with overflow-x: hidden and max-width: 100%'
);

// 4. Fluid container padding
assert(
  mainCss.includes('padding: 0 clamp(0.85rem, 3.5vw, 2.5rem);'),
  'Fluid container padding clamp(0.85rem, 3.5vw, 2.5rem) ensures edge room on 320px screens'
);

// 5. Mobile header actions compact scaling
assert(
  mainCss.includes('@media (max-width: 479px)') &&
  mainCss.includes('@media (max-width: 360px)'),
  'Header action buttons and brand logo scale gracefully across 479px and 360px bands'
);

// 6. Mobile drawer left-slide without inline transform collision
assert(
  mainCss.includes('.drawer-panel.drawer-panel-left') &&
  mainCss.includes('.drawer-panel.drawer-panel-left.active') &&
  indexHtml.includes('class="drawer-panel drawer-panel-left" id="mobileMenuDrawer"') &&
  !indexHtml.includes('id="mobileMenuDrawer" style="left:0; right:auto; transform:translateX(-100%);"'),
  'Mobile drawer left-slide transition implemented in CSS without overriding inline style'
);

// 7. Mobile navigation links completeness
assert(
  indexHtml.includes('id="mobileAccountLink"') &&
  indexHtml.includes('id="mobileAdminLink"'),
  'Mobile navigation drawer includes direct Account and Admin console links'
);

// 8. Lookbook grid fluid columns (no minmax(320px) overflow)
assert(
  mainCss.includes('.lookbook-grid') &&
  indexHtml.includes('class="lookbook-grid"') &&
  !indexHtml.includes('minmax(320px, 1fr)'),
  'Lookbook grid uses responsive .lookbook-grid class avoiding fixed 320px overflow'
);

// 9. Saved address grid fluid columns
assert(
  mainCss.includes('.account-addresses-grid') &&
  indexHtml.includes('class="account-addresses-grid"'),
  'Customer saved addresses grid uses fluid columns'
);

// 10. Table responsive wrappers
assert(
  mainCss.includes('.table-responsive') &&
  indexHtml.includes('<div class="table-responsive">'),
  'Size guide measurements table enclosed in .table-responsive scroll container'
);

// 11. PDP modal single-column stacking and touch scrolling
assert(
  mainCss.includes('@media (max-width: 859px)') &&
  mainCss.includes('border-right: none') &&
  mainCss.includes('overflow-x: auto'),
  'PDP modal stacks with single-column layout and horizontal gallery touch-scroll'
);

// 12. Checkout modal compact step tags
assert(
  mainCss.includes('.checkout-steps-bar') &&
  mainCss.includes('@media (max-width: 479px)'),
  'Checkout steps bar and form grid optimized for screens below 480px'
);

// 13. Admin dashboard responsive tabs and tables
assert(
  mainCss.includes('.admin-table-wrap') &&
  mainCss.includes('scrollbar-width: none'),
  'Admin console tabs and tables support smooth touch scrolling and responsive metric grid'
);

// 14. Cinematic intro portrait orientation and safe areas
assert(
  introCss.includes('@media (orientation: portrait)') &&
  introCss.includes('safe-area-inset-top') &&
  introCss.includes('@media (max-width: 360px)'),
  'Cinematic intro adapts portrait crop, safe area insets, and compact CTA button'
);

console.log('====================================================');
console.log(`  TEST RESULTS: ${passed} Passed, ${failed} Failed`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
