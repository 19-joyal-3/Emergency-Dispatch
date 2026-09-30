/**
 * ==============================================================================
 * TEST SUITE: RENDER LOAD BALANCER REVERSE-PROXY CLIENT IP AUDIT
 * ==============================================================================
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const LOG_FILE = path.join(ROOT_DIR, 'system_client_ips.log');

console.log('--- [TEST] RENDER CLIENT IP REVERSE-PROXY AUDIT & SECURITY ---');

const TEST_PORT = 19876;
const ADMIN_KEY = 'vanguard-resylix-sec-2026';

// 1. Start server.js on TEST_PORT
const serverProcess = spawn('node', ['server.js'], {
  cwd: ROOT_DIR,
  env: { ...process.env, PORT: String(TEST_PORT), SYSTEM_AUDIT_SECRET: ADMIN_KEY },
  stdio: 'pipe'
});

serverProcess.stderr.on('data', (d) => console.error('Server err:', d.toString()));

function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function sendReq(options) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port: TEST_PORT, host: '127.0.0.1', ...options }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  try {
    await wait(600);
    console.log('▶ [1/5] Server started successfully on port ' + TEST_PORT);

    // Test 1: Send request simulating Render Load Balancer with x-forwarded-for
    const testClientIp = '203.0.113.195';
    console.log(`▶ [2/5] Simulating request through Render Load Balancer with x-forwarded-for: ${testClientIp}, 10.0.0.1`);
    const res1 = await sendReq({
      path: '/api/health',
      headers: {
        'x-forwarded-for': `${testClientIp}, 10.0.0.1`,
        'user-agent': 'RenderLoadBalancerSimulation/1.0',
        'x-forwarded-proto': 'https'
      }
    });

    if (res1.status !== 200) {
      throw new Error(`Expected HTTP 200, got ${res1.status}`);
    }
    console.log('✓ Health check returned 200 OK');

    // Verify system log file contains the captured client IP
    if (!fs.existsSync(LOG_FILE)) {
      throw new Error('system_client_ips.log file was not created!');
    }
    const logContent = fs.readFileSync(LOG_FILE, 'utf8');
    if (!logContent.includes(testClientIp)) {
      throw new Error(`system_client_ips.log does not contain expected client IP ${testClientIp}. Content: ${logContent}`);
    }
    console.log(`✓ Client IP ${testClientIp} accurately captured and recorded in system_client_ips.log`);

    // Test 2: Verify direct access to system_client_ips.log is blocked (403 Forbidden)
    console.log('▶ [3/5] Testing security guard: Direct request for system_client_ips.log...');
    const resForbidden = await sendReq({ path: '/system_client_ips.log' });
    if (resForbidden.status !== 403) {
      throw new Error(`Security vulnerability: Direct access to system_client_ips.log returned HTTP ${resForbidden.status} instead of 403!`);
    }
    console.log('✓ Direct file download successfully blocked (HTTP 403 Forbidden)');

    // Test 3: Unauthorized access to /api/system/client-ips must be rejected (401)
    console.log('▶ [4/5] Testing unauthorized access to /api/system/client-ips...');
    const resUnauthorized = await sendReq({ path: '/api/system/client-ips' });
    if (resUnauthorized.status !== 401) {
      throw new Error(`Security vulnerability: Unauthorized access returned HTTP ${resUnauthorized.status} instead of 401!`);
    }
    console.log('✓ Unauthorized access successfully rejected (HTTP 401 Unauthorized)');

    // Test 4: Authorized access to /api/system/client-ips with admin key
    console.log('▶ [5/5] Testing authorized access to /api/system/client-ips with admin secret key...');
    const resAuth = await sendReq({
      path: `/api/system/client-ips?key=${ADMIN_KEY}`
    });
    if (resAuth.status !== 200) {
      throw new Error(`Authorized request failed with HTTP ${resAuth.status}: ${resAuth.body}`);
    }
    const parsed = JSON.parse(resAuth.body);
    if (!parsed.logs || parsed.logs.length === 0) {
      throw new Error('Authorized endpoint did not return log entries!');
    }
    const matchingLog = parsed.logs.find(l => l.ip === testClientIp);
    if (!matchingLog) {
      throw new Error(`Could not find client IP ${testClientIp} in parsed logs`);
    }
    console.log(`✓ Authorized admin retrieved ${parsed.totalEvents} access records (${parsed.uniqueIpsCount} unique IPs). Client IP verified: ${matchingLog.ip}`);

    console.log('🎉 ALL RENDER CLIENT IP REVERSE-PROXY AUDIT TESTS PASSED (100% SUCCESS)!');
    process.exit(0);
  } catch (err) {
    console.error('✗ TEST FAILED:', err.message);
    process.exit(1);
  } finally {
    serverProcess.kill('SIGINT');
  }
}

runTests();
