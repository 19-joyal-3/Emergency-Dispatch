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
  await new Promise(r => setTimeout(r, 2000));

  // 1. Capture clean full-screen map view
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'clean_modern_map_view.png') });
  console.log('Saved: clean_modern_map_view.png');

  // 2. Open Menu Drawer and capture
  const menuBtn = await page.$('.maps-menu-btn');
  if (menuBtn) {
    await page.evaluate(() => document.querySelector('.maps-menu-btn').click());
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'clean_modern_drawer_view.png') });
    console.log('Saved: clean_modern_drawer_view.png');
    // Close drawer
    await page.evaluate(() => {
      const closeBtn = document.querySelector('.maps-drawer-close-btn');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));
  }

  // 3. Click Directions chip on floating search card
  await page.evaluate(() => {
    const chip = document.querySelector('.directions-chip');
    if (chip) chip.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'clean_modern_route_planner.png') });
  console.log('Saved: clean_modern_route_planner.png');

  // Close route planner
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.sidebar-close-btn');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // 4. Click Layers chip and capture popover
  await page.evaluate(() => {
    const layersBtn = document.querySelector('.maps-layers-chip');
    if (layersBtn) layersBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'clean_modern_layers_popover.png') });
  console.log('Saved: clean_modern_layers_popover.png');

  await browser.close();
  console.log('Done capturing screenshots.');
}

captureMainUI().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
