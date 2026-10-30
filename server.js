const http = require('http');
const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const db = require('./db');
const auth = require('./auth');
const array = require('./array');
const pages = require('./pages');

const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain' };

const send = (res, status, body, type = 'text/html; charset=utf-8') => {
  res.writeHead(status, {
    'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY', ...(cfg.isProd ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
    ...(type.startsWith('text/html') || type.startsWith('application/json') ? { 'Cache-Control': 'no-store' } : {}),
  });
  res.end(body);
};
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
const redirect = (res, to) => { res.writeHead(302, { Location: to }); res.end(); };

const readJson = req => new Promise((resolve, reject) => {
  if (!/^application\/json/i.test(req.headers['content-type'] || '')) return reject(Object.assign(new Error('JSON required'), { status: 415 }));
  let n = 0, buf = '';
  req.on('data', c => { n += c.length; if (n > 10240) { req.destroy(); reject(Object.assign(new Error('Too large'), { status: 413 })); } else buf += c; });
  req.on('end', () => { try { resolve(JSON.parse(buf || '{}')); } catch (_) { reject(Object.assign(new Error('Bad JSON'), { status: 400 })); } });
});

// Very small in-memory login throttle
const hits = new Map();
const throttled = ip => {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 15 * 60e3);
  arr.push(now); hits.set(ip, arr); return arr.length > 20;
};

const STATIC_PAGES = {
  '/credit-cards': ['Credit Cards', 'Card recommendations are coming soon.'],
  '/loans': ['Loans', 'Loan offers are coming soon.'],
  '/about': ['About', 'CreditFlex.ai helps everyday consumers monitor and understand their credit.'],
  '/contact': ['Contact', 'Questions? Email support@creditflex.ai.'],
  '/affiliate': ['Affiliate Program', 'Our affiliate program details are coming soon.'],
  '/privacy': ['Privacy Policy', 'Replace this placeholder with your reviewed privacy policy before launch.'],
  '/terms': ['Terms of Use', 'Replace this placeholder with your reviewed terms of use before launch.'],
  '/security': ['Security', 'Replace this placeholder with your security statement before launch.'],
  '/cookies': ['Cookie Policy', 'Replace this placeholder with your cookie policy before launch.'],
};

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/(.)\/$/, '$1');
  const uid = auth.getSessionUserId(req);
  const user = uid ? db.byId(uid) : null;

  // ---------- API ----------
  if (p.startsWith('/api/')) {
    try {
      if (req.method === 'POST' && p === '/api/signup') {
        if (throttled(req.socket.remoteAddress)) return json(res, 429, { error: 'Too many attempts. Try again later.' });
        const b = await readJson(req);
        const email = String(b.email || '').trim().toLowerCase(), name = String(b.name || '').trim(), pw = String(b.password || '');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name || pw.length < 8) return json(res, 400, { error: 'Enter a name, a valid email, and a password of 8+ characters.' });
        if (db.byEmail(email)) return json(res, 409, { error: 'An account with that email already exists.' });
        const id = db.create(email, name.slice(0, 100), auth.hashPassword(pw));
        auth.setSession(res, id);
        return json(res, 200, { ok: true });
      }
      if (req.method === 'POST' && p === '/api/login') {
        if (throttled(req.socket.remoteAddress)) return json(res, 429, { error: 'Too many attempts. Try again later.' });
        const b = await readJson(req);
        const u = db.byEmail(String(b.email || '').trim().toLowerCase());
        if (!u || !auth.verifyPassword(String(b.password || ''), u.password_hash)) return json(res, 401, { error: 'Incorrect email or password.' });
        auth.setSession(res, u.id);
        return json(res, 200, { ok: true });
      }
      if (req.method === 'POST' && p === '/api/logout') { await readJson(req); auth.clearSession(res); return json(res, 200, { ok: true }); }

      if (!user) return json(res, 401, { error: 'Not logged in' });

      // POST /api/array/event-log: records WHICH Array events arrive (names/keys only, no personal data)
      if (req.method === 'POST' && p === '/api/array/event-log') {
        const b = await readJson(req);
        const safe = v => String(v).replace(/[^\w .:-]/g, '').slice(0, 60);
        console.log('Array event:', safe(b.event), '| detail keys:', (b.keys || []).slice(0, 15).map(safe).join(','),
          '| metadata keys:', (b.metaKeys || []).slice(0, 15).map(safe).join(','), '| member:', user.id);
        return json(res, 200, { ok: true });
      }
      // GET /api/array/token -> POST array.io/api/authenticate/v2/usertoken via proxy
      if (req.method === 'GET' && p === '/api/array/token') {
        if (!user.array_user_id) return json(res, 200, { userToken: null });
        try {
          const r = await array.getUserToken(user.array_user_id);
          if (r.status === 200) return json(res, 200, { userToken: (r.json && r.json.userToken) || null });
          console.error('Array usertoken error:', r.status, r.text);
          return json(res, 200, { userToken: null, error: String(r.status) });
        } catch (e) {
          console.error('Array usertoken error:', e.message);
          return json(res, 200, { userToken: null, error: 'request-failed' });
        }
      }
      // POST /api/array/enrolled -> save userId, then POST array.io/api/monitoring/v2/batch via proxy
      if (req.method === 'POST' && p === '/api/array/enrolled') {
        const b = await readJson(req);
        const aid = String(b.userId || '').trim();
        if (!aid) return json(res, 400, { error: 'userId is required' });
        db.setArrayUserId(user.id, aid);
        console.log('Array userId saved for member', user.id);
        try {
          const r = await array.enrollBatch(aid);
          return json(res, 200, r.json || { status: r.status });
        } catch (e) { console.error('Array enrollment error:', e.message); return json(res, 502, { error: 'Enrollment request failed' }); }
      }
      // POST /api/array/enroll-existing (admin only): one-time enrollment, one user at a time
      if (req.method === 'POST' && p === '/api/array/enroll-existing') {
        if (!cfg.adminEmail || user.email !== cfg.adminEmail) return json(res, 403, { error: 'Forbidden' });
        const users = db.withArrayId();
        const summary = { total: users.length, all: 0, issues: [] };
        for (const u of users) {
          try {
            const r = await array.enrollBatch(u.array_user_id);
            const st = r.json && r.json.enrollmentStatus;
            if (st === 'All') summary.all++;
            else summary.issues.push({ email: u.email, enrollmentStatus: st || `HTTP ${r.status}`, rejectedEnrollments: r.json && r.json.rejectedEnrollments });
          } catch (e) { summary.issues.push({ email: u.email, enrollmentStatus: 'error', error: e.message }); }
        }
        return json(res, 200, summary);
      }
      return json(res, 404, { error: 'Not found' });
    } catch (e) {
      return json(res, e.status || 500, { error: e.status ? e.message : 'Server error' });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');

  // ---------- Pages ----------
  if (p === '/') return send(res, 200, pages.home(user));
  if (p === '/pricing') return send(res, 200, pages.pricing(user));
  if (p === '/login' || p === '/sign-up') return user ? redirect(res, '/dashboard') : send(res, 200, pages.authPage(p.slice(1), null));
  if (p === '/dashboard') return user ? send(res, 200, pages.dashboard(user)) : redirect(res, '/login');
  if (p === '/credit-dashboard') return user ? send(res, 200, pages.creditTools(user)) : redirect(res, '/login');
  if (p === '/credit-tools-v2') return user ? send(res, 200, pages.creditTools(user)) : redirect(res, '/login');
  if (STATIC_PAGES[p]) return send(res, 200, pages.simple(user, ...STATIC_PAGES[p]));

  // ---------- Static files (flat layout: files live next to server.js) ----------
  const STATIC = { '/css/site.css': 'site.css', '/js/site.js': 'site.js', '/js/credit-tools.js': 'credit-tools.js' };
  if (STATIC[p]) return send(res, 200, fs.readFileSync(path.join(__dirname, STATIC[p])), MIME[path.extname(STATIC[p])]);
  return send(res, 404, pages.simple(user, 'Page not found', 'That page does not exist.'));
}

http.createServer((req, res) => handle(req, res).catch(e => { console.error(e); if (!res.headersSent) send(res, 500, 'Server error', 'text/plain'); }))
  .listen(cfg.port, () => console.log(`CreditFlex listening on :${cfg.port}`));
