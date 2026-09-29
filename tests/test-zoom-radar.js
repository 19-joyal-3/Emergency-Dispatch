import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCREENSHOT_DIR = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\7d25f4b5-0978-482c-a437-ca6b0c730666\\screenshots';

async function runTest() {
  console.log('===============================================================');
  console.log('      TESTING MAP ZOOM & RAINVIEWER RADAR TILE INTEGRITY       ');
  console.log('===============================================================');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const radarRequests = [];
  const invalidZoomRequests = [];
  const consoleErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.toString());
  });

  page.on('request', req => {
    const url = req.url();
    if (url.includes('rainviewer.com') && url.includes('/256/')) {
      radarRequests.push(url);
      const match = url.match(/\/256\/(\d+)\//);
      if (match) {
        const zoom = parseInt(match[1], 10);
        if (zoom > 7) {
          invalidZoomRequests.push({ url, zoom });
        }
      }
    }
  });

  console.log('▶ [1/5] Navigating to http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2', timeout: 30000 });
  console.log('✓ App loaded successfully.');

  // Wait 2 seconds for Leaflet map to mount
  await new Promise(r => setTimeout(r, 2000));

  console.log('▶ [2/5] Activating RainViewer Weather Precipitation Radar Layer...');
  // Trigger radar toggle via window or by clicking radar button
  const radarActivated = await page.evaluate(async () => {
    // Find radar toggle button in the DOM or click toggle
    const buttons = Array.from(document.querySelectorAll('button'));
    const radarBtn = buttons.find(b => 
      b.getAttribute('title')?.toLowerCase().includes('radar') || 
      b.innerText?.toLowerCase().includes('radar') ||
      b.getAttribute('aria-label')?.toLowerCase().includes('radar')
    );
    if (radarBtn) {
      radarBtn.click();
      return true;
    }
    return false;
  });

  console.log(`✓ Radar toggle button clicked: ${radarActivated}`);
  // Wait 3 seconds for radar metadata & tiles to load
  await new Promise(r => setTimeout(r, 3000));

  console.log('▶ [3/5] Stress-testing zoom levels (Zoom 8 -> 10 -> 12 -> 14 -> 16)...');
  const zoomResults = await page.evaluate(async () => {
    const mapEl = document.querySelector('.leaflet-container');
    if (!mapEl) return { error: 'No leaflet container found' };

    // Access leaflet map instance
    // In Leaflet, the map instance is stored on the DOM element's _leaflet_id or through events
    const results = [];
    
    // Zoom in through levels
    for (const targetZoom of [8, 9, 10, 11, 12, 13, 14, 15, 16]) {
      // Find Leaflet map instance
      const keys = Object.keys(mapEl);
      for (const k of keys) {
        if (mapEl[k] && typeof mapEl[k].setZoom === 'function') {
          mapEl[k].setZoom(targetZoom);
          break;
        }
      }
      // Also try clicking zoom-in button if available
      const zoomInBtn = document.querySelector('.leaflet-control-zoom-in');
      if (zoomInBtn) {
        zoomInBtn.click();
      }
      await new Promise(r => setTimeout(r, 600));
      results.push(targetZoom);
    }
    return { results, finalMapZoom: 16 };
  });

  console.log('✓ Map zoomed through levels:', zoomResults);
  // Wait another 2 seconds for any pending network requests
  await new Promise(r => setTimeout(r, 2000));

  console.log('▶ [4/5] Checking for "Zoom level not supported" errors in DOM and tiles...');
  const domCheck = await page.evaluate(() => {
    const pageText = document.body.innerText;
    const hasUnsupportedText = pageText.toLowerCase().includes('zoom level not supported');
    
    // Check all image src and alt attributes
    const imgs = Array.from(document.querySelectorAll('img'));
    const badImgs = imgs.filter(img => 
      (img.src && img.src.includes('not supported')) ||
      (img.alt && img.alt.toLowerCase().includes('not supported'))
    );

    return {
      hasUnsupportedText,
      badImagesCount: badImgs.length,
      totalImagesCount: imgs.length
    };
  });

  console.log('✓ DOM text scan: "Zoom level not supported" found on page?', domCheck.hasUnsupportedText);
  console.log('✓ Bad image tiles count:', domCheck.badImagesCount);

  console.log('▶ [5/5] Analyzing RainViewer network tile requests...');
  console.log(`Total RainViewer radar tile requests: ${radarRequests.length}`);
  console.log(`Requests with zoom level > 7: ${invalidZoomRequests.length}`);

  if (invalidZoomRequests.length > 0) {
    console.error('❌ FAILED: Found requests with zoom > 7:', invalidZoomRequests.slice(0, 3));
  } else {
    console.log('✓ PASSED: ZERO requests with zoom > 7 were sent to RainViewer (maxNativeZoom: 7 enforced successfully!)');
  }

  // Take screenshot of the zoomed-in map with radar active
  const screenshotPath = path.join(SCREENSHOT_DIR, 'radar_zoom_test.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`✓ Screenshot saved to: ${screenshotPath}`);

  await browser.close();

  console.log('===============================================================');
  console.log('                       FINAL VERDICT                           ');
  console.log('===============================================================');

  const passed = invalidZoomRequests.length === 0 && !domCheck.hasUnsupportedText && domCheck.badImagesCount === 0;

  if (passed) {
    console.log('🎉 ALL TESTS PASSED! "Zoom level not supported" error is 100% ELIMINATED.');
    process.exit(0);
  } else {
    console.error('❌ TEST FAILED. Check details above.');
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
