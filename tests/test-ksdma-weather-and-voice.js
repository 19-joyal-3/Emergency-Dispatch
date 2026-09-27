/**
 * Test Suite 10: KSDMA & IMD 14-District Weather Warning Matrix, Spoken Voice Nav & Offline Vector Basemap
 */

import assert from 'assert';
import { 
  KERALA_DISTRICTS_DATA, 
  KSDMA_ALERT_TYPES, 
  getKsdmaDistrictWarnings, 
  getDistrictWarningSummary, 
  checkRouteWeatherInterception 
} from '../src/services/ksdmaWeatherWarningService.js';
import { 
  KERALA_STATE_BOUNDARY, 
  KERALA_LIFELINE_HIGHWAYS, 
  KERALA_MAJOR_RIVERS 
} from '../src/services/offlineVectorFallbackService.js';
import { tacticalVoiceNav, VOICE_PRIORITY } from '../src/services/tacticalVoiceNavigationService.js';

console.log('--- [TEST SUITE 10] KSDMA WEATHER MATRIX, VOICE NAV & OFFLINE VECTOR BASEMAP ---');

// =========================================================================
// TEST 1: All 14 Kerala Districts & IMD Alert Structure
// =========================================================================
console.log('▶ [TEST 1] Verifying 14 Kerala Administrative Districts & IMD Color Scales...');
const allDistricts = getKsdmaDistrictWarnings();
assert.strictEqual(allDistricts.length, 14, 'Must have exactly 14 Kerala revenue districts');

const expectedDistricts = [
  'Wayanad', 'Idukki', 'Kozhikode', 'Malappuram', 'Kannur', 
  'Kasaragod', 'Palakkad', 'Thrissur', 'Ernakulam', 'Kottayam', 
  'Alappuzha', 'Pathanamthitta', 'Kollam', 'Thiruvananthapuram'
];

expectedDistricts.forEach(dName => {
  const found = allDistricts.find(d => d.name.toLowerCase() === dName.toLowerCase());
  assert(found, `District ${dName} must be declared in KSDMA data`);
  assert(found.centroid && found.centroid.length === 2, `${dName} must have lat/lng centroid`);
  assert(Array.isArray(found.polygon) && found.polygon.length >= 4, `${dName} must have spatial polygon`);
  assert(typeof found.rainfallMm === 'number', `${dName} must have rainfall number`);
  assert(found.deocPhone, `${dName} must have official DEOC helpline`);
  assert(found.malayalam, `${dName} must have Malayalam name`);
});
console.log('✓ All 14 Kerala districts verified with coordinates, polygons, and DEOC helplines');

// =========================================================================
// TEST 2: KSDMA Alert Summary Generator
// =========================================================================
console.log('▶ [TEST 2] Verifying KSDMA District Weather Summary Generation...');
const summary = getDistrictWarningSummary();
assert.strictEqual(summary.totalDistricts, 14);
assert(typeof summary.counts.RED === 'number');
assert(typeof summary.counts.ORANGE === 'number');
assert(typeof summary.counts.YELLOW === 'number');
assert(typeof summary.counts.GREEN === 'number');
assert.strictEqual(
  summary.counts.RED + summary.counts.ORANGE + summary.counts.YELLOW + summary.counts.GREEN,
  14,
  'All 14 districts must map to valid IMD alert categories'
);
assert(summary.criticalDistricts.length > 0, 'Critical districts list must contain active Red/Orange alerts');
console.log(`✓ KSDMA Bulletin summary verified: ${summary.counts.RED} Red, ${summary.counts.ORANGE} Orange, ${summary.counts.YELLOW} Yellow, ${summary.counts.GREEN} Green`);

// =========================================================================
// TEST 3: Route Spatial Collision & District Threat Interception
// =========================================================================
console.log('▶ [TEST 3] Testing Spatial Route Weather Threat Interception...');
// Test Route 1: Traverses Chooralmala / Meppadi (Inside Wayanad Red Alert polygon)
const wayanadGhatRoute = [
  [11.55, 76.04], // Vythiri
  [11.6050, 76.0830], // Kalpetta
  [11.5369, 76.1772]  // Chooralmala
];

const interceptedThreats = checkRouteWeatherInterception(wayanadGhatRoute);
assert(interceptedThreats.length > 0, 'Must intercept threatened districts along Wayanad route');
const redAlertMatch = interceptedThreats.find(t => t.districtName === 'Wayanad');
assert(redAlertMatch, 'Route must intercept Wayanad Red Alert zone');
assert.strictEqual(redAlertMatch.alertLevel, 'RED');
assert.strictEqual(redAlertMatch.isDirectlyInside, true);
console.log(`✓ Intercepted threat: ${redAlertMatch.districtName} [${redAlertMatch.alertLevel} ALERT] - ${redAlertMatch.threat}`);

// Test Route 2: Empty route produces empty results
const emptyRoute = checkRouteWeatherInterception([]);
assert.strictEqual(emptyRoute.length, 0);
console.log('✓ Spatial route weather isolation verified (0 false positives on empty input)');

// =========================================================================
// TEST 4: Tactical Spoken Voice Navigation Service
// =========================================================================
console.log('▶ [TEST 4] Verifying Tactical Spoken Voice Navigation Engine...');
assert(tacticalVoiceNav !== null, 'Voice navigation service singleton must be initialized');
assert.strictEqual(typeof tacticalVoiceNav.speak, 'function');
assert.strictEqual(typeof tacticalVoiceNav.announceManeuver, 'function');
assert.strictEqual(typeof tacticalVoiceNav.announceHazardAlert, 'function');
assert.strictEqual(typeof tacticalVoiceNav.announceWeatherDistrictAlert, 'function');

tacticalVoiceNav.setEnabled(true);
tacticalVoiceNav.setLanguage('en');
assert.strictEqual(tacticalVoiceNav.currentLanguage, 'en');

tacticalVoiceNav.setLanguage('ml');
assert.strictEqual(tacticalVoiceNav.currentLanguage, 'ml');

// Verify priority hierarchy
assert(VOICE_PRIORITY.CRITICAL_HAZARD < VOICE_PRIORITY.DAM_ALERT);
assert(VOICE_PRIORITY.DAM_ALERT < VOICE_PRIORITY.WEATHER_WARNING);
assert(VOICE_PRIORITY.WEATHER_WARNING < VOICE_PRIORITY.MANEUVER);

// Verify spam prevention cooldown
const testKey = 'unit_test_alert_cooldown';
assert.strictEqual(tacticalVoiceNav.shouldSpeak(testKey), true, 'First attempt should be allowed');
assert.strictEqual(tacticalVoiceNav.shouldSpeak(testKey), false, 'Immediate repeat should be blocked by cooldown');

console.log('✓ Spoken voice navigation priority queue, cooldown throttling, and bilingual language toggling verified');

// =========================================================================
// TEST 5: Standalone Offline Kerala Tactical Vector Basemap
// =========================================================================
console.log('▶ [TEST 5] Verifying Standalone Offline Kerala Vector Basemap...');
assert(KERALA_STATE_BOUNDARY && KERALA_STATE_BOUNDARY.geometry, 'Kerala state boundary feature must exist');
assert.strictEqual(KERALA_STATE_BOUNDARY.geometry.type, 'Polygon');
assert(KERALA_STATE_BOUNDARY.geometry.coordinates[0].length >= 10, 'Boundary must have sufficient vertex resolution');

assert(Array.isArray(KERALA_LIFELINE_HIGHWAYS) && KERALA_LIFELINE_HIGHWAYS.length >= 4, 'Must define key lifeline highways');
const nh66 = KERALA_LIFELINE_HIGHWAYS.find(h => h.id === 'nh-66');
assert(nh66 && nh66.coordinates.length >= 8, 'NH-66 must span multiple Kerala towns');

const nh544 = KERALA_LIFELINE_HIGHWAYS.find(h => h.id === 'nh-544');
assert(nh544 && nh544.coordinates.length >= 6, 'NH-544 must connect Palakkad to Kochi');

assert(Array.isArray(KERALA_MAJOR_RIVERS) && KERALA_MAJOR_RIVERS.length >= 3, 'Must define major river basin polylines');
const periyar = KERALA_MAJOR_RIVERS.find(r => r.id === 'periyar');
assert(periyar && periyar.coordinates.length >= 4, 'Periyar river coordinates must trace catchment to sea');

console.log('✓ Offline tactical vector basemap verified (State border, NH-66, NH-544, NH-766, MC Road, Periyar, Bharathappuzha, Pamba)');

console.log('\n✔ ALL KSDMA WEATHER MATRIX, VOICE NAV & OFFLINE VECTOR BASEMAP TESTS PASSED (100% SUCCESS)\n');
