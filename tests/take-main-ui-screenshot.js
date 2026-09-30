import puppeteer from 'puppeteer-core';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\7d25f4b5-0978-482c-a437-ca6b0c730666\\screenshots';

async function captureMainUI() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2200));

  // 1. Capture clean full-screen map view with POI chips and terrain basemap
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'clean_modern_map_view.png') });
  console.log('Saved: clean_modern_map_view.png');

  // 2. Click a POI pin to open the rich details popup
  await page.evaluate(() => {
    const pins = document.querySelectorAll('.custom-poi-marker');
    if (pins.length > 0) {
      pins[0].click();
    }
  });
  await new Promise(r => setTimeout(r, 700));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'poi_marker_popup.png') });
  console.log('Saved: poi_marker_popup.png');

  // 3. Click the Fuel category chip to filter
  await page.evaluate(() => {
    const fuelChip = document.querySelector('.poi-chip-fuel');
    if (fuelChip) fuelChip.click();
  });
  await new Promise(r => setTimeout(r, 700));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'poi_category_filtered_fuel.png') });
  console.log('Saved: poi_category_filtered_fuel.png');

  // Reset to All POIs
  await page.evaluate(() => {
    const allChip = document.querySelector('.poi-chip-all');
    if (allChip) allChip.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // 4. Click Layers chip and capture popover with POI toggle and subchips
  await page.evaluate(() => {
    const layersBtn = document.querySelector('.maps-layers-chip');
    if (layersBtn) layersBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'clean_modern_layers_popover.png') });
  console.log('Saved: clean_modern_layers_popover.png');

  // Close layers menu
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.layers-close-btn');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 300));

  // 5. Open Menu Drawer and navigate to System Console (sync tab)
  await page.evaluate(() => {
    const menuBtn = document.querySelector('.maps-menu-btn');
    if (menuBtn) menuBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // Click Database Sync Console tab
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.tab-btn'));
    const syncTab = tabs.find(t => t.textContent.includes('Sync Console') || t.getAttribute('title')?.includes('Sync'));
    if (syncTab) syncTab.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // If password input is present, log in to admin or unlock system audit
  const emailEl = await page.$('#admin-email');
  if (emailEl) {
    await page.type('#admin-email', 'admin@vanguardgeo.org');
    await page.type('#admin-password', 'resylix2026');
    await page.click('.auth-form button[type="submit"]');
    await new Promise(r => setTimeout(r, 1200));
  }

  // Unlock system client IP audit file
  const unlockBtn = await page.$('.system-audit-card button');
  if (unlockBtn) {
    await unlockBtn.click();
    await new Promise(r => setTimeout(r, 1200));
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'system_client_ip_audit_panel.png') });
  console.log('Saved: system_client_ip_audit_panel.png');

  await browser.close();
  console.log('Done capturing all screenshots.');
}

captureMainUI().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
