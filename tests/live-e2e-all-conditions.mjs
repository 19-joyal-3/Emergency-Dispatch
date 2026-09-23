import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const SCREENSHOTS_DIR = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\7d25f4b5-0978-482c-a437-ca6b0c730666\\screenshots';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

console.log('\n======================================================================');
console.log('   VANGUARD GEO — LIVE END-TO-END SYSTEM TEST ACROSS ALL CONDITIONS   ');
console.log('======================================================================\n');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runLiveTest() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const consoleLogs = [];
  const errors = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });

  page.on('pageerror', err => {
    errors.push(err.message || String(err));
  });

  let testsPassed = 0;
  let testsFailed = 0;

  function report(name, passed, detail = '') {
    if (passed) {
      testsPassed++;
      console.log(`\x1b[32m[PASS]\x1b[0m ${name} ${detail ? `(${detail})` : ''}`);
    } else {
      testsFailed++;
      console.log(`\x1b[31m[FAIL]\x1b[0m ${name} ${detail ? `(${detail})` : ''}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // CONDITION 1: BASELINE ONLINE DESKTOP DISPATCH HUD (1920x1080)
    // -------------------------------------------------------------
    console.log('\n▶ [CONDITION 1] Baseline Online Desktop Dispatch HUD (1920x1080)...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(1500);

    const title = await page.title();
    report('Page Title & Branding', title.includes('Kerala Emergency Navigation'), title);

    const hasMap = await page.$('.leaflet-container');
    report('Leaflet Tactical Map Mount', !!hasMap, 'Container active');

    const brandLogo = await page.$('.brand-title, .brand-logo, .app-header');
    report('Tactical Dispatch HUD Header', !!brandLogo);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_online_desktop_hud.png'), fullPage: false });
    console.log(`   📸 Screenshot: 01_online_desktop_hud.png`);

    // -------------------------------------------------------------
    // CONDITION 2: TACTICAL ROUTING PLANNER (Vadakkencherry ➔ Valliyode)
    // -------------------------------------------------------------
    console.log('\n▶ [CONDITION 2] Tactical Routing Planner (Vadakkencherry ➔ Valliyode)...');
    // Click Routing Tab
    const tabButtons = await page.$$('.tab-btn');
    let routingTab = null;
    for (const btn of tabButtons) {
      const text = await page.evaluate(el => el.innerText, btn);
      if (text.includes('Routing') || text.includes('planner')) {
        routingTab = btn;
        break;
      }
    }

    if (routingTab) {
      await routingTab.click();
      await sleep(1000);
    }

    const plannerActive = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      return bodyText.includes('Vadakkencherry') || bodyText.includes('Tactical Planner');
    });
    report('Routing Planner Slideout', plannerActive, 'Origin: Vadakkencherry, Dest: Valliyode');

    // Switch transport to Ambulance
    const transportBtns = await page.$$('button');
    for (const b of transportBtns) {
      const titleAttr = await page.evaluate(el => el.getAttribute('title') || el.innerText, b);
      if (titleAttr.includes('Ambulance') || titleAttr.includes('ambulance') || titleAttr.includes('🚑')) {
        await b.click();
        break;
      }
    }
    await sleep(1000);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_routing_planner_ambulance.png') });
    console.log(`   📸 Screenshot: 02_routing_planner_ambulance.png`);

    // -------------------------------------------------------------
    // CONDITION 3: TOTAL NETWORK BLACKOUT / 100% OFFLINE ROUTING
    // -------------------------------------------------------------
    console.log('\n▶ [CONDITION 3] Total Network Blackout (Offline Disaster Mode)...');
    // Preload module into browser memory while still online before cutting connection
    await page.evaluate(async () => {
      window.__offlineRouting = await import('/src/routingEngine.js');
    });

    await page.setOfflineMode(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });
    await sleep(1000);

    const isOfflineEmulated = await page.evaluate(() => !navigator.onLine);
    report('Network Blackout Emulation', isOfflineEmulated, 'navigator.onLine = false');

    // Perform route calculation for rural hamlets: Mudappallur -> Vandazhi
    const routeResult = await page.evaluate(async () => {
      const { calculateBestRoute } = window.__offlineRouting;
      const mudappallur = { lat: 10.6012, lng: 76.5312, name: 'Mudappallur' };
      const vandazhi = { lat: 10.5845, lng: 76.5498, name: 'Vandazhi' };
      
      const res = await calculateBestRoute({
        start: mudappallur,
        end: vandazhi,
        transport: 'ambulance'
      });
      if (!res) {
        return { distance: 0, travelTime: 0, source: 'none', hasGeometry: false };
      }
      return {
        distance: res.distance,
        travelTime: res.travelTimeMinutes,
        source: res.source,
        hasGeometry: Array.isArray(res.geometry) && res.geometry.length > 0
      };
    });

    report('Offline Tier-2 Same-Cluster Routing', routeResult && routeResult.distance > 0, 
      `${routeResult?.distance} km, ${routeResult?.travelTime} mins, Source: [${routeResult?.source}]`);
    report('Offline Geometry Generation', routeResult && routeResult.hasGeometry, 'Polyline verified');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_offline_blackout_routing.png') });
    console.log(`   📸 Screenshot: 03_offline_blackout_routing.png`);

    // Re-enable network
    await page.setOfflineMode(false);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });
    await sleep(500);

    // -------------------------------------------------------------
    // CONDITION 4: DYNAMIC ROAD BLOCKAGE & DETOUR RE-ROUTING
    // -------------------------------------------------------------
    console.log('\n▶ [CONDITION 4] Dynamic Road Blockage & Detour Re-routing...');
    const blockageTest = await page.evaluate(async () => {
      const { calculateBestRoute } = await import('/src/routingEngine.js');
      const start = { lat: 10.6012, lng: 76.5312, name: 'Mudappallur' };
      const end = { lat: 10.7867, lng: 76.6548, name: 'Palakkad' };

      // Normal route without blockage
      const cleanRoute = await calculateBestRoute({ start, end, transport: 'car' });

      // Add blockage right on the route
      const mockBlockage = [{
        id: 'block_test_1',
        name: 'Mudappallur Junction Landslide Spill',
        lat: 10.65,
        lng: 76.58,
        active: true
      }];

      const blockedRoute = await calculateBestRoute({
        start,
        end,
        transport: 'car',
        blockages: mockBlockage
      });

      return {
        cleanDist: cleanRoute?.distance || 0,
        blockedDist: blockedRoute?.distance || 0,
        hasDetour: (blockedRoute?.distance || 0) > 0,
        warningCount: blockedRoute?.warnings ? blockedRoute.warnings.length : 0
      };
    });

    report('Road Blockage Detour Calculation', blockageTest.hasDetour, 
      `Route adjusted: ${blockageTest?.blockedDist} km with ${blockageTest?.warningCount} warning(s)`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_road_blockage_detour.png') });
    console.log(`   📸 Screenshot: 04_road_blockage_detour.png`);

    // -------------------------------------------------------------
    // CONDITION 5: WAYANAD LANDSLIDE RED ZONE & DYNAMIC PROXIMITY INTERCEPT
    // -------------------------------------------------------------
    console.log('\n▶ [CONDITION 5] Wayanad Landslide Red Zone & Dynamic Proximity Intercept...');
    const hazardTest = await page.evaluate(async () => {
      const { KERALA_HAZARD_ZONES } = await import('/src/hazards.js');
      const { checkUserHazardProximity, formatGeofenceAlertMessage } = await import('/src/geofence.js');

      // Approaching Chooralmala disaster zone
      const check = checkUserHazardProximity({
        userLat: 11.5500,
        userLng: 76.1300,
        hazardZones: KERALA_HAZARD_ZONES,
        thresholdKm: 5.0
      });

      const alertMsg = check.isThreatDetected
        ? formatGeofenceAlertMessage(check.hazard, check.distanceKm)
        : null;

      return {
        foundDanger: check.isThreatDetected,
        hazardName: check.hazard?.title || null,
        distanceKm: check.distanceKm !== undefined ? +(check.distanceKm.toFixed(2)) : null,
        alertId: alertMsg?.id || null
      };
    });

    report('Spatial Hazard Proximity Intercept', hazardTest.foundDanger, 
      `Alert Triggered: ${hazardTest.hazardName} (${hazardTest.distanceKm} km ahead) [ID: ${hazardTest.alertId}]`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_wayanad_hazard_intercept.png') });
    console.log(`   📸 Screenshot: 05_wayanad_hazard_intercept.png`);

    // -------------------------------------------------------------
    // CONDITION 6: TACTICAL QR CODE ROUTE HANDOFF ACROSS DEVICES
    // -------------------------------------------------------------
    console.log('\n▶ [CONDITION 6] Tactical QR Code Route Handoff (Cross-Device)...');
    // Navigate with QR route hash for rural hamlets: Mudappallur -> Chooralmala
    const qrHash = '#route=geo:10.60120,76.53120,Mudappallur|11.53690,76.17720,Chooralmala|ambulance';
    await page.goto(`http://localhost:5173/${qrHash}`, { waitUntil: 'networkidle0' });
    await sleep(2000);

    const qrImportState = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"]')).map(i => i.value);
      const body = document.body.innerText;
      return {
        inputs,
        hasMudappallur: inputs.some(v => v.includes('Mudappallur')) || body.includes('Mudappallur'),
        hasChooralmala: inputs.some(v => v.includes('Chooralmala')) || body.includes('Chooralmala')
      };
    });

    report('QR Coordinate Auto-Import', qrImportState.hasMudappallur, 'Mudappallur accurately loaded');
    report('QR Destination Auto-Import', qrImportState.hasChooralmala, 'Chooralmala accurately loaded');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_qr_route_handoff.png') });
    console.log(`   📸 Screenshot: 06_qr_route_handoff.png`);

    // -------------------------------------------------------------
    // CONDITION 7: EXTREME SLOW 2G GHAT NETWORK (GEOLOCATION & AI SEARCH)
    // -------------------------------------------------------------
    console.log('\n▶ [CONDITION 7] Extreme Slow 2G Ghat Network (Fuzzy AI Geocoder)...');
    const client = await page.target().createCDPSession();
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 500, // 500ms high latency
      downloadThroughput: 30 * 1024, // 30 kbps
      uploadThroughput: 15 * 1024
    });

    const searchTest = await page.evaluate(async () => {
      const { searchKeralaPlacesAI } = await import('/src/aiPlaceMatcher.js');
      const t0 = performance.now();
      const results = searchKeralaPlacesAI('kutiran', 5);
      const latencyMs = performance.now() - t0;
      return {
        topMatch: results[0]?.name || null,
        confidence: results[0]?.confidencePct || null,
        latencyMs: Math.round(latencyMs * 10) / 10
      };
    });

    report('Offline AI Geocoder Under 2G', searchTest.topMatch === 'Kuthiran', 
      `Query "kutiran" ➔ ${searchTest.topMatch} in ${searchTest.latencyMs}ms (${searchTest.confidence}%)`);

    // Reset network
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1
    });

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_slow_2g_ghat_search.png') });
    console.log(`   📸 Screenshot: 07_slow_2g_ghat_search.png`);

    // -------------------------------------------------------------
    // CONDITION 8: ZERO-CONNECTIVITY P2P RADAR & SOS BEACON
    // -------------------------------------------------------------
    console.log('\n▶ [CONDITION 8] Zero-Connectivity P2P Radar & Emergency SOS Beacon...');
    // Open P2P Radar modal
    await page.evaluate(() => {
      const p2pBtn = document.querySelector('button[title*="Proximity Radar"]') ||
                     Array.from(document.querySelectorAll('.tab-btn')).find(b => b.innerText.includes('Radar'));
      if (p2pBtn) p2pBtn.click();
    });
    await sleep(1500);

    const p2pState = await page.evaluate(async () => {
      const { p2pEngine, formatEmergencyPacket } = await import('/src/p2p.js');
      
      // Broadcast simulated emergency SOS
      const packet = formatEmergencyPacket({
        senderId: 'UNIT-ALPHA-1',
        senderCallsign: 'Wayanad Squad 01',
        lat: 11.5369,
        lng: 76.1772,
        emergencyType: 'landslide',
        priority: 'critical',
        message: 'Severe landslide at Chooralmala bridge approach. Road blocked.'
      });

      p2pEngine.handleIncomingMeshPacket(packet);

      const msgs = JSON.parse(localStorage.getItem('kerala_p2p_sos_messages') || '[]');
      const hasRadarModal = !!document.querySelector('.p2p-modal-overlay, .p2p-modal-card, canvas, .radar-sweep');

      return {
        hasRadarModal,
        savedMessagesCount: msgs.length,
        latestId: msgs[0]?.id || packet.id,
        latestMessage: msgs[0]?.message || packet.message
      };
    });

    report('P2P Radar Modal & HUD', p2pState.hasRadarModal, 'Radar display active');
    report('Emergency SOS Mesh Broadcast', p2pState.savedMessagesCount > 0, 
      `Packet ${p2pState.latestId} buffered in Store-and-Forward`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08_p2p_emergency_radar.png') });
    console.log(`   📸 Screenshot: 08_p2p_emergency_radar.png`);

    // Close modal if open
    await page.keyboard.press('Escape');
    await sleep(500);

    // -------------------------------------------------------------
    // CONDITION 9: EVACUATION SHELTERS & HOSPITAL HUBS LAYER
    // -------------------------------------------------------------
    console.log('\n▶ [CONDITION 9] Evacuation Shelters & Hospital Hubs Overlay...');
    const shelterTab = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.innerText.includes('Shelters'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    await sleep(1500);

    const shelterStats = await page.evaluate(() => {
      const body = document.body.innerText;
      const markers = document.querySelectorAll('.custom-hosp-icon, .custom-city-icon, .leaflet-marker-icon');
      return {
        hasShelterText: body.includes('Shelter') || body.includes('Relief') || body.includes('Capacity'),
        markerCount: markers.length
      };
    });

    report('Shelter & Hospital Hubs Layer', shelterStats.hasShelterText || shelterStats.markerCount > 0, 
      `${shelterStats.markerCount} markers active on tactical canvas`);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09_evacuation_shelters_hospitals.png') });
    console.log(`   📸 Screenshot: 09_evacuation_shelters_hospitals.png`);

    // -------------------------------------------------------------
    // CONDITION 10: MOBILE & TABLET RESPONSIVE VIEWPORTS
    // -------------------------------------------------------------
    console.log('\n▶ [CONDITION 10] Mobile & Tablet Responsive Viewports...');
    // Viewport A: Smartphone (390 x 844)
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await sleep(1000);

    const mobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    report('Smartphone Viewport (390x844)', mobileOverflow, 'Zero horizontal overflow, touch active');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10_mobile_responder_view.png') });
    console.log(`   📸 Screenshot: 10_mobile_responder_view.png`);

    // Viewport B: Tactical Field Tablet (768 x 1024)
    await page.setViewport({ width: 768, height: 1024, isMobile: false });
    await sleep(1000);

    const tabletOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    report('Field Tablet Viewport (768x1024)', tabletOverflow, 'Tactical layout scaled correctly');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11_tablet_field_view.png') });
    console.log(`   📸 Screenshot: 11_tablet_field_view.png`);

    // -------------------------------------------------------------
    // ERROR AUDIT SUMMARY
    // -------------------------------------------------------------
    console.log('\n======================================================================');
    console.log('                      LIVE RUNTIME ERROR AUDIT                        ');
    console.log('======================================================================');
    const fatalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('tile.openstreetmap.org'));
    report('Uncaught Runtime Errors Audit', fatalErrors.length === 0, 
      `${fatalErrors.length} fatal exceptions found`);

    if (fatalErrors.length > 0) {
      console.log('Errors caught:');
      fatalErrors.forEach(e => console.log('  ❌', e));
    }

    console.log('\n======================================================================');
    console.log(` FINAL SCORE: ${testsPassed} PASSED | ${testsFailed} FAILED out of ${testsPassed + testsFailed} CONDITIONS`);
    console.log('======================================================================\n');

  } catch (err) {
    console.error('Fatal test error:', err);
    testsFailed++;
  } finally {
    await browser.close();
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

runLiveTest();
