import { searchKeralaPlacesAI, findClosestGraphNode } from '../src/aiPlaceMatcher.js';
import mapData from '../src/mapData.json' with { type: 'json' };
import { solveDijkstra } from '../src/routing.js';

console.log('--- [TEST SUITE 5] KERALA AI PLACE MATCHER & ROAD NETWORK ROUTING ---');

// Test 1: Exact Place Matching
const exactResults = searchKeralaPlacesAI('Chooralmala');
console.log(`Found ${exactResults.length} matches for "Chooralmala":`);
if (exactResults.length === 0 || exactResults[0].name !== 'Chooralmala') {
  console.error('✗ Exact match for Chooralmala FAILED');
  process.exit(1);
}
console.log(`✓ Exact match PASSED: ${exactResults[0].name} (${exactResults[0].district}) - Confidence: ${exactResults[0].confidencePct}%`);
if (!exactResults[0].isDisasterZone) {
  console.error('✗ Chooralmala should be identified as a disaster hotspot');
  process.exit(1);
}
console.log('✓ Disaster hotspot detection PASSED');

// Test 2: Fuzzy Matching with Typos and Phonetic Transliteration
const typos = [
  { query: 'choralmala', expected: 'Chooralmala' },
  { query: 'mundakai', expected: 'Mundakkai' },
  { query: 'mepadi', expected: 'Meppadi' },
  { query: 'kutanad', expected: 'Kuttanad' },
  { query: 'vytila', expected: 'Vytilla' },
  { query: 'anakulam', expected: 'Anakulam' },
  { query: 'munro island', expected: 'Munroe Island' },
  { query: 'kutiran', expected: 'Kuthiran' },
  { query: 'silant valey', expected: 'Silent Valley' },
  { query: 'chembra', expected: 'Chembra' },
  { query: 'vilangad', expected: 'Vilangad' },
  { query: 'pulurampara', expected: 'Pullurampara' },
  { query: 'mudapallur', expected: 'Mudappallur' }
];

for (const { query, expected } of typos) {
  const matches = searchKeralaPlacesAI(query);
  const matched = matches.length > 0 && matches[0].name.toLowerCase().includes(expected.toLowerCase());
  if (!matched) {
    console.error(`✗ Fuzzy match FAILED for "${query}". Top result: ${matches[0]?.name}, expected containing: ${expected}`);
    process.exit(1);
  }
  console.log(`✓ Fuzzy match PASSED: "${query}" -> "${matches[0].name}" (Confidence: ${matches[0].confidencePct}%)`);
}

// Test 3: Road Graph Snapping for Minute Hamlets
const chooralmala = exactResults[0];
const closestNode = findClosestGraphNode(chooralmala.lat, chooralmala.lng, mapData.nodes);
console.log(`Snapped "${chooralmala.name}" (${chooralmala.lat}, ${chooralmala.lng}) to graph node: [${closestNode.id}] ${closestNode.name} (${closestNode.distanceKm} km away)`);

if (!closestNode || !closestNode.id) {
  console.error('✗ Road graph snapping FAILED');
  process.exit(1);
}
console.log('✓ Road network graph snapping PASSED');

// Test 4: Tactical Routing from Snapped Minute Hamlet to Destination
const kuttanadMatches = searchKeralaPlacesAI('Kuttanad');
const kuttanad = kuttanadMatches[0];
const kuttanadNode = findClosestGraphNode(kuttanad.lat, kuttanad.lng, mapData.nodes);

console.log(`Routing from Chooralmala (snapped to ${closestNode.id}) to Kuttanad (snapped to ${kuttanadNode.id})...`);
const route = solveDijkstra(closestNode.id, kuttanadNode.id, mapData.nodes, mapData.edges, [], 'car');

if (!route || !route.geometry || route.geometry.length === 0) {
  console.error('✗ Route calculation between snapped places FAILED');
  process.exit(1);
}

console.log(`✓ Route calculated successfully: Distance: ${route.distance} km, Travel Time: ${route.travelTimeMinutes} mins, Path Nodes: ${route.nodes.length}`);
console.log('✓ ALL KERALA AI PLACE MATCHER & ROUTING TESTS PASSED!');
