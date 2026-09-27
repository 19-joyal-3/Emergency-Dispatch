/**
 * KSDMA Live Reservoir & Emergency Operations Centre Test Suite
 * Validates 24-dam telemetry, Rule Curve alert classifications,
 * route flood corridor proximity interceptions, and SEOC (1070) directory.
 */
import assert from 'assert';
import { 
  KSDMA_RESERVOIRS, 
  KSDMA_OFFICIAL_URLS, 
  KSDMA_EMERGENCY_CONTACTS,
  getKsdmaDams,
  getDamsByAgency,
  getDamsWithAlerts,
  checkRouteDamAlertProximity,
  fetchKsdmaDamStatus
} from '../src/services/ksdmaLiveService.js';

console.log('--- [TEST SUITE 9] KSDMA LIVE RESERVOIR & EMERGENCY OPERATIONS ---');

// 1. Dataset Integrity & Rule Curve Thresholds
console.log('▶ [TEST 1] Verifying 24 Monitored KSDMA Reservoirs & Rule Curves...');
assert.strictEqual(KSDMA_RESERVOIRS.length, 24, 'KSDMA must monitor exactly 24 major reservoirs');

const ksebDams = getDamsByAgency('KSEB');
const irrigationDams = getDamsByAgency('IRRIGATION');

assert.strictEqual(ksebDams.length, 10, 'Must have 10 KSEB major hydroelectric dams');
assert.strictEqual(irrigationDams.length, 14, 'Must have 14 Irrigation Department reservoirs');

KSDMA_RESERVOIRS.forEach(dam => {
  assert.ok(dam.id, `Dam must have unique id: ${dam.name}`);
  assert.ok(dam.name, `Dam must have name`);
  assert.ok(dam.malayalam, `Dam must have Malayalam script name: ${dam.name}`);
  assert.ok(dam.frlMeters > 0, `Dam must have valid FRL (m): ${dam.name}`);
  assert.ok(dam.ruleCurveMeters > 0, `Dam must have valid Rule Curve (m): ${dam.name}`);
  assert.ok(dam.currentLevelMeters > 0, `Dam must have valid water level (m): ${dam.name}`);
  assert.ok(dam.storagePercent >= 0 && dam.storagePercent <= 100, `Storage % must be valid: ${dam.name}`);
  assert.ok(['Normal', 'Blue', 'Orange', 'Red'].includes(dam.alertLevel), `Alert must be standard: ${dam.name}`);
  
  // Kerala GPS bounds: Lat 8.0 - 13.0, Lng 74.8 - 77.5
  assert.ok(dam.lat >= 8.0 && dam.lat <= 13.0, `Lat out of Kerala bounds for ${dam.name}: ${dam.lat}`);
  assert.ok(dam.lng >= 74.8 && dam.lng <= 77.5, `Lng out of Kerala bounds for ${dam.name}: ${dam.lng}`);
  assert.ok(dam.downstreamCorridor.length > 10, `Downstream flood plain description required: ${dam.name}`);
});
console.log('✓ 24 Reservoirs metadata, FRLs, and Rule Curves verified');

// 2. Alert Stage Querying
console.log('▶ [TEST 2] Verifying KSDMA Alert Level Stages...');
const activeAlerts = getDamsWithAlerts();
assert.ok(activeAlerts.length > 0, 'Active alerts test setup must have alerted dams');
console.log(`✓ Active Alert Dams detected: ${activeAlerts.map(d => `${d.name} (${d.alertLevel})`).join(', ')}`);

// 3. Downstream River Basin Route Proximity Interception
console.log('▶ [TEST 3] Testing Downstream River Basin Route Collision & Proximity...');
// Route through Panamaram / Padinharethara (Downstream of Banasurasagar Dam in Wayanad)
const wayanadCorridorRoute = [
  [11.6689, 75.9575], // Right at Banasurasagar
  [11.6850, 75.9800],
  [11.7200, 76.0200]  // Panamaram valley
];

const wayanadAlerts = checkRouteDamAlertProximity(wayanadCorridorRoute);
assert.ok(wayanadAlerts.length > 0, 'Route passing through Panamaram must trigger Banasurasagar dam warning');
const banasuraAlert = wayanadAlerts.find(a => a.dam.id === 'banasurasagar');
assert.ok(banasuraAlert, 'Banasurasagar alert must be present');
assert.ok(banasuraAlert.minDistanceKm <= 3.0, 'Distance must be <= 3.0 km');
assert.strictEqual(banasuraAlert.alertLevel, 'Orange');
console.log(`✓ Intercepted threat: ${banasuraAlert.warningMessage}`);

// Safe Route far away in Southern Kerala (Thiruvananthapuram city)
const safeSouthRoute = [
  [8.5000, 76.9500],
  [8.5100, 76.9600],
  [8.5200, 76.9700]
];
const southAlerts = checkRouteDamAlertProximity(safeSouthRoute);
const wayanadFalsePositive = southAlerts.find(a => a.dam.id === 'banasurasagar');
assert.strictEqual(wayanadFalsePositive, undefined, 'South route must not trigger Wayanad dam warning');
console.log('✓ Safe corridor spatial isolation verified (0 false positives)');

// 4. SEOC & DEOC Helplines & URLs
console.log('▶ [TEST 4] Verifying KSDMA SEOC & DEOC Emergency Contacts...');
assert.strictEqual(KSDMA_EMERGENCY_CONTACTS.SEOC.tollFree, '1070', 'SEOC toll free must be 1070');
assert.strictEqual(KSDMA_EMERGENCY_CONTACTS.DEOC_TOLL_FREE, '1077', 'DEOC toll free must be 1077');
assert.ok(KSDMA_EMERGENCY_CONTACTS.SEOC.phones.includes('0471-2364424'), 'SEOC primary phone must match');
assert.strictEqual(KSDMA_OFFICIAL_URLS.HOME, 'https://sdma.kerala.gov.in/', 'Official KSDMA URL must match');
assert.strictEqual(KSDMA_OFFICIAL_URLS.DAM_WATER_LEVELS, 'https://sdma.kerala.gov.in/dam-water-level/', 'Dam water levels URL must match');
console.log('✓ SEOC (1070), DEOC (1077), and official KSDMA web endpoints verified');

// 5. Fetch Service Resilience & Fallback
console.log('▶ [TEST 5] Testing fetchKsdmaDamStatus() Resilience...');
const telemetry = await fetchKsdmaDamStatus();
assert.ok(telemetry.timestamp, 'Telemetry must contain timestamp');
assert.strictEqual(telemetry.dams.length, 24, 'Telemetry must return all 24 dams');
assert.strictEqual(telemetry.summary.total, 24, 'Summary total must be 24');
assert.ok(telemetry.summary.normal > 0, 'Must have normal dams');
assert.ok(telemetry.summary.blue > 0, 'Must have blue alert dams');
assert.ok(telemetry.summary.orange > 0, 'Must have orange alert dams');
console.log(`✓ Telemetry fetch resolved successfully: ${telemetry.source} (${telemetry.summary.total} dams)`);

console.log('✔ ALL KSDMA LIVE RESERVOIR & EMERGENCY OPERATIONS TESTS PASSED (100% SUCCESS)\n');
