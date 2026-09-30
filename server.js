/**
 * ==============================================================================
 * RESYLIX (VANGUARD GEO) PRODUCTION BACKEND & CLIENT IP AUDIT SERVER
 * ==============================================================================
 * Designed for Render, Docker, and standalone Node.js environments.
 * 
 * Features:
 * - Reads reverse-proxy headers from Render load balancers (x-forwarded-for, cf-connecting-ip, x-real-ip)
 * - Captures and persists client IP telemetry to a protected systems file (system_client_ips.log)
 * - Restricted access: ONLY authorized administrators can view the audit file via secret key
 * - High-speed static asset serving for Vite production build (dist/) with gzip & caching
 * - SPA rewrite to index.html for client-side routing
 * ==============================================================================
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '10000', 10);
const DIST_DIR = path.join(__dirname, 'dist');
const LOG_FILE_PATH = path.join(__dirname, 'system_client_ips.log');
const ADMIN_SECRET_KEY = process.env.SYSTEM_AUDIT_SECRET || process.env.VITE_SYSTEM_ADMIN_KEY || 'vanguard-resylix-sec-2026';

// Common MIME types for production static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pmtiles': 'application/octet-stream',
  '.onnx': 'application/octet-stream',
  '.wasm': 'application/wasm'
};

/**
 * Extracts the real client IP from Render's load balancer reverse-proxy headers.
 */
export function extractClientIp(req) {
  // Render load balancer passes the client IP as the first IP in x-forwarded-for
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const clientIp = forwarded.split(',')[0].trim();
    if (clientIp) return clientIp;
  }
  return req.headers['cf-connecting-ip'] ||
         req.headers['x-real-ip'] ||
         req.headers['true-client-ip'] ||
         req.socket?.remoteAddress ||
         '127.0.0.1';
}

/**
 * Appends client access telemetry to the protected systems file.
 */
export function recordClientAccess(req) {
  const url = req.url || '/';
  // Exclude internal health checks or asset polling if desired
  if (url.startsWith('/healthz') || url.startsWith('/favicon.ico')) return;

  const clientIp = extractClientIp(req);
  const timestamp = new Date().toISOString();
  const method = req.method || 'GET';
  const ua = req.headers['user-agent'] || 'Unknown';
  const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  const country = req.headers['cf-ipcountry'] || 'N/A';
  const host = req.headers['host'] || 'localhost';

  const entry = `[${timestamp}] IP: ${clientIp} | METHOD: ${method} | URL: ${url} | PROTO: ${proto} | COUNTRY: ${country} | HOST: ${host} | UA: ${ua}\n`;

  try {
    fs.appendFileSync(LOG_FILE_PATH, entry, 'utf8');
  } catch (err) {
    console.error('[SYSTEM AUDIT] Error recording client IP to system file:', err);
  }
}

/**
 * Master HTTP Request Listener
 */
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. Capture Client IP into the Systems Log File
  recordClientAccess(req);

  // 2. Security Guard: Never allow direct file download of system_client_ips.log
  if (pathname.includes('system_client_ips.log') || pathname.includes('.env') || pathname.includes('system_audit')) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Access Denied: Protected System File');
    return;
  }

  // 3. Health check for Render load balancer
  if (pathname === '/healthz' || pathname === '/api/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', serverTime: new Date().toISOString(), service: 'resylix-backend' }));
    return;
  }

  // 4. Secure Admin Systems Audit API - ONLY accessible by administrator with secret key
  if (pathname === '/api/system/client-ips') {
    const authHeader = req.headers['x-admin-key'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
    const queryKey = parsedUrl.searchParams.get('key');
    const providedKey = authHeader || queryKey;

    if (!providedKey || providedKey !== ADMIN_SECRET_KEY) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Unauthorized',
        message: 'System client IP audit file is restricted to verified administrators only.'
      }));
      return;
    }

    // Clear logs if DELETE method
    if (req.method === 'DELETE') {
      try {
        fs.writeFileSync(LOG_FILE_PATH, `[${new Date().toISOString()}] --- SYSTEM AUDIT LOG RESET BY ADMINISTRATOR ---\n`, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'success', message: 'System access log cleared.' }));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // Read and parse system_client_ips.log
    try {
      const content = fs.existsSync(LOG_FILE_PATH) ? fs.readFileSync(LOG_FILE_PATH, 'utf8') : '';
      const lines = content.split('\n').filter(Boolean);
      
      // Calculate unique IP count
      const uniqueIps = new Set();
      const parsedLogs = lines.slice(-250).reverse().map((line, idx) => {
        const ipMatch = line.match(/IP:\s*([^\s|]+)/);
        const methodMatch = line.match(/METHOD:\s*([^\s|]+)/);
        const urlMatch = line.match(/URL:\s*([^\s|]+)/);
        const countryMatch = line.match(/COUNTRY:\s*([^\s|]+)/);
        const timeMatch = line.match(/\[(.*?)\]/);
        const uaMatch = line.match(/UA:\s*(.+)$/);

        const ip = ipMatch ? ipMatch[1] : 'unknown';
        if (ip && ip !== 'unknown') uniqueIps.add(ip);

        return {
          id: `log_${idx}`,
          raw: line,
          timestamp: timeMatch ? timeMatch[1] : '',
          ip,
          method: methodMatch ? methodMatch[1] : 'GET',
          url: urlMatch ? urlMatch[1] : '/',
          country: countryMatch ? countryMatch[1] : 'N/A',
          userAgent: uaMatch ? uaMatch[1] : ''
        };
      });

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'success',
        totalEvents: lines.length,
        uniqueIpsCount: uniqueIps.size,
        systemLogPath: LOG_FILE_PATH,
        logs: parsedLogs
      }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Failed to read system log file: ' + err.message }));
    }
    return;
  }

  // 5. Serve Static Production Assets from dist/
  let filePath = path.join(DIST_DIR, pathname);

  // Security check: prevent directory traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If file not found or is directory, check if index.html exists in subdirectory
      const indexInDir = path.join(filePath, 'index.html');
      if (fs.existsSync(indexInDir) && fs.statSync(indexInDir).isFile()) {
        filePath = indexInDir;
      } else {
        // SPA Fallback: Serve dist/index.html
        filePath = path.join(DIST_DIR, 'index.html');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Not Found');
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);

      // Cache headers: Immutable for hashed assets, no-cache for index.html
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }

      res.end(data);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`======================================================`);
  console.log(`🚀 RESYLIX PRODUCTION SERVER STARTED ON PORT ${PORT}`);
  console.log(`📡 Reverse-proxy Client IP tracking active.`);
  console.log(`🔒 System Audit File: ${LOG_FILE_PATH}`);
  console.log(`🛡️ Admin Access Key: [PROTECTED]`);
  console.log(`======================================================`);
});
