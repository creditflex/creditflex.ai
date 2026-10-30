const fs = require('fs');
const path = require('path');
// Tiny .env loader (no dependencies)
try {
  const raw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (_) {}

module.exports = {
  port: Number(process.env.PORT || 3000),
  isProd: process.env.NODE_ENV === 'production',
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  arrayAppKey: process.env.ARRAY_APP_KEY || 'F22B34C8-260F-4DEF-AB23-8876B4262C51',
// Ordered list of outbound proxies; the first is tried first, the rest are failovers.
  // Set PROXY_URLS (comma-separated), or PROXYMESH_URL and/or QUOTAGUARDSTATIC_URL (ProxyMesh is tried first).
  proxyUrls: (process.env.PROXY_URLS
    ? process.env.PROXY_URLS.split(',')
    : [process.env.PROXYMESH_URL, process.env.QUOTAGUARDSTATIC_URL, process.env.PROXY_URL]
  ).map(s => (s || '').trim()).filter(Boolean),
  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
};
