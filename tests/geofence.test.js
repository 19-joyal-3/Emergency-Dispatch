import { isPointInPolygon, findEntitiesInGeofence, checkUserHazardProximity, formatGeofenceAlertMessage } from '../src/geofence.js';

console.log('--- [TEST SUITE 3] DYNAMIC GEOFENCE & PROXIMITY EARLY WARNING ENGINE ---');

// 1. Point in polygon test
const polygon = [
  [10.0, 76.0],
  [10.0, 77.0],
  [11.0, 77.0],
  [11.0, 76.0]
];
const insidePoint = [10.5, 76.5];
const outsidePoint = [12.0, 78.0];

const isInside = isPointInPolygon(insidePoint, polygon);
const isOutside = isPointInPolygon(outsidePoint, polygon);
console.log(`Point [10.5, 76.5] in polygon: ${isInside} (Expected: true)`);
console.log(`Point [12.0, 78.0] in polygon: ${isOutside} (Expected: false)`);

if (!isInside || isOutside) {
  console.error('✗ Point-in-polygon test FAILED');
  process.exit(1);
}
console.log('✓ Point-in-polygon ray casting test PASSED');

// 2. Entities in radius test
const testCustomers = [
  { id: 'c1', name: 'Civilian in Range', lat: 10.005, lng: 76.005 },
  { id: 'c2', name: 'Civilian Far', lat: 11.500, lng: 76.500 }
];
const testResponders = [
  { id: 'r1', name: 'Ambulance 1', lat: 10.008, lng: 76.008 },
  { id: 'r2', name: 'Fire Engine 2', lat: 12.000, lng: 77.000 }
];

const results = findEntitiesInGeofence({
  centerLat: 10.0,
  centerLng: 76.0,
  radiusKm: 3.0,
  customers: testCustomers,
  responders: testResponders
});

console.log(`Found ${results.customers.length} civilians in 3km (Expected: 1)`);
console.log(`Found ${results.responders.length} responders in 3km (Expected: 1)`);
console.log(`Total detected devices: ${results.totalCount} (Expected: 2)`);

if (results.totalCount !== 2) {
  console.error('✗ Entity geofence search test FAILED');
  process.exit(1);
}
console.log('✓ Entity geofence search test PASSED');

// 3. Proximity check test
const userPos = { lat: 10.01, lng: 76.01 };
const incidents = [
  { id: 'inc1', type: 'flood', title: 'Severe Waterlogging', lat: 10.02, lng: 76.02, priority: 'critical', description: 'Deep water covering road' }
];
const check = checkUserHazardProximity({
  userLat: userPos.lat,
  userLng: userPos.lng,
  incidents,
  hazardZones: [],
  thresholdKm: 2.5
});

console.log(`Threat detected for approaching user: ${check.isThreatDetected}`);
console.log(`Distance to hazard: ${check.distanceKm?.toFixed(2)} km`);

if (!check.isThreatDetected) {
  console.error('✗ Proximity check FAILED');
  process.exit(1);
}
console.log('✓ Proximity early warning intercept test PASSED');

// 4. Alert formatting test
const alertMsg = formatGeofenceAlertMessage({
  title: 'Flash Flood Evacuation',
  severity: 'CRITICAL',
  actionAdvice: 'Move immediately to elevated shelter ground.',
  affectedZones: ['Aluva', 'Paravur'],
  safeShelterName: 'UC College Relief Camp'
});

console.log('Formatted Alert ID:', alertMsg.id);
console.log('Formatted Alert Message:', alertMsg.message);
if (alertMsg.id.startsWith('GEO-') && alertMsg.severity === 'CRITICAL') {
  console.log('✓ Geofence evacuation message formatting PASSED');
} else {
  console.error('✗ Geofence alert formatting FAILED');
  process.exit(1);
}

console.log('✓ ALL GEOFENCE & PROXIMITY EARLY WARNING TESTS PASSED!\n');
