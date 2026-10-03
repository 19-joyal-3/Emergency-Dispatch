import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE_PATH = path.join(__dirname, 'system_client_ips.log');
const ADMIN_SECRET_KEY = process.env.SYSTEM_AUDIT_SECRET || process.env.VITE_SYSTEM_ADMIN_KEY || 'vanguard-resylix-sec-2026';

function extractClientIp(req) {
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

function renderClientIpAuditPlugin() {
  return {
    name: 'render-client-ip-audit',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '/';

        // 1. Intercept secure audit API: /api/system/client-ips
        if (url.startsWith('/api/system/client-ips')) {
          const authHeader = req.headers['x-admin-key'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
          const parsedUrl = new URL(url, 'http://localhost');
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

          try {
            const content = fs.existsSync(LOG_FILE_PATH) ? fs.readFileSync(LOG_FILE_PATH, 'utf8') : '';
            const lines = content.split('\n').filter(Boolean);
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
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 2. Block direct file download of system_client_ips.log
        if (url.includes('system_client_ips.log')) {
          res.statusCode = 403;
          res.end('Access Denied: Protected System File');
          return;
        }

        // 3. Record client access (filter noise like vite internal assets)
        if (!url.startsWith('/@') && !url.startsWith('/node_modules') && !url.includes('.hot-update.') && !url.includes('/@fs/')) {
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
          } catch {}
        }

        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), renderClientIpAuditPlugin()],
  server: {
    host: true,
    port: 5173
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replace(/\\/g, '/');
          if (norm.includes('lucide-react')) {
            return 'vendor-icons';
          }
          if (norm.includes('node_modules')) {
            if (norm.includes('react') || norm.includes('react-dom')) {
              return 'vendor-react';
            }
            if (norm.includes('leaflet')) {
              return 'vendor-leaflet';
            }
            if (norm.includes('dexie') || norm.includes('@supabase')) {
              return 'vendor-storage';
            }
            if (norm.includes('pmtiles')) {
              return 'vendor-pmtiles';
            }
            if (norm.includes('canvas-confetti')) {
              return 'vendor-confetti';
            }
            if (norm.includes('qrcode')) {
              return 'vendor-qrcode';
            }
          }
          if (norm.includes('keralaPlacesDatabase.json') || norm.includes('data/keralaPois.json') || norm.includes('mapData.json')) {
            return 'offline-geodata';
          }
        }
      }
    }
  }
})
