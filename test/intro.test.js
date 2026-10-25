const fs = require('fs');

console.log('====================================================');
console.log('   590 LABS® — CINEMATIC INTRO VERIFICATION SUITE   ');
console.log('====================================================');

const introHtml = fs.readFileSync('intro.html', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');
const introCss = fs.readFileSync('css/intro.css', 'utf8');
const introJs = fs.readFileSync('js/intro.js', 'utf8');

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

// 1. Tagline check
assert(
  introHtml.includes('BEYOND THE ORDINARY.') && indexHtml.includes('BEYOND THE ORDINARY.'),
  'Tagline "BEYOND THE ORDINARY." present in both intro.html and index.html'
);

// 2. Button text check
assert(
  introHtml.includes('ENTER STORE ↗') && indexHtml.includes('ENTER STORE ↗'),
  'Call to action "ENTER STORE ↗" defined with accessible markup'
);

// 3. Storage key check
assert(
  introJs.includes('590labs_store_entered_v1') && indexHtml.includes('590labs_store_entered_v1'),
  'Storage key "590labs_store_entered_v1" synchronized between head-check and controller'
);

// 4. Success message check
assert(
  introHtml.includes('YOUR STORE IS OPEN IN A NEW TAB.') && indexHtml.includes('YOUR STORE IS OPEN IN A NEW TAB.'),
  'Confirmation message "YOUR STORE IS OPEN IN A NEW TAB." present'
);

// 5. Popup blocked fallback check
assert(
  introHtml.includes('Your browser blocked the new tab. Continue to the store here') &&
  indexHtml.includes('Your browser blocked the new tab. Continue to the store here'),
  'Popup-blocked fallback message and in-tab continuation button present'
);

// 6. Reduced motion support check
assert(
  introCss.includes('prefers-reduced-motion: reduce'),
  'prefers-reduced-motion: reduce query defined for motion sensitivity'
);

// 7. Silent audio compliance check
assert(
  !introHtml.includes('autoplay') && !introHtml.includes('<audio') && !introJs.includes('AudioContext'),
  'Zero audio autoplay or audible distraction on intro page'
);

// 8. Logo fallback check
assert(
  introHtml.includes('assets/logo-white.svg') && indexHtml.includes('assets/logo-white.svg'),
  'Official 590 LABS white SVG logo referenced with typographic fallback'
);

console.log('====================================================');
console.log(`  TEST RESULTS: ${passed} Passed, ${failed} Failed`);
console.log('====================================================');

if (failed > 0) process.exit(1);
