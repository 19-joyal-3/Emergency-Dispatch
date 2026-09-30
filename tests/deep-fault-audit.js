import puppeteer from 'puppeteer-core';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function runDeepFaultAudit() {
  console.log('======================================================');
  console.log('         DEEP FAULT & RUNTIME INTEGRITY AUDIT         ');
  console.log('======================================================');

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  const consoleErrors = [];
  const consoleWarnings = [];
  const uncaughtExceptions = [];
  const networkFailures = [];

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(text);
    }
  });

  page.on('pageerror', err => {
    uncaughtExceptions.push(err.toString());
  });

  page.on('requestfailed', req => {
    // Ignore aborted requests that are intentional (e.g. tile aborts when zooming)
    const failure = req.failure();
    if (failure && failure.errorText !== 'net::ERR_ABORTED') {
      networkFailures.push({
        url: req.url(),
        error: failure.errorText
      });
    }
  });

  console.log('▶ [1/6] Loading application http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  console.log('▶ [2/6] Auditing Tab Navigation...');
  const menuBtn = await page.$('.maps-menu-btn');
  console.log('menuBtn found?', !!menuBtn);
  if (menuBtn) {
    await page.evaluate(() => {
      const btn = document.querySelector('.maps-menu-btn');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 600));
  }
  const drawerInfo = await page.evaluate(() => {
    const drawer = document.querySelector('.tab-toolbar.maps-drawer-panel');
    const firstTab = document.querySelector('.tab-btn');
    return {
      drawerExists: !!drawer,
      drawerClasses: drawer ? drawer.className : '',
      firstTabRect: firstTab ? {
        x: firstTab.getBoundingClientRect().x,
        y: firstTab.getBoundingClientRect().y,
        width: firstTab.getBoundingClientRect().width,
        height: firstTab.getBoundingClientRect().height
      } : null
    };
  });
  console.log('drawerInfo:', JSON.stringify(drawerInfo));
  const navTabs = await page.$$('.tab-btn');
  console.log(`Found ${navTabs.length} main navigation tabs.`);
  for (let i = 0; i < navTabs.length; i++) {
    try {
      await page.evaluate(() => {
        const btn = document.querySelector('.maps-menu-btn');
        const drawer = document.querySelector('.tab-toolbar.maps-drawer-panel');
        if (drawer && drawer.classList.contains('drawer-closed') && btn) {
          btn.click();
        }
      });
      await new Promise(r => setTimeout(r, 200));
      await page.evaluate((idx) => {
        const tabs = document.querySelectorAll('.tab-btn');
        if (tabs[idx]) tabs[idx].click();
      }, i);
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      consoleErrors.push(`Failed clicking tab ${i}: ${e.message}`);
    }
  }

  console.log('▶ [3/6] Auditing Command Palette (Ctrl+K)...');
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyK');
  await page.keyboard.up('Control');
  await new Promise(r => setTimeout(r, 600));

  const commandBackdrop = await page.$('.tactical-command-backdrop');
  if (commandBackdrop) {
    console.log('✓ Command Palette opened with Ctrl+K shortcut.');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));
  } else {
    consoleWarnings.push('Command Palette did not open via Ctrl+K shortcut.');
  }

  console.log('▶ [4/6] Auditing KSDMA Modals & Overlays...');
  // Open KSDMA Dam modal
  const damBtn = await page.$('button[title*="KSDMA"]');
  if (damBtn) {
    await damBtn.click();
    await new Promise(r => setTimeout(r, 600));
    const closeBtn = await page.$('.dam-modal-close, button[aria-label="Close modal"]');
    if (closeBtn) await closeBtn.click();
    await new Promise(r => setTimeout(r, 400));
  }

  console.log('▶ [5/6] Auditing Weather Radar Activation...');
  const radarBtn = await page.$('.radar-toggle-btn');
  if (radarBtn) {
    await radarBtn.click();
    await new Promise(r => setTimeout(r, 1200));
    // Toggle back off
    await radarBtn.click();
    await new Promise(r => setTimeout(r, 400));
  }

  console.log('▶ [6/6] Auditing Offline Cache & Storage Quota...');
  const storageInfo = await page.evaluate(async () => {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      return {
        usageMB: ((est.usage || 0) / (1024 * 1024)).toFixed(2),
        quotaMB: ((est.quota || 0) / (1024 * 1024)).toFixed(2)
      };
    }
    return null;
  });
  console.log('Storage estimate:', storageInfo);

  await browser.close();

  console.log('\n======================================================');
  console.log('                    AUDIT RESULTS                     ');
  console.log('======================================================');
  console.log(`Uncaught Page Errors:   ${uncaughtExceptions.length}`);
  console.log(`Console Errors:         ${consoleErrors.length}`);
  console.log(`Network Failures:       ${networkFailures.length}`);
  console.log(`Console Warnings:       ${consoleWarnings.length}`);

  if (uncaughtExceptions.length > 0) {
    console.log('\n❌ UNCAUGHT PAGE ERRORS:');
    uncaughtExceptions.forEach((e, idx) => console.log(`  [${idx + 1}] ${e}`));
  }

  if (consoleErrors.length > 0) {
    console.log('\n⚠️ CONSOLE ERRORS:');
    consoleErrors.forEach((e, idx) => console.log(`  [${idx + 1}] ${e}`));
  }

  if (networkFailures.length > 0) {
    console.log('\n⚠️ FAILED NETWORK REQUESTS:');
    networkFailures.forEach((f, idx) => console.log(`  [${idx + 1}] ${f.url} -> ${f.error}`));
  }

  if (consoleWarnings.length > 0) {
    console.log('\nℹ️ CONSOLE WARNINGS (Sample):');
    consoleWarnings.slice(0, 8).forEach((w, idx) => console.log(`  [${idx + 1}] ${w}`));
  }

  if (uncaughtExceptions.length === 0 && consoleErrors.length === 0 && networkFailures.length === 0) {
    console.log('\n🎉 ZERO FAULTS DETECTED! Application runtime is 100% clean.');
  }
}

runDeepFaultAudit().catch(err => {
  console.error('Audit failed to run:', err);
  process.exit(1);
});
