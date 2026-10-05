/**
 * TEST SUITE: Resylix Tactical AI Copilot & Grounding Intelligence Engine (v2.0)
 */

import assert from 'node:assert';
import {
  queryTacticalAiCopilotOffline,
  PRESET_TACTICAL_QUESTIONS,
  PLATFORM_IDENTITY
} from '../src/services/aiCopilotService.js';

console.log('▶ RUNNING: Resylix Tactical AI Copilot Grounding Intelligence Test Suite (v2.0)...');

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
  'tell me about joyal',
  'who programmed this sovereign utility?'
];

for (const q of creatorQueries) {
  const res = queryTacticalAiCopilotOffline(q);
  assert(res.answer.includes('Joyal Thomas Francis'), `Query "${q}" should cite Joyal Thomas Francis`);
  assert(res.answer.includes('19-joyal-3'), `Query "${q}" should cite github profile 19-joyal-3`);
  assert(res.confidence >= 0.8, `Confidence for "${q}" should be >= 0.8`);
}
console.log('✓ All creator attribution queries resolved accurately with Joyal Thomas Francis (@19-joyal-3)');

// TEST 3: Specific Dam Telemetry & Rule Curves
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

// TEST 9: Wayanad Chooralmala & Mundakkai Disaster Context
console.log('--- [TEST 9] Verifying Wayanad Chooralmala Disaster Context ---');
const chooralmalaRes = queryTacticalAiCopilotOffline('Tell me about Chooralmala and Mundakkai landslide response');
assert(chooralmalaRes.answer.includes('Chooralmala'), 'Should mention Chooralmala');
assert(chooralmalaRes.answer.includes('Meppadi'), 'Should mention Meppadi');
assert(chooralmalaRes.actions.some(a => a.actionId === 'proximity_scan'), 'Should offer proximity scan');
console.log('✓ Wayanad Chooralmala disaster context inquiry passed');

// TEST 10: 2018 Kerala Floods History
console.log('--- [TEST 10] Verifying Kerala Floods Historical Lessons ---');
const floodHistoryRes = queryTacticalAiCopilotOffline('Why did Google Maps fail during the 2018 Kerala floods?');
assert(floodHistoryRes.answer.includes('2018 and 2019 Kerala Floods'), 'Should mention historical floods');
assert(floodHistoryRes.answer.includes('Spillway Interception'), 'Should mention spillway interception');
console.log('✓ Kerala floods historical context inquiry passed');

// TEST 11: Technical Stack Architecture
console.log('--- [TEST 11] Verifying Software Stack & Architecture ---');
const techRes = queryTacticalAiCopilotOffline('What is the software stack and libraries used in Resylix?');
assert(techRes.answer.includes('React 19'), 'Should mention React 19');
assert(techRes.answer.includes('Vite'), 'Should mention Vite');
assert(techRes.answer.includes('Dexie.js'), 'Should mention Dexie');
assert(techRes.answer.includes('XGBoost'), 'Should mention XGBoost edge AI');
console.log('✓ Technical architecture inquiry passed');

// TEST 12: Evacuation Manifest PDF
console.log('--- [TEST 12] Verifying Evacuation Manifest Documentation ---');
const manifestRes = queryTacticalAiCopilotOffline('How do I print an evacuation manifest for the NDRF?');
assert(manifestRes.answer.includes('Evacuation Manifest'), 'Should mention Evacuation Manifest');
assert(manifestRes.answer.includes('Critical Triage'), 'Should mention Critical Triage');
assert(manifestRes.actions.some(a => a.actionId === 'evacuation_manifest'), 'Should offer manifest export');
console.log('✓ Evacuation manifest inquiry passed');

// TEST 13: Rule Curve Conceptual Definition
console.log('--- [TEST 13] Verifying Rule Curve Conceptual Definition ---');
const ruleCurveRes = queryTacticalAiCopilotOffline('What is a rule curve in simple words?');
assert(ruleCurveRes.answer.includes('Rule Curve'), 'Should define Rule Curve');
assert(ruleCurveRes.answer.includes('Central Water Commission'), 'Should cite CWC');
console.log('✓ Rule curve definition inquiry passed');

// TEST 14: Bilingual Voice Navigation
console.log('--- [TEST 14] Verifying Bilingual Voice Navigation ---');
const voiceRes = queryTacticalAiCopilotOffline('Can the app speak directions in Malayalam?');
assert(voiceRes.answer.includes('Malayalam'), 'Should mention Malayalam');
assert(voiceRes.actions.some(a => a.actionId === 'toggle_voice_lang'), 'Should offer toggle language');
console.log('✓ Bilingual voice navigation inquiry passed');

// TEST 15: General Synthesis Fallback
console.log('--- [TEST 15] Verifying Deep Synthesis for Open-Ended Questions ---');
const openQuery = queryTacticalAiCopilotOffline('Tell me general advice for emergency operations');
assert(openQuery.answer.includes('Tactical AI Analysis'), 'Should provide tactical analysis');
assert(openQuery.actions.length >= 3, 'Should provide relevant tactical actions');
console.log('✓ Open-ended tactical inquiry synthesized gracefully');

// TEST 16: District-Specific Weather Resolution (Palakkad bug regression test)
console.log('--- [TEST 16] Verifying District-Specific Weather Query Resolution ---');
const palakkadWeather = queryTacticalAiCopilotOffline('weather in palakkad');
assert(palakkadWeather.category === 'DISTRICT_WEATHER', 'Category should be DISTRICT_WEATHER');
assert(palakkadWeather.answer.includes('Palakkad'), 'Response must be for Palakkad, not another district');
assert(!palakkadWeather.answer.includes('Kottayam'), 'Must NOT match Kottayam');
assert(palakkadWeather.answer.includes('ORANGE ALERT'), 'Palakkad should show Orange Alert');
assert(palakkadWeather.answer.includes('154'), 'Palakkad rainfall should show ~154 mm');
assert(palakkadWeather.answer.includes('Malampuzha Dam'), 'Should cite Malampuzha Dam in Palakkad');
assert(palakkadWeather.answer.includes('0491-2505309'), 'Should cite Palakkad DEOC phone');
console.log('✓ Palakkad district-specific weather resolved accurately with Orange Alert and Malampuzha Dam');

console.log('\n✔ ALL 16 EXPANDED TACTICAL AI COPILOT TESTS PASSED PERFECTLY!\n');
