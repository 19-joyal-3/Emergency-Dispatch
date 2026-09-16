/**
 * Master Test Runner for Kerala Emergency Dispatch System
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

console.log('\n===============================================================');
console.log('      KERALA EMERGENCY DISPATCH — AUTOMATED TEST SUITE        ');
console.log('===============================================================\n');

const testFiles = [
  { name: 'Live Zero-Connectivity P2P Radar & Mesh Engine', file: path.join(__dirname, 'p2p.test.js') },
  { name: 'Spatial Proximity Location Intercept & Photo Alert', file: path.join(__dirname, 'hazard-photo-intercept.test.js') },
  { name: 'Dynamic Geofence Polygon & Proximity Warning', file: path.join(__dirname, 'geofence.test.js') },
  { name: 'Kerala AI Place Matcher & Road Network Routing', file: path.join(__dirname, 'aiPlaceMatcher.test.js') },
  { name: 'Universal Real-Road Routing Engine & Maneuvers', file: path.join(__dirname, 'routingEngine.test.js') },
  { name: 'Google Play Store Mobile Package & Policy Audit', file: path.join(root, 'test-playstore-readiness.js') }
];

let allPassed = true;
const results = [];

for (const suite of testFiles) {
  console.log(`\n▶ RUNNING: ${suite.name}...`);
  const startTime = Date.now();
  const res = spawnSync(process.execPath, [suite.file], {
    cwd: root,
    encoding: 'utf8',
    env: process.env
  });
  const durationMs = Date.now() - startTime;

  if (res.stdout) console.log(res.stdout.trim());
  if (res.stderr) console.error(res.stderr.trim());

  const passed = res.status === 0;
  results.push({
    name: suite.name,
    passed,
    exitCode: res.status,
    durationMs
  });

  if (!passed) {
    allPassed = false;
  }
}

console.log('\n===============================================================');
console.log('                     FINAL TEST SUMMARY                        ');
console.log('===============================================================');
results.forEach(r => {
  const status = r.passed ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
  console.log(`${status} ${r.name.padEnd(52)} (${r.durationMs}ms)`);
});
console.log('===============================================================\n');

if (allPassed) {
  console.log('\x1b[32m✔ ALL TEST SUITES PASSED PERFECTLY (0 FAILURES)\x1b[0m\n');
  process.exit(0);
} else {
  console.error('\x1b[31m✖ SOME TESTS FAILED\x1b[0m\n');
  process.exit(1);
}
