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


// Cleans up a proxy value pasted into Render so small formatting slips don't break it:
// surrounding quotes/spaces, a leading "NAME=", a missing http://, and unencoded special characters in the password.
function normalizeProxy(raw) {
  const problems = [];
  let v = String(raw || '').trim();
  if (/^["'].*["']$/.test(v)) { v = v.slice(1, -1).trim(); problems.push('quotes removed'); }
  const eq = v.match(/^[A-Za-z_][A-Za-z0-9_]*=(.*)$/);
  if (eq) { v = eq[1].trim(); problems.push('variable name removed from the value'); }
  if (/\s/.test(v)) problems.push('contains spaces');
  if (/USERNAME|PASSWORD|HOST:PORT/i.test(v)) problems.push('still contains placeholder text (USERNAME, PASSWORD or HOST:PORT)');
  let scheme = 'http://';
  const sm = v.match(/^([a-z][a-z0-9+.-]*):\/\/(.*)$/i);
  if (sm) { scheme = sm[1].toLowerCase() + '://'; v = sm[2]; } else problems.push('http:// was missing');
  if (scheme === 'https://') { scheme = 'http://'; problems.push('https:// changed to http://'); }
  v = v.replace(/\/+$/, '');
  const at = v.lastIndexOf('@');
  let creds = at >= 0 ? v.slice(0, at) : '', host = at >= 0 ? v.slice(at + 1) : v;
  if (creds) {
    const i = creds.indexOf(':');
    const enc = s => { try { return decodeURIComponent(s) !== s ? s : encodeURIComponent(s); } catch (_) { return encodeURIComponent(s); } };
    creds = i >= 0 ? enc(creds.slice(0, i)) + ':' + enc(creds.slice(i + 1)) : enc(creds);
    creds += '@';
  } else problems.push('no username and password found (expected USERNAME:PASSWORD@HOST:PORT)');
  const url = scheme + creds + host;
  let valid = true;
  try { const u = new URL(url); if (!u.hostname) valid = false; if (!u.port) problems.push('no port found'); } catch (_) { valid = false; }
  return { url, valid, problems };
}
const proxyEnv = process.env.PROXY_URLS
  ? process.env.PROXY_URLS.split(',').map((s, i) => ['PROXY_URLS #' + (i + 1), s])
  : [['QUOTAGUARDSTATIC_URL', process.env.QUOTAGUARDSTATIC_URL], ['PROXYMESH_URL', process.env.PROXYMESH_URL], ['PROXY_URL', process.env.PROXY_URL]];
const proxySources = proxyEnv.filter(([, v]) => (v || '').trim()).map(([label, v]) => Object.assign({ label }, normalizeProxy(v)));
proxySources.forEach(p => { if (!p.valid || p.problems.length) console.warn(`Proxy setting ${p.label}: ${p.valid ? 'adjusted' : 'NOT a valid URL'} (${p.problems.join('; ') || 'unreadable'})`); });

module.exports = {
  port: Number(process.env.PORT || 3000),
  isProd: process.env.NODE_ENV === 'production',
  sessionSecret: process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? require('crypto').randomBytes(32).toString('hex') : 'dev-only-secret-change-me'),
  arrayAppKey: process.env.ARRAY_APP_KEY || 'F22B34C8-260F-4DEF-AB23-8876B4262C51',
// Ordered list of outbound proxies; the first is tried first, the rest are failovers.
  // Set PROXY_URLS (comma-separated), or PROXYMESH_URL and/or QUOTAGUARDSTATIC_URL (QuotaGuard is tried first, then ProxyMesh).
  proxySources,
  proxyUrls: proxySources.map(p => p.url),
  // Enrollment notification emails (sent through Resend's HTTPS API; no SMTP ports needed)
  mail: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: (process.env.EMAIL_FROM || '').trim(),
    to: (process.env.NOTIFY_EMAIL || 'support@creditflex.ai').trim(),
    apiUrl: process.env.EMAIL_API_URL || 'https://api.resend.com/emails',
  },
  // Stripe billing: $1 identity-verification charge today + 7-day trial, then $29/month.
  stripe: {
    secretKey: (process.env.STRIPE_SECRET_KEY || '').trim(),
    webhookSecret: (process.env.STRIPE_WEBHOOK_SECRET || '').trim(),
    apiUrl: process.env.STRIPE_API_URL || 'https://api.stripe.com',
    siteUrl: (process.env.SITE_URL || 'https://creditflex.ai').replace(/\/+$/, ''),
    monthlyCents: Number(process.env.PRICE_MONTHLY_CENTS || 2900),
    verifyCents: Number(process.env.PRICE_VERIFY_CENTS || 100),
    trialDays: Number(process.env.TRIAL_DAYS || 7),
  },
  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
};
