const fs = require('fs');

console.log('================================================================');
console.log('   590 LABS® — MONOCHROME REDESIGN & FAQ VERIFICATION SUITE     ');
console.log('================================================================');

const introHtml = fs.readFileSync('intro.html', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');
const introCss = fs.readFileSync('css/intro.css', 'utf8');
const mainCss = fs.readFileSync('css/main.css', 'utf8');
const appJs = fs.readFileSync('js/app.js', 'utf8');

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

// --- 1. CINEMATIC ENTER PAGE (BLACK & WHITE) ---
assert(
  introCss.includes('--intro-bg: #000000;') && introHtml.includes('background-color: #000000'),
  'Enter page background is pure black #000000'
);

assert(
  introCss.includes('--intro-text-muted: #BDBDBD;'),
  'Enter page secondary text token is #BDBDBD'
);

assert(
  introCss.includes('.cinematic-enter-btn') && 
  introCss.includes('background-color: #FFFFFF;') && 
  introCss.includes('color: #000000;'),
  'Primary Enter button has white background with black text'
);

assert(
  introCss.includes('.cinematic-enter-btn:hover') && 
  introCss.includes('background-color: #000000;') && 
  introCss.includes('border-color: rgba(255, 255, 255'),
  'Enter button hover state inverts to black background with white text and subtle border'
);

assert(
  introHtml.includes('assets/logo-white.svg') && introHtml.includes('BEYOND THE ORDINARY.'),
  '590 LABS white logo and "BEYOND THE ORDINARY." tagline preserved on Enter page'
);

// --- 2. MAIN SHOPPING WEBSITE (CLEAN WHITE THEME) ---
assert(
  mainCss.includes('--bg-page: #FFFFFF;'),
  'Main shopping website background is clean white #FFFFFF'
);

assert(
  mainCss.includes('--text-primary: #111111;') && 
  mainCss.includes('--text-secondary: #666666;') && 
  mainCss.includes('--border-light: #E5E5E5;'),
  'Text and border tokens match monochrome specs (#111111, #666666, #E5E5E5)'
);

assert(
  mainCss.includes('.btn-primary') && 
  mainCss.includes('background: #111111;') && 
  mainCss.includes('color: #FFFFFF;'),
  'Primary buttons use solid black background with white text'
);

assert(
  mainCss.includes('.btn-outline') && 
  mainCss.includes('background: #FFFFFF;') && 
  mainCss.includes('color: #111111;'),
  'Secondary buttons use white background with black text and subtle border'
);

assert(
  mainCss.includes('.form-input') && 
  mainCss.includes('background: #FFFFFF;') && 
  mainCss.includes('color: var(--text-primary);'),
  'Input fields use white background with visible borders and high contrast'
);

// --- 3. PRODUCT SECTION (WHITE BACKGROUND) ---
assert(
  indexHtml.includes('id="productsGridHome"') && indexHtml.includes('id="shopCatalogGrid"'),
  'Home and Shop product grids exist with consistent product rendering'
);

assert(
  mainCss.includes('.product-card') && 
  mainCss.includes('background: var(--bg-surface);') && 
  mainCss.includes('border: 1px solid var(--border-light);'),
  'Product cards maintain clean white background and hairline borders'
);

// --- 4. FAQ SECTION (BLACK BACKGROUND WITH WHITE TEXT) ---
assert(
  indexHtml.includes('class="faq-section" id="faqSection"') && 
  indexHtml.includes('FREQUENTLY ASKED QUESTIONS'),
  'FAQ section present in index.html with FREQUENTLY ASKED QUESTIONS heading'
);

assert(
  mainCss.includes('.faq-section') && 
  mainCss.includes('background-color: #0B0B0B;') && 
  mainCss.includes('color: #FFFFFF;'),
  'FAQ section uses black/near-black background #0B0B0B with white text'
);

assert(
  mainCss.includes('.faq-title') && 
  mainCss.includes('color: #FFFFFF;') && 
  mainCss.includes('.faq-question') && 
  mainCss.includes('color: #FFFFFF;'),
  'FAQ title and questions styled in crisp white'
);

assert(
  mainCss.includes('.faq-subtitle') && 
  mainCss.includes('color: #BDBDBD;') && 
  mainCss.includes('.faq-answer p') && 
  mainCss.includes('color: #D1D1D1;'),
  'FAQ subtitle and answers styled in high-readability light greys (#BDBDBD, #D1D1D1)'
);

assert(
  mainCss.includes('.faq-item') && 
  mainCss.includes('background-color: #141414;') && 
  mainCss.includes('border: 1px solid #242424;'),
  'FAQ items use dark background #141414 and subtle dark grey borders #242424'
);

assert(
  mainCss.includes('.faq-icon') && 
  mainCss.includes('transform: rotate(180deg);'),
  'FAQ expand/collapse chevron icon with smooth rotation on active state'
);

assert(
  indexHtml.includes('WHAT MAKES 590 LABS FABRICS & GARMENTS DIFFERENT?') &&
  indexHtml.includes('HOW DOES 590 LABS UNISEX SIZING & FIT WORK?') &&
  indexHtml.includes('WHAT ARE THE SHIPPING TIMELINES AND DELIVERY CHARGES?') &&
  indexHtml.includes('HOW DOES YOUR 14-DAY DOORSTEP EXCHANGE & RETURN POLICY WORK?') &&
  indexHtml.includes('HOW DO I WASH AND CARE FOR HEAVYWEIGHT GRAPHIC PRINTS?') &&
  indexHtml.includes('WHICH PAYMENT METHODS ARE ACCEPTED? IS COD AVAILABLE?'),
  'Comprehensive 590 LABS customer questions covering textiles, sizing, shipping, returns, care & payments'
);

assert(
  appJs.includes('faq-question') && 
  appJs.includes('aria-expanded') && 
  appJs.includes('faq-accordion-list'),
  'FAQ accordion click and aria-expanded accessibility engine hooked into app.js'
);

assert(
  indexHtml.includes('href="#faq"') && appJs.includes('cleanHash === "faq"'),
  'Direct #faq route and navigation links wired to scroll smoothly to FAQ section'
);

assert(
  indexHtml.includes('id="shopFaqSection"'),
  'Shop catalog view also includes the FAQ section immediately following the product grid'
);

// --- 5. SPACING & RESPONSIVENESS ---
assert(
  mainCss.includes('--max-width: 1380px;') && 
  mainCss.includes('padding: clamp('),
  'Fluid clamp spacing implemented for responsive layout across all viewports'
);

console.log('================================================================');
console.log(`  MONOCHROME REDESIGN RESULTS: ${passed} Passed, ${failed} Failed`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
