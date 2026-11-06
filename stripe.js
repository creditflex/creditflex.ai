// Minimal Stripe client (no dependencies). Card details are entered on Stripe's hosted Checkout page,
// never on this site. The secret key is read only here and never logged or sent to the browser.
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const cfg = require('./config');

exports.configured = () => !!cfg.stripe.secretKey;

// Stripe takes form-encoded bodies with bracketed names: a[b][0][c]=1
const encode = (obj, prefix, out = []) => {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (x && typeof x === 'object' ? encode(x, `${key}[${i}]`, out) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(x)}`)));
    else if (typeof v === 'object') encode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out;
};
exports._encode = o => encode(o).join('&');

const api = (method, pathname, params) => new Promise((resolve, reject) => {
  if (!exports.configured()) return reject(new Error('Stripe is not configured (set STRIPE_SECRET_KEY)'));
  const u = new URL(cfg.stripe.apiUrl);
  const lib = u.protocol === 'http:' ? http : https;
  const isGet = method === 'GET';
  const qs = params ? encode(params).join('&') : '';
  const body = isGet ? '' : qs;
  const req = lib.request({
    hostname: u.hostname, port: u.port || (u.protocol === 'http:' ? 80 : 443),
    path: pathname + (isGet && qs ? '?' + qs : ''), method, timeout: 20000,
    headers: { Authorization: 'Bearer ' + cfg.stripe.secretKey, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, res => {
    let b = ''; res.on('data', c => (b += c));
    res.on('end', () => {
      let j = null; try { j = JSON.parse(b); } catch (_) {}
      if (res.statusCode >= 200 && res.statusCode < 300 && j) return resolve(j);
      reject(new Error('Stripe error ' + res.statusCode + ': ' + String((j && j.error && j.error.message) || b).slice(0, 200)));
    });
  });
  req.on('timeout', () => req.destroy(new Error('Stripe request timed out')));
  req.on('error', reject);
  req.end(body);
});

// $1 one-time identity verification charge today + 7-day trial, then $29/month until cancelled.
exports.createCheckout = user => {
  const s = cfg.stripe;
  const params = {
    mode: 'subscription',
    client_reference_id: String(user.id),
    metadata: { user_id: String(user.id) },
    line_items: [
      { quantity: 1, price_data: { currency: 'usd', unit_amount: s.monthlyCents, recurring: { interval: 'month' }, product_data: { name: 'CreditFlex Premium (monthly)' } } },
      { quantity: 1, price_data: { currency: 'usd', unit_amount: s.verifyCents, product_data: { name: 'Card confirmation (one-time)' } } },
    ],
    subscription_data: { trial_period_days: s.trialDays, metadata: { user_id: String(user.id) } },
    custom_text: { submit: { message: `You will be charged $${(s.verifyCents / 100).toFixed(2)} today to confirm your card. Your ${s.trialDays}-day trial then begins. When it ends, your card will be charged $${(s.monthlyCents / 100).toFixed(2)} per month automatically until you cancel. Cancel anytime.` } },
    success_url: s.siteUrl + '/billing/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: s.siteUrl + '/pricing?canceled=1',
  };
  if (user.stripe_customer_id) params.customer = user.stripe_customer_id; else params.customer_email = user.email;
  return api('POST', '/v1/checkout/sessions', params);
};
exports.retrieveSession = id => api('GET', '/v1/checkout/sessions/' + encodeURIComponent(id), { expand: ['subscription'] });
exports.retrieveSubscription = id => api('GET', '/v1/subscriptions/' + encodeURIComponent(id));
exports.createPortal = customerId => api('POST', '/v1/billing_portal/sessions', { customer: customerId, return_url: cfg.stripe.siteUrl + '/dashboard' });

// Verifies the Stripe-Signature header (HMAC-SHA256 over "timestamp.rawBody"), rejecting stale or forged requests.
exports.verifyWebhook = (raw, header, secret = cfg.stripe.webhookSecret, toleranceSec = 300) => {
  if (!secret || !header) return null;
  const parts = Object.fromEntries(String(header).split(',').map(p => p.trim().split('=')).filter(p => p.length === 2).map(([k, v]) => [k, v]));
  const sigs = String(header).split(',').map(p => p.trim()).filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > toleranceSec) return null;
  const good = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  const ok = sigs.some(s => s.length === good.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good)));
  if (!ok) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
};
