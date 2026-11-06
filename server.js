const http = require('http');
const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const db = require('./db');
const auth = require('./auth');
const array = require('./array');
const mail = require('./mail');
const stripe = require('./stripe');
const pages = require('./pages');

const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain' };

// Startup check: say clearly in the log which required settings are missing.
{
  const missing = [];
  if (!process.env.ARRAY_SERVER_TOKEN) missing.push('ARRAY_SERVER_TOKEN');
  if (!cfg.proxyUrls.length) missing.push('PROXYMESH_URL or QUOTAGUARDSTATIC_URL');
  if (cfg.isProd && cfg.sessionSecret === 'dev-only-secret-change-me') missing.push('SESSION_SECRET');
  if (cfg.isProd && !cfg.adminEmail) missing.push('ADMIN_EMAIL');
  if (!stripe.configured()) console.warn('NOTE: billing is off until STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set. Members cannot start a trial without it.');
  if (stripe.configured() && !cfg.stripe.webhookSecret) console.warn('WARNING: STRIPE_WEBHOOK_SECRET is missing, so subscription changes (cancellations, failed payments) will not reach the site.');
  if (!mail.configured()) console.warn('NOTE: daily enrollment summary emails are off until RESEND_API_KEY and EMAIL_FROM are set.');
  if (missing.length) console.warn('WARNING: these required settings are missing:', missing.join(', '));
}

// Daily summary: one email per day (about 8am Central) listing members enrolled since the last summary.
const SUMMARY_HOUR = Number(process.env.SUMMARY_HOUR || 8);
const SUMMARY_TZ = process.env.SUMMARY_TZ || 'America/Chicago';
const localParts = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: SUMMARY_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: p.year + '-' + p.month + '-' + p.day, hour: Number(p.hour) };
};
async function sendDailySummary(force) {
  if (!mail.configured()) return { sent: false, reason: 'email not configured' };
  const { date, hour } = localParts();
  if (!force && (hour < SUMMARY_HOUR || db.getMeta('last_summary_date') === date)) return { sent: false, reason: 'not due' };
  const rows = db.pendingEnrollments();
  if (!force) db.setMeta('last_summary_date', date);
  if (!rows.length) return { sent: false, reason: 'no new enrollments' };
  const attention = rows.filter(r => r.enrollment_status !== 'All').length;
  const lines = rows.map(r => `- ${clean(r.name)} <${clean(r.email)}>  enrolled ${clean(r.enrolled_at)} UTC  products: ${clean(r.enrollment_status)}${r.enrollment_status !== 'All' ? ' (needs attention)' : ''}  Array ID: ${clean(r.array_user_id)}`);
  const text = `${rows.length} new CreditFlex enrollment${rows.length === 1 ? '' : 's'} since the last summary.` + (attention ? `\n${attention} need attention.` : '') + '\n\n' + lines.join('\n') + '\n\nFull list: https://creditflex.ai/admin';
  try {
    await mail.send(`CreditFlex daily summary: ${rows.length} new enrollment${rows.length === 1 ? '' : 's'}`, text);
    db.markNotified(rows.map(r => r.array_user_id));
    console.log('Daily summary sent:', rows.length, 'enrollments');
    return { sent: true, count: rows.length };
  } catch (e) {
    if (!force) db.setMeta('last_summary_date', ''); // retry on the next check
    console.error('Daily summary failed:', e.message);
    return { sent: false, reason: e.message };
  }
}
const clean = v => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').slice(0, 300);
const isAdmin = u => !!(u && cfg.adminEmail && u.email === cfg.adminEmail);
const csvCell = v => { let t = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };

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
  '/privacy': ['Privacy Policy', 'Replace this placeholder with your reviewed privacy policy before launch.'],
  '/terms': ['Terms of Use', 'Replace this placeholder with your reviewed terms of use before launch.'],
  '/security': ['Security', 'Replace this placeholder with your security statement before launch.'],
  '/cookies': ['Cookie Policy', 'Replace this placeholder with your cookie policy before launch.'],
};

// ---------- Billing ----------
const iso = sec => (sec ? new Date(sec * 1000).toISOString() : '');
// Copies a Stripe subscription's state onto the member (status: trialing, active, past_due, canceled, ...).
function applySubscription(sub, userIdHint) {
  if (!sub || !sub.id) return;
  const uid = Number((sub.metadata && sub.metadata.user_id) || userIdHint || 0);
  const u = (uid && db.byId(uid)) || db.byStripeCustomer(typeof sub.customer === 'string' ? sub.customer : sub.customer && sub.customer.id);
  if (!u) { console.error('Stripe subscription', sub.id, 'does not match any member'); return; }
  if (u.billing_status === 'comped') return; // free-access members are never changed by Stripe events
  db.setBilling(u.id, {
    billing_status: sub.status, stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : (sub.customer && sub.customer.id) || u.stripe_customer_id,
    trial_end: iso(sub.trial_end), period_end: iso(sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end)),
  });
  console.log('Billing updated for member', u.id, '->', sub.status);
}
// ---------- Affiliates ----------
const getCookie = (req, name) => { const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)); return m ? decodeURIComponent(m[1]) : ''; };
const addCookie = (res, line) => { const prev = res.getHeader('Set-Cookie'); res.setHeader('Set-Cookie', prev ? [].concat(prev, line) : line); };
const REF_COOKIE = 'cf_ref';
const cleanCode = v => { const c = String(v || '').trim().toLowerCase(); return /^[a-z0-9]{4,20}$/.test(c) ? c : ''; };
const newCode = () => { for (let i = 0; i < 20; i++) { const c = require('crypto').randomBytes(5).toString('hex').slice(0, 8); if (!db.affiliateByCode(c)) return c; } throw new Error('Could not make a code'); };
const money = c => (c < 0 ? '-' : '') + '$' + (Math.abs(c) / 100).toFixed(2);
// A commission is earned each time a referred member's recurring $29 invoice is actually paid.
// The trial and the $1 card confirmation are not renewals, so they never earn one.
function recordCommission(inv) {
  if (!inv || inv.billing_reason !== 'subscription_cycle' || !(inv.amount_paid > 0) || !inv.id) return;
  const cust = typeof inv.customer === 'string' ? inv.customer : inv.customer && inv.customer.id;
  const member = cust && db.byStripeCustomer(cust);
  if (!member || !member.referred_by_affiliate_id) return;
  const aff = db.affiliateById(member.referred_by_affiliate_id);
  if (!aff || aff.status === 'suspended' || aff.user_id === member.id) return;
  if (db.addCommission(aff.id, member.id, inv.id, cfg.affiliate.commissionCents, cfg.affiliate.holdDays)) console.log('Commission recorded for partner', aff.id);
}
const readRaw = req => new Promise((resolve, reject) => {
  let n = 0; const chunks = [];
  req.on('data', c => { n += c.length; if (n > 1e6) { req.destroy(); reject(new Error('Too large')); } else chunks.push(c); });
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});
const billingInfo = u => ({
  access: db.hasAccess(u) || isAdmin(u), status: u.billing_status || '', trialEnd: u.trial_end || '', periodEnd: u.period_end || '',
  canManage: !!u.stripe_customer_id, billingOn: stripe.configured(),
});

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/(.)\/$/, '$1');
  const uid = auth.getSessionUserId(req);
  const user = uid ? db.byId(uid) : null;
  // Sliding inactivity timeout: every request from a signed-in member renews the cookie's activity time.
  if (user && p !== '/api/logout') auth.setSession(res, user.id);

  // ---------- Referral links: /r/CODE or any page with ?ref=CODE (cookie lasts 60 days, newest link wins) ----------
  if (req.method === 'GET') {
    const refCode = p.startsWith('/r/') ? cleanCode(p.slice(3)) : cleanCode(url.searchParams.get('ref'));
    const aff = refCode && db.affiliateByCode(refCode);
    if (aff && aff.status !== 'suspended') {
      db.incClicks(aff.id);
      addCookie(res, `${REF_COOKIE}=${aff.code}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${cfg.affiliate.cookieDays * 86400}${cfg.isProd ? '; Secure' : ''}`);
    }
    if (p.startsWith('/r/')) return redirect(res, '/');
  }

  // ---------- Stripe webhook (raw body needed to check the signature) ----------
  if (req.method === 'POST' && p === '/webhooks/stripe') {
    const raw = await readRaw(req).catch(() => null);
    const ev = raw && stripe.verifyWebhook(raw, req.headers['stripe-signature']);
    if (!ev) return send(res, 400, 'Invalid signature', 'text/plain');
    try {
      const obj = ev.data && ev.data.object;
      if (ev.type === 'checkout.session.completed' && obj && obj.subscription) {
        const sub = await stripe.retrieveSubscription(typeof obj.subscription === 'string' ? obj.subscription : obj.subscription.id);
        applySubscription(sub, obj.client_reference_id);
      } else if (/^customer\.subscription\.(created|updated|deleted)$/.test(ev.type)) {
        applySubscription(obj);
      } else if (ev.type === 'invoice.paid') {
        recordCommission(obj);
      }
    } catch (e) { console.error('Stripe webhook handling failed:', e.message); return send(res, 500, 'Error', 'text/plain'); } // Stripe retries on 5xx
    return send(res, 200, 'ok', 'text/plain');
  }

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
        { const ref = cleanCode(getCookie(req, REF_COOKIE)); const aff = ref && db.affiliateByCode(ref); if (aff && aff.status !== 'suspended' && aff.user_id !== id) db.setReferredBy(id, aff.id); }
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
      if (req.method === 'POST' && p === '/api/session/ping') { await readJson(req); return user ? json(res, 200, { ok: true }) : json(res, 401, { error: 'expired' }); }
      if (req.method === 'POST' && p === '/api/logout') { await readJson(req); auth.clearSession(res); return json(res, 200, { ok: true }); }

      if (!user) return json(res, 401, { error: 'Not logged in' });

      // POST /api/billing/checkout -> Stripe Checkout: $1 identity-verification charge + 7-day trial, then $29/month
      if (req.method === 'POST' && p === '/api/billing/checkout') {
        await readJson(req);
        if (billingInfo(user).access) return json(res, 400, { error: 'Your account is already active.' });
        if (!stripe.configured()) return json(res, 503, { error: 'Billing is not available yet. Please try again soon.' });
        try { const cs = await stripe.createCheckout(user); return json(res, 200, { url: cs.url }); }
        catch (e) { console.error('Stripe checkout error:', e.message); return json(res, 502, { error: 'We could not start checkout. Please try again.' }); }
      }
      // POST /api/billing/portal -> Stripe's page where members update their card or cancel
      if (req.method === 'POST' && p === '/api/billing/portal') {
        await readJson(req);
        if (!user.stripe_customer_id) return json(res, 400, { error: 'No billing account yet.' });
        try { const ps = await stripe.createPortal(user.stripe_customer_id); return json(res, 200, { url: ps.url }); }
        catch (e) { console.error('Stripe portal error:', e.message); return json(res, 502, { error: 'We could not open billing. Please try again.' }); }
      }
      // Array calls below are for active members only.
      if (p.startsWith('/api/array/') && p !== '/api/array/event-log' && !p.endsWith('/enroll-existing') && !billingInfo(user).access) return json(res, 402, { error: 'subscription-required' });

      // POST /api/array/event-log: records WHICH Array events arrive (names/keys only, no personal data)
      if (req.method === 'POST' && p === '/api/array/event-log') {
        const b = await readJson(req);
        const safe = v => String(v).replace(/[^\w .:-]/g, '').slice(0, 60);
        console.log('Array event:', safe(b.event), '| detail keys:', (b.keys || []).slice(0, 15).map(safe).join(','),
          '| metadata keys:', (b.metaKeys || []).slice(0, 15).map(safe).join(','), '| member:', user.id);
        if (b.detail && typeof b.detail === 'object') {
          const t = v => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').slice(0, 300);
          console.log('Array error detail:', 'message=' + t(b.detail.message), '| section=' + t(b.detail.section),
            '| authMethod=' + t(b.detail.authMethod), '| bureau=' + t(b.detail.bureau), '| headers=' + t(b.detail.headers));
        }
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
        let r = null, err = null;
        try { r = await array.enrollBatch(aid); }
        catch (e) { err = e; console.error('Array enrollment error:', e.message); }
        const status = err ? 'error' : (r.json && r.json.enrollmentStatus) || ('HTTP ' + r.status);
        let rejected = '';
        try { if (r && r.json && r.json.rejectedEnrollments) rejected = JSON.stringify(r.json.rejectedEnrollments).slice(0, 500); } catch (_) {}
        db.recordEnrollment(user.id, aid, status, rejected);
        if (err) return json(res, 502, { error: 'Enrollment request failed' });
        return json(res, 200, r.json || { status: r.status });
      }
      // POST /api/affiliate/join: a logged-in member applies to the affiliate program (an admin approves)
      if (req.method === 'POST' && p === '/api/affiliate/join') {
        const b = await readJson(req);
        const method = String(b.payoutMethod || '').trim().slice(0, 120);
        if (!b.agree) return json(res, 400, { error: 'Please accept the affiliate terms.' });
        if (!method) return json(res, 400, { error: 'Enter the PayPal email (or other payout details) where we should send your commissions.' });
        const existing = db.affiliateByUser(user.id);
        if (existing) { db.setAffiliatePayoutMethod(existing.id, method); return json(res, 200, { ok: true, status: existing.status }); }
        db.createAffiliate(user.id, newCode(), method);
        console.log('New affiliate application from member', user.id);
        return json(res, 200, { ok: true, status: 'pending' });
      }
      // Admin-only affiliate actions
      if (p.startsWith('/api/admin/affiliate') || p === '/api/admin/commission/void') {
        if (!isAdmin(user)) return json(res, 403, { error: 'Forbidden' });
        const b = await readJson(req);
        const id = Number(b.id);
        if (p === '/api/admin/affiliate/status') {
          if (!['approved', 'suspended', 'pending'].includes(b.status) || !db.affiliateById(id)) return json(res, 400, { error: 'Bad request' });
          db.setAffiliateStatus(id, b.status); return json(res, 200, { ok: true });
        }
        if (p === '/api/admin/affiliate/w9') { if (!db.affiliateById(id)) return json(res, 400, { error: 'Bad request' }); db.setAffiliateW9(id, !!b.value); return json(res, 200, { ok: true }); }
        if (p === '/api/admin/affiliate/payout') {
          const a = db.affiliateById(id);
          if (!a) return json(res, 400, { error: 'Bad request' });
          if (a.status !== 'approved') return json(res, 400, { error: 'Only approved partners can be paid.' });
          const reference = String(b.reference || '').trim().slice(0, 120);
          if (!reference) return json(res, 400, { error: 'Enter the payment reference (for example the PayPal transaction ID).' });
          const wouldTotal = db.affiliateYearPaidCents(id) + a.payable_cents;
          if (wouldTotal >= 60000 && !a.w9_on_file) return json(res, 400, { error: 'This partner is at $600 for the year. Get their W-9 and tick "W-9 on file" before paying.' });
          const r = db.createPayout(id, a.payout_method, reference, String(b.note || '').slice(0, 200), cfg.affiliate.minPayoutCents);
          if (!r.ok) return json(res, 400, { error: r.error });
          console.log('Payout recorded for partner', id, r.total, 'cents');
          return json(res, 200, { ok: true, total: money(r.total), count: r.count });
        }
        if (p === '/api/admin/commission/void') { const r = db.voidCommission(id, b.reason); return json(res, r.ok ? 200 : 400, r.ok ? r : { error: r.error }); }
        return json(res, 404, { error: 'Not found' });
      }

      // POST /api/admin/test-array (admin only): checks each proxy and Array's token service with your own member record
      if (req.method === 'POST' && p === '/api/admin/test-array') {
        if (!isAdmin(user)) return json(res, 403, { error: 'Forbidden' });
        await readJson(req);
        try {
          const usingOwn = !!user.array_user_id;
          const results = await array.probe(user.array_user_id || 'diagnostic-test-user');
          return json(res, 200, { usingOwnMember: usingOwn, tokenSetting: !!process.env.ARRAY_SERVER_TOKEN, tokenInfo: array.tokenInfo(), appKeySet: !!cfg.arrayAppKey, appKey: cfg.arrayAppKey, appKeyFromRender: !!process.env.ARRAY_APP_KEY, results });
        } catch (e) { return json(res, 200, { error: e.message }); }
      }
      // POST /api/admin/test-email (admin only): sends a test message to the notification address
      if (req.method === 'POST' && p === '/api/admin/test-email') {
        if (!isAdmin(user)) return json(res, 403, { error: 'Forbidden' });
        await readJson(req);
        try {
          await mail.send('CreditFlex test email', 'This is a test. The daily enrollment summary will be sent to this address.');
          const sum = await sendDailySummary(true); // also sends any pending enrollments now
          return json(res, 200, { ok: true, sentTo: cfg.mail.to, summary: sum });
        }
        catch (e) { console.error('Test email failed:', e.message); return json(res, 502, { error: e.message }); }
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
            db.recordEnrollment(u.id, u.array_user_id, st || ('HTTP ' + r.status), r.json && r.json.rejectedEnrollments ? JSON.stringify(r.json.rejectedEnrollments).slice(0, 500) : '');
            if (st === 'All') summary.all++;
            else summary.issues.push({ email: u.email, enrollmentStatus: st || `HTTP ${r.status}`, rejectedEnrollments: r.json && r.json.rejectedEnrollments });
          } catch (e) { db.recordEnrollment(u.id, u.array_user_id, 'error', ''); summary.issues.push({ email: u.email, enrollmentStatus: 'error', error: e.message }); }
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
  if (p === '/pricing') return send(res, 200, pages.pricing(user, user ? billingInfo(user) : null));
  if (p === '/login' || p === '/sign-up') return user ? redirect(res, '/dashboard') : send(res, 200, pages.authPage(p.slice(1), null));
  if (p === '/billing/success') {
    if (!user) return redirect(res, '/login');
    const sid = url.searchParams.get('session_id');
    if (sid && stripe.configured()) {
      try {
        const cs = await stripe.retrieveSession(sid);
        if (String(cs.client_reference_id) === String(user.id) && cs.subscription && typeof cs.subscription === 'object') {
          if (cs.customer) db.setBilling(user.id, { stripe_customer_id: typeof cs.customer === 'string' ? cs.customer : cs.customer.id });
          applySubscription(cs.subscription, user.id);
        }
      } catch (e) { console.error('Stripe success sync failed (the webhook will catch up):', e.message); }
    }
    return redirect(res, '/dashboard?welcome=1');
  }
  if (p === '/affiliate') return send(res, 200, pages.affiliate(user, user ? db.affiliateByUser(user.id) : null));
  if (p === '/affiliate/dashboard') {
    if (!user) return redirect(res, '/login');
    const a = db.affiliateByUser(user.id);
    if (!a) return redirect(res, '/affiliate');
    return send(res, 200, pages.affiliateDashboard(user, a, db.listCommissions(a.id, 100), db.listPayouts(a.id)));
  }
  if (p === '/admin/affiliates') {
    if (!isAdmin(user)) return redirect(res, '/');
    return send(res, 200, pages.adminAffiliates(user, db.listAffiliates(), db.listCommissions(null, 100), db.listPayouts(null)));
  }
  if (p === '/admin/payouts.csv') {
    if (!isAdmin(user)) return redirect(res, '/');
    const head = ['partner_email', 'partner_name', 'payout_method', 'amount_due_usd', 'w9_on_file'];
    const rows = db.listAffiliates().filter(a => a.status === 'approved' && a.payable_cents >= cfg.affiliate.minPayoutCents)
      .map(a => [a.email, a.name, a.payout_method, (a.payable_cents / 100).toFixed(2), a.w9_on_file ? 'yes' : 'no'].map(csvCell).join(','));
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="creditflex-payouts-due.csv"', 'Cache-Control': 'no-store' });
    return res.end([head.join(',')].concat(rows).join('\r\n'));
  }
  if (p === '/admin/enrollments.csv') {
    if (!isAdmin(user)) return redirect(res, '/');
    const head = ['enrolled_at', 'email', 'name', 'array_user_id', 'enrollment_status', 'rejected_products', 'billing_status'];
    const rows = db.listEnrollments().map(e => [e.enrolled_at, e.email, e.name, e.array_user_id, e.enrollment_status, e.rejected, e.billing_status].map(csvCell).join(','));
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="creditflex-enrollments.csv"', 'Cache-Control': 'no-store' });
    return res.end([head.join(',')].concat(rows).join('\r\n'));
  }
  if (p === '/admin') return isAdmin(user) ? send(res, 200, pages.admin(user, db.listEnrollments(), mail.configured(), cfg.mail.to, stripe.configured())) : redirect(res, '/');
  if (p === '/dashboard') return user ? send(res, 200, pages.dashboard(user, billingInfo(user))) : redirect(res, '/login');
  if (p === '/credit-dashboard' || p === '/credit-tools-v2') {
    if (!user) return redirect(res, '/login');
    return billingInfo(user).access ? send(res, 200, pages.creditTools(user)) : redirect(res, '/dashboard?subscribe=1');
  }
  if (STATIC_PAGES[p]) return send(res, 200, pages.simple(user, ...STATIC_PAGES[p]));

  // ---------- Static files (flat layout: files live next to server.js) ----------
  const STATIC = { '/css/site.css': 'site.css', '/js/site.js': 'site.js', '/js/credit-tools.js': 'credit-tools.js' };
  if (STATIC[p]) return send(res, 200, fs.readFileSync(path.join(__dirname, STATIC[p])), MIME[path.extname(STATIC[p])]);
  return send(res, 404, pages.simple(user, 'Page not found', 'That page does not exist.'));
}

http.createServer((req, res) => handle(req, res).catch(e => { console.error(e); if (!res.headersSent) send(res, 500, 'Server error', 'text/plain'); }))
  .listen(cfg.port, () => console.log(`CreditFlex listening on :${cfg.port}`));
setInterval(() => sendDailySummary(false).catch(e => console.error('Summary check failed:', e.message)), 10 * 60 * 1000).unref();
