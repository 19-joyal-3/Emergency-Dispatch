import puppeteer from 'puppeteer-core';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\7d25f4b5-0978-482c-a437-ca6b0c730666\\screenshots';

async function runSearchTest() {
  console.log('--- [TEST] Interactive Google/Apple Maps Search Bar ---');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on('pageerror', err => {
    console.error('PAGE ERROR:', err.message);
    errors.push(err.message);
  });

  console.log('1. Loading application...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));

  console.log('2. Verifying search input rendered & focusable...');
  const searchInput = await page.waitForSelector('.maps-search-input', { timeout: 5000 });
  if (!searchInput) throw new Error('Search input not found!');
  await searchInput.click();
  await new Promise(r => setTimeout(r, 500));

  const dropdownOpen1 = await page.$('.maps-search-dropdown');
  console.log('Suggestions dropdown opened on focus?', !!dropdownOpen1);

  // Capture screenshot of category discovery dropdown
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'search_bar_categories_dropdown.png') });
  console.log('Saved: search_bar_categories_dropdown.png');

  console.log('3. Typing "Chooralmala" into search bar...');
  await page.type('.maps-search-input', 'Chooralmala');
  await new Promise(r => setTimeout(r, 600));

  const items = await page.$$('.maps-search-dropdown-item');
  console.log('Matching location results count:', items.length);
  if (items.length === 0) throw new Error('No suggestions found for Chooralmala!');

  const firstItemText = await page.evaluate(el => el.innerText, items[0]);
  console.log('Top match:\n' + firstItemText);

  // Capture screenshot of search query results
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'search_bar_results_dropdown.png') });
  console.log('Saved: search_bar_results_dropdown.png');

  console.log('4. Clicking top match to center map & pin...');
  await items[0].click();
  await new Promise(r => setTimeout(r, 1500));

  const popup = await page.$('.maps-pin-popup');
  console.log('Leaflet search pin popup rendered?', !!popup);

  // Capture screenshot of map view with pin & popup
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'search_bar_selected_pin_map.png') });
  console.log('Saved: search_bar_selected_pin_map.png');

  // Dismiss 5 KM Hazard Intercept modal if triggered by search destination
  const modalDismiss = await page.$('.hazard-proximity-intercept-modal .intercept-close-btn, .hazard-proximity-intercept-modal button');
  if (modalDismiss) {
    console.log('Hazard intercept modal triggered on disaster location. Dismissing modal to test clear button...');
    await page.evaluate(() => {
      const closeBtn = document.querySelector('.hazard-proximity-intercept-modal button');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));
  }

  console.log('5. Clicking search clear button ✕...');
  const clearBtn = await page.waitForSelector('.maps-search-clear-btn', { timeout: 3000 });
  await page.evaluate(() => {
    const btn = document.querySelector('.maps-search-clear-btn');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  const valAfterClear = await page.$eval('.maps-search-input', el => el.value);
  console.log('Input value after clear:', JSON.stringify(valAfterClear));
  if (valAfterClear !== '') throw new Error('Search input was not cleared!');

  await browser.close();

  if (errors.length > 0) {
    console.error('ERRORS ENCOUNTERED:', errors);
    process.exit(1);
  } else {
    console.log('\n✔ SEARCH BAR INTERACTION TEST PASSED 100% (0 ERRORS)!');
    process.exit(0);
  }
}

runSearchTest().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
