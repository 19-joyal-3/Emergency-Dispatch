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

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  // 1. Capture clean map view
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'clean_modern_map_view.png') });
  console.log('Saved: clean_modern_map_view.png');

  // 2. Open Route Planner tab and capture
  const routingTab = await page.$('.tab-btn:nth-child(2)');
  if (routingTab) {
    await routingTab.click();
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'clean_modern_route_planner.png') });
    console.log('Saved: clean_modern_route_planner.png');
  }

  await browser.close();
  console.log('Done capturing screenshots.');
}

captureMainUI().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
