import puppeteer from 'puppeteer-core';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\7d25f4b5-0978-482c-a437-ca6b0c730666\\screenshots';

async function dismissModals(page) {
  await page.evaluate(() => {
    const closeBtns = document.querySelectorAll(
      '.hazard-intercept-close-btn, .btn-hazard-minimize, .poi-modal-close-btn, .modal-close-btn, .sidebar-close-btn, .hazard-modal-close-btn'
    );
    closeBtns.forEach(b => b.click());
    const btns = Array.from(document.querySelectorAll('button'));
    const minBtn = btns.find(b => b.textContent.includes('Minimize') || b.textContent.trim() === '✕');
    if (minBtn) minBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));
}

async function auditMobileAndTablet() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // === 1. MOBILE VIEW (390 x 844 - iPhone / Android) ===
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2200));

  // Dismiss any auto intercept modal if open
  await dismissModals(page);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_main_view_390.png') });
  console.log('Saved: mobile_main_view_390.png');

  // Open Facilities Directory on mobile
  await page.evaluate(() => {
    const browseBtn = document.querySelector('.poi-browse-btn');
    if (browseBtn) browseBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_facilities_modal_390.png') });
  console.log('Saved: mobile_facilities_modal_390.png');

  // Close directory
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.poi-modal-close-btn');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // Open 5km scan on mobile
  await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('.maps-chip'));
    const scanBtn = chips.find(c => c.textContent.includes('5km Scan'));
    if (scanBtn) scanBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_proximity_scan_390.png') });
  console.log('Saved: mobile_proximity_scan_390.png');

  // Close proximity
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.poi-modal-close-btn');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // Open Hazard report on mobile
  await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('.maps-chip'));
    const hBtn = chips.find(c => c.textContent.includes('Hazard'));
    if (hBtn) hBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_hazard_modal_390.png') });
  console.log('Saved: mobile_hazard_modal_390.png');

  // Close hazard
  await page.evaluate(() => {
    const closeBtns = document.querySelectorAll('.poi-modal-close-btn, .hazard-intercept-close-btn, .hazard-modal-close-btn, .modal-close-btn');
    closeBtns.forEach(b => b.click());
    const btns = Array.from(document.querySelectorAll('button'));
    const minBtn = btns.find(b => b.textContent.includes('Minimize') || b.textContent.trim() === '✕');
    if (minBtn) minBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Open Tactical Route Planner on mobile (to test bottom sheet behavior)
  await page.evaluate(() => {
    // Open slide drawer first
    const menuBtn = document.querySelector('.maps-menu-btn');
    if (menuBtn) menuBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => {
    const plannerBtn = Array.from(document.querySelectorAll('.maps-drawer-btn')).find(b => b.textContent.includes('Route Planner'));
    if (plannerBtn) plannerBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile_sidebar_bottom_sheet_390.png') });
  console.log('Saved: mobile_sidebar_bottom_sheet_390.png');

  // Close sidebar on mobile
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.sidebar-close-btn');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // === 2. TABLET VIEW (768 x 1024 - iPad) ===
  await page.setViewport({ width: 768, height: 1024, isMobile: true, hasTouch: true });
  await new Promise(r => setTimeout(r, 600));

  await dismissModals(page);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tablet_main_view_768.png') });
  console.log('Saved: tablet_main_view_768.png');

  // Open Tactical Route Planner on tablet to verify Multi-Pane Split View
  await dismissModals(page);
  await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('.maps-chip'));
    const dirChip = chips.find(c => c.textContent.includes('Directions'));
    if (dirChip) {
      dirChip.click();
    } else {
      const menuBtn = document.querySelector('.maps-menu-btn');
      if (menuBtn) menuBtn.click();
    }
  });
  await new Promise(r => setTimeout(r, 700));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tablet_split_view_planner_768.png') });
  console.log('Saved: tablet_split_view_planner_768.png');

  // Close sidebar on tablet
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.sidebar-close-btn');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // Open Facilities Directory on tablet
  await dismissModals(page);
  await page.evaluate(() => {
    const browseBtn = document.querySelector('.poi-browse-btn');
    if (browseBtn) browseBtn.click();
  });
  await new Promise(r => setTimeout(r, 700));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tablet_facilities_modal_768.png') });
  console.log('Saved: tablet_facilities_modal_768.png');

  await dismissModals(page);

  // Close directory
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.poi-modal-close-btn');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // === 3. DESKTOP VIEW (1440 x 900) ===
  await page.setViewport({ width: 1440, height: 900, isMobile: false, hasTouch: false });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'desktop_main_view_1440.png') });
  console.log('Saved: desktop_main_view_1440.png');

  // Open Multi-Pane Split View on desktop
  await page.evaluate(() => {
    const menuBtn = document.querySelector('.maps-menu-btn');
    if (menuBtn) menuBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => {
    const plannerBtn = Array.from(document.querySelectorAll('.maps-drawer-btn')).find(b => b.textContent.includes('Route Planner'));
    if (plannerBtn) plannerBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'desktop_split_view_1440.png') });
  console.log('Saved: desktop_split_view_1440.png');

  await browser.close();
  console.log('Audit completed!');
}

auditMobileAndTablet().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
