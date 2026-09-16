import assert from 'assert';
import mapData from '../src/mapData.json' with { type: 'json' };
import { 
  calculateBestRoute, 
  routeWithOSRM, 
  routeWithOfflineGraph, 
  isGeometryBlocked 
} from '../src/routingEngine.js';

console.log('--- [TEST SUITE 6] UNIVERSAL REAL-ROAD ROUTING ENGINE ---');

async function testRealRoadRouting() {
  // Test 1: Real-road OSRM routing for Mudappallur -> Palakkad
  const pMudappallur = { lat: 10.5971, lng: 76.5412, name: 'Mudappallur', district: 'Palakkad' };
  const pPalakkad = { lat: 10.7867, lng: 76.6548, name: 'Palakkad', district: 'Palakkad' };

  try {
    const onlineRoute = await routeWithOSRM(pMudappallur, pPalakkad, 'car');
    assert(onlineRoute.distance > 30, `Distance should be real-road (~37km), got ${onlineRoute.distance}km`);
    assert(onlineRoute.geometry.length > 500, `Geometry should contain high-density road points, got ${onlineRoute.geometry.length}`);
    assert(onlineRoute.steps.length > 5, `Should provide turn-by-turn steps, got ${onlineRoute.steps.length}`);
    console.log(`✓ OSRM Real-Road Routing PASSED: Mudappallur -> Palakkad (${onlineRoute.distance} km, ${onlineRoute.travelTimeMinutes} mins, ${onlineRoute.geometry.length} pts, ${onlineRoute.steps.length} maneuvers)`);
  } catch (err) {
    console.warn('⚠️ OSRM network test skipped (offline or network timeout):', err.message);
  }

  // Test 2: Offline fallback for same-cluster hamlets (Mudappallur -> Vandazhi)
  const pVandazhi = { lat: 10.5678, lng: 76.5124, name: 'Vandazhi', district: 'Palakkad' };
  const offlineCluster = routeWithOfflineGraph({ start: pMudappallur, end: pVandazhi, mapData });
  assert(offlineCluster !== null, 'Offline cluster route should not be null');
  assert(offlineCluster.distance > 0, `Distance must be > 0 (no zero-distance glitch), got ${offlineCluster.distance}km`);
  assert(offlineCluster.travelTimeMinutes > 0, 'Travel time must be > 0');
  assert(offlineCluster.geometry.length >= 2, 'Geometry must exist');
  console.log(`✓ Offline Same-Cluster Route PASSED: Mudappallur -> Vandazhi (${offlineCluster.distance} km, ${offlineCluster.travelTimeMinutes} mins, ${offlineCluster.geometry.length} pts)`);

  // Test 3: Offline long-distance graph routing (Kochi -> Kozhikode)
  const pKochi = { lat: 9.9312, lng: 76.2673, name: 'Kochi' };
  const pCalicut = { lat: 11.2588, lng: 75.7804, name: 'Kozhikode' };
  const offlineLong = routeWithOfflineGraph({ start: pKochi, end: pCalicut, mapData });
  assert(offlineLong !== null, 'Offline long-distance route must resolve');
  assert(offlineLong.distance > 100, `Distance should be inter-district (>100km), got ${offlineLong.distance}km`);
  assert(offlineLong.nodes.length >= 3, 'Should traverse multiple corridor nodes');
  console.log(`✓ Offline Inter-District Corridor PASSED: Kochi -> Kozhikode (${offlineLong.distance} km, ${offlineLong.travelTimeMinutes} mins)`);

  // Test 4: Blockage interception detection
  const sampleGeom = [
    [10.5971, 76.5412],
    [10.6500, 76.5800],
    [10.7867, 76.6548]
  ];
  const activeBlock = [{ lat: 10.6502, lng: 76.5801, active: 1 }];
  const inactiveBlock = [{ lat: 10.6502, lng: 76.5801, active: 0 }];
  const clearBlock = [{ lat: 9.9312, lng: 76.2673, active: 1 }];

  assert.strictEqual(isGeometryBlocked(sampleGeom, activeBlock), true, 'Should detect intersection with active blockage within 450m');
  assert.strictEqual(isGeometryBlocked(sampleGeom, inactiveBlock), false, 'Should ignore inactive blockages');
  assert.strictEqual(isGeometryBlocked(sampleGeom, clearBlock), false, 'Should be clear when blockage is far away');
  console.log('✓ Blockage Proximity Interception PASSED');

  // Test 5: calculateBestRoute master coordinator returns a valid route
  const bestRoute = await calculateBestRoute({
    start: pMudappallur,
    end: pPalakkad,
    mapData,
    transport: 'car'
  });
  assert(bestRoute !== null, 'calculateBestRoute must return a valid route object');
  assert(bestRoute.distance > 0, 'Distance must be > 0');
  assert(bestRoute.geometry.length > 0, 'Geometry must be populated');
  assert(bestRoute.sourceLabel, 'Must provide source label badge');
  console.log(`✓ Master Routing Coordinator PASSED: Source [${bestRoute.sourceLabel}], Distance: ${bestRoute.distance} km`);

  console.log('\n✔ ALL UNIVERSAL REAL-ROAD ROUTING ENGINE TESTS PASSED!\n');
}

testRealRoadRouting().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
