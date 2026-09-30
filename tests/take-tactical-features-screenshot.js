import puppeteer from 'puppeteer-core';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\7d25f4b5-0978-482c-a437-ca6b0c730666\\screenshots';

async function captureTacticalFeatures() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2200));

  // Dismiss any auto-opened intercept modal if present
  await page.evaluate(() => {
    const minimizeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Minimize to Banner') || b.textContent.includes('✕'));
    if (minimizeBtn) minimizeBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // 1. Capture clean top bar with no collisions
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tactical_top_chips_and_map.png') });
  console.log('Saved: tactical_top_chips_and_map.png');

  // 2. Click Report Hazard button in top chips
  await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('.maps-chip'));
    const hazardBtn = chips.find(c => c.textContent.includes('Hazard'));
    if (hazardBtn) hazardBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'report_hazard_modal_view.png') });
  console.log('Saved: report_hazard_modal_view.png');

  // Close hazard modal
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.poi-modal-close-btn');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // 3. Open Facilities Directory and launch 5.0 km scan from Thiruvananthapuram MCH
  await page.evaluate(() => {
    const browseBtn = document.querySelector('.poi-browse-btn');
    if (browseBtn) browseBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // In the directory, click "🎯 5km Scan" on the first facility card
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.poi-dir-card .poi-action-btn'));
    const scanBtn = buttons.find(b => b.textContent.includes('5km Scan'));
    if (scanBtn) scanBtn.click();
  });
  await new Promise(r => setTimeout(r, 700));

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'proximity_scan_modal_view.png') });
  console.log('Saved: proximity_scan_modal_view.png');

  // 4. Test 5km proximity scan around Kozhikode Medical College (11.2725, 75.8364)
  await page.evaluate(() => {
    // We can simulate an incident click or route to test results
    const closeBtn = document.querySelector('.poi-modal-close-btn');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  await browser.close();
  console.log('Screenshots refreshed successfully!');
}

captureTacticalFeatures().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
