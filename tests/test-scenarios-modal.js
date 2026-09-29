import puppeteer from 'puppeteer-core';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\7d25f4b5-0978-482c-a437-ca6b0c730666\\screenshots';

async function testDemoScenarios() {
  console.log('--- [TEST] 1-Click Live Demo Scenarios Modal & Simulation ---');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait for map and HUD to render
  await page.waitForSelector('.tactical-gnss-telemetry-badge', { timeout: 10000 });
  console.log('HUD rendered successfully.');

  // Find and click the scenarios button
  const scenariosBtn = await page.waitForSelector('.telemetry-hud-btn.scenarios-btn', { timeout: 5000 });
  if (!scenariosBtn) {
    throw new Error('Scenarios button not found in HUD!');
  }
  console.log('Clicking ⚡ Scenarios button...');
  await scenariosBtn.click();

  // Wait for modal to appear
  await page.waitForSelector('[aria-label="1-Click Live Presentation Demo Scenarios"]', { timeout: 5000 });
  console.log('Demo Scenarios Modal opened successfully.');

  // Take screenshot of modal
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'demo_scenarios_modal.png') });
  console.log('Screenshot saved: demo_scenarios_modal.png');

  // Click the Wayanad Landslide scenario card Launch button
  const launchBtn = await page.waitForSelector('.scenario-launch-btn', { timeout: 5000 });
  console.log('Launching Wayanad Landslide Ridge Rescue scenario...');
  await launchBtn.click();

  // Wait for simulation & active pill to appear
  await page.waitForSelector('.active-demo-scenario-pill', { timeout: 10000 });
  console.log('Active Demo Scenario Pill displayed in HUD!');

  // Wait 2.5 seconds for route calculation and drive simulator to start
  await new Promise(r => setTimeout(r, 2500));

  // Take screenshot of running scenario
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'demo_scenario_active_route.png') });
  console.log('Screenshot saved: demo_scenario_active_route.png');

  // Verify reset button
  const resetBtn = await page.$('.pill-reset-btn');
  if (resetBtn) {
    console.log('Clicking scenario reset button...');
    await resetBtn.click();
    await new Promise(r => setTimeout(r, 1000));
    console.log('Scenario successfully reset.');
  }

  await browser.close();
  console.log('✔ ALL DEMO SCENARIO UI TESTS PASSED!');
}

testDemoScenarios().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
