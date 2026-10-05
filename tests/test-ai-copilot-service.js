/**
 * TEST SUITE: Resylix Tactical AI Copilot & Grounding Intelligence Engine
 */

import assert from 'node:assert';
import {
  queryTacticalAiCopilotOffline,
  PRESET_TACTICAL_QUESTIONS,
  PLATFORM_IDENTITY
} from '../src/services/aiCopilotService.js';

console.log('▶ RUNNING: Resylix Tactical AI Copilot Grounding Intelligence Test Suite...');

// TEST 1: Preset Questions Integrity
console.log('--- [TEST 1] Verifying Preset Tactical Questions ---');
assert(PRESET_TACTICAL_QUESTIONS.length >= 6, 'Should have at least 6 tactical questions');
console.log(`✓ Verified ${PRESET_TACTICAL_QUESTIONS.length} preset tactical questions`);

// TEST 2: Creator Attribution Grounding
console.log('--- [TEST 2] Verifying Creator Attribution Grounding ---');
const creatorQueries = [
  'Who created Resylix?',
  'who is the author of this platform?',
  'who made this?',
  'developer of resylix',
  'who built this app?',
  'tell me about joyal'
];

for (const q of creatorQueries) {
  const res = queryTacticalAiCopilotOffline(q);
  assert.strictEqual(res.category, 'creator', `Query "${q}" should match creator category`);
  assert(res.answer.includes('Joyal Thomas Francis'), `Query "${q}" should cite Joyal Thomas Francis`);
  assert(res.answer.includes('19-joyal-3'), `Query "${q}" should cite github profile 19-joyal-3`);
  assert(res.confidence >= 0.95, `Confidence for "${q}" should be >= 0.95`);
}
console.log('✓ All creator attribution queries resolved accurately with Joyal Thomas Francis (@19-joyal-3)');

// TEST 3: Specific Dam Telemetry Grounding
console.log('--- [TEST 3] Verifying Dam Telemetry & Rule Curves ---');
const damRes = queryTacticalAiCopilotOffline('What is the water level and rule curve of Idukki dam?');
assert(damRes.answer.includes('Idukki Dam'), 'Response should mention Idukki Dam');
assert(damRes.answer.includes('Periyar Basin'), 'Response should mention Periyar Basin');
assert(damRes.answer.includes('Rule Curve'), 'Response should mention Rule Curve');
assert(damRes.actions.some(a => a.actionId === 'ksdma_dams'), 'Should have open dam monitor action');
console.log('✓ Specific dam telemetry & rule curve inquiry passed');

// TEST 4: KSDMA Weather Warning Matrix Grounding
console.log('--- [TEST 4] Verifying KSDMA Weather Warning Matrix ---');
const weatherRes = queryTacticalAiCopilotOffline('What are the active weather alerts and rainfall warnings?');
assert(weatherRes.answer.includes('Red Alert'), 'Should mention Red Alert');
assert(weatherRes.answer.includes('Orange Alert'), 'Should mention Orange Alert');
assert(weatherRes.answer.includes('Yellow Alert'), 'Should mention Yellow Alert');
assert(weatherRes.actions.some(a => a.actionId === 'ksdma_weather'), 'Should have weather action');
console.log('✓ Weather warning matrix inquiry passed');

// TEST 5: District-Specific Telemetry & DEOC Lookup
console.log('--- [TEST 5] Verifying District Telemetry & DEOC Directory ---');
const wayanadRes = queryTacticalAiCopilotOffline('What is the emergency helpline and situation in Wayanad?');
assert(wayanadRes.answer.includes('Wayanad'), 'Should mention Wayanad');
assert(wayanadRes.answer.includes('1077'), 'Should mention DEOC 1077');
assert(wayanadRes.answer.includes('04936-204151'), 'Should mention Wayanad direct phone');
assert(wayanadRes.actions.some(a => a.actionId === 'call_phone'), 'Should have call phone action');
console.log('✓ District-specific telemetry & DEOC inquiry passed');

// TEST 6: Offline Dijkstra Routing Technology Grounding
console.log('--- [TEST 6] Verifying Offline Technology Grounding ---');
const offlineRes = queryTacticalAiCopilotOffline('How does offline navigation work without internet?');
assert(offlineRes.answer.includes('Dijkstra'), 'Should explain Dijkstra algorithm');
assert(offlineRes.answer.includes('IndexedDB'), 'Should mention local IndexedDB cache');
assert(offlineRes.answer.includes('V2V Mesh'), 'Should mention V2V Mesh');
console.log('✓ Offline zero-connectivity routing explanation passed');

// TEST 7: Emergency Facilities Grounding
console.log('--- [TEST 7] Verifying 210 Emergency Facilities Grounding ---');
const facilRes = queryTacticalAiCopilotOffline('Where is the nearest hospital and emergency shelter?');
assert(facilRes.answer.includes('210'), 'Should mention 210 facilities');
assert(facilRes.answer.includes('Hospitals'), 'Should mention hospitals');
assert(facilRes.actions.some(a => a.actionId === 'proximity_scan'), 'Should offer 5km proximity scan');
console.log('✓ 210 facilities inquiry passed');

// TEST 8: Hazard Reporting Guidance
console.log('--- [TEST 8] Verifying Road Hazard Reporting Guidance ---');
const hazardRes = queryTacticalAiCopilotOffline('How do I report a landslide or fallen tree blocking the road?');
assert(hazardRes.answer.includes('Landslide'), 'Should mention Landslide category');
assert(hazardRes.actions.some(a => a.actionId === 'report_hazard'), 'Should offer report hazard action');
console.log('✓ Hazard reporting guidance passed');

console.log('\n✔ ALL TACTICAL AI COPILOT TESTS PASSED PERFECTLY!\n');
