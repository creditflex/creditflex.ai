const cfg = require('./config');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TITLE = 'CreditFlex.ai — Know Your Score. Own Your Future.';
const DESC = 'Credit score monitoring, full 3-bureau reports, and real-time identity theft alerts.';

const LOGO = `<a class="logo" href="/" aria-label="CreditFlex.ai"><svg viewBox="0 0 56 40" width="42" height="30" aria-hidden="true"><path d="M17 27C21 14 36 6 55 4l-5 10c-12 1-21 6-25 15z" fill="#14c8b4"/><path d="M2 39C3 28 9 20 21 15l-3 8C13 25 10 31 9 39z" fill="#14c8b4"/></svg><span>CreditFlex<b>.ai</b></span></a>`;

function layout({ title = TITLE, body, user, extraHead = '', active = '' }) {
  const link = (href, label) => `<a href="${href}" class="${active === href ? 'on' : ''}">${label}</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(DESC)}">
<meta name="theme-color" content="#00d4aa"><link rel="canonical" href="https://creditflex.ai/">
<meta property="og:title" content="${esc(TITLE)}"><meta property="og:description" content="${esc(DESC)}">
<meta property="og:image" content="https://creditflex.ai/og-image.png"><meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/css/site.css">${extraHead}</head><body>
<header class="nav"><div class="wrap nav-in">
${LOGO}
<button class="burger" id="burger" aria-label="Menu" aria-expanded="false"><i></i><i></i><i></i></button>
<nav id="menu">${link('/', 'Home')}${user ? link('/dashboard', 'Dashboard') : ''}${link('/credit-dashboard', 'Credit Dashboard')}${link('/pricing', 'Pricing')}${user ? '<a href="#" id="logout">Log out</a>' : link('/login', 'Login')}</nav>
${user ? '' : '<a class="btn" href="/sign-up">Get Started</a>'}
</div></header>
<main>${body}</main>
<footer class="foot"><div class="wrap">
<div class="foot-grid">
<div class="flogo">${LOGO}<p class="muted">Premium credit monitoring and identity theft protection for everyday consumers. Know your score. Own your future.</p>
<ul class="badges"><li><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>256-bit Encryption</li><li><svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/></svg>SOC 2 Certified</li><li><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>FCRA Compliant</li></ul></div>
<div><h4>Products</h4><a href="/">Home</a><a href="/pricing">Pricing</a><a href="/credit-dashboard">Credit Dashboard</a></div>
<div><h4>Company</h4><a href="/about">About</a><a href="/contact">Contact</a><a href="/affiliate">Affiliate Program</a></div>
<div><h4>Legal</h4><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Use</a><a href="/security">Security</a><a href="/cookies">Cookie Policy</a></div>
</div>
<p class="muted small">© 2026 CreditFlex.ai, Inc. All rights reserved.</p>
<p class="muted small">CreditFlex.ai is not a credit repair organization. Credit scores are for educational purposes only.</p>
</div></footer>
<script src="/js/site.js"></script></body></html>`;
}

const money = c => '$' + (c / 100).toFixed(c % 100 ? 2 : 0);
const PRICE = money(cfg.stripe.monthlyCents), VERIFY = money(cfg.stripe.verifyCents), TRIAL = cfg.stripe.trialDays;
const CHECK = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>';
const home = user => layout({ user, active: '/', body: `
<section class="hero"><div class="wrap hero-in">
<div class="hero-copy"><span class="tag"><i></i>Premium credit monitoring</span>
<h1>Good Credit is A <em>Flex...</em></h1>
<p class="lead">Real-time credit monitoring and full credit reports — all in one powerful platform built for everyday consumers.</p>
<div class="cta-row"><a class="btn big" href="/sign-up">Get Started <svg class="chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></a> <a class="btn big ghost" href="#features">See How It Works</a></div>
<ul class="checks"><li>${CHECK}500K+ members</li><li>${CHECK}${TRIAL}-day trial for ${VERIFY}</li><li>${CHECK}Cancel anytime</li></ul></div>
<div class="card gauge"><div class="toast"><svg viewBox="0 0 24 24"><path d="M6 17h12l-1.5-2V11a4.5 4.5 0 00-9 0v4zM10 19a2 2 0 004 0"/></svg>Score updated</div>
<div class="row"><div><span class="muted">Credit Score</span><br><b>TransUnion</b></div><span class="pill"><i></i>Live</span></div>
<div class="dial"><svg viewBox="0 0 220 200" aria-label="Score gauge"><path d="M47.8 172.2A88 88 0 1 1 172.2 172.2" fill="none" stroke="#1b2740" stroke-width="12" stroke-linecap="round"/><path d="M47.8 172.2A88 88 0 1 1 197.8 103.7" fill="none" stroke="#00d4aa" stroke-width="12" stroke-linecap="round" class="glow"/></svg>
<div class="score"><b>750</b><span>Excellent</span></div><em class="lo">300</em><em class="hi">850</em></div>
<p class="muted center">Your credit potential</p>
<div class="factors"><div><b>100%</b><span>Payment</span></div><div><b>12%</b><span>Utilization</span></div><div><b>7 yrs</b><span>Age</span></div></div></div>
</div></section>
<section id="features" class="wrap sect"><p class="eyebrow">See the impact</p>
<h2>Members improve scores by an average of 47 points in 6 months</h2>
<p class="muted">CreditFlex.ai members who actively use our tools and recommendations see measurable results — faster than going it alone.</p>
<div class="stat"><b>47 pts</b><span>Average score improvement in 6 months</span></div>
<div class="ranges"><span style="--c:#ef4444">Poor 300–579</span><span style="--c:#f97316">Fair 580–669</span><span style="--c:#eab308">Good 670–739</span><span style="--c:#84cc16">Very Good 740–799</span><span style="--c:#00d4aa">Excellent 800–850</span></div>
<p class="muted small">Score ranges based on VantageScore 3.0 model.</p></section>
<section class="cta"><div class="wrap center"><h2>Start monitoring in 2 minutes</h2>
<p class="muted">Join over 500,000 members who've taken control of their financial future. Start your ${TRIAL}-day trial today.</p>
<form class="email-cta" id="email-cta"><input type="email" name="email" placeholder="Enter your email address" required aria-label="Email address"><button class="btn big" type="submit">Get Started</button></form>
<p class="muted small">${VERIFY} today for a ${TRIAL}-day trial, then ${PRICE}/month. Cancel anytime.</p></div></section>` });

const pricing = (user, b) => layout({ user, title: 'Pricing — CreditFlex.ai', active: '/pricing', body: `
<section class="wrap sect"><div class="plan-card"><div class="plan-flag">Most Popular</div>
<div class="plan-body"><h3>Premium</h3><p class="muted">Full credit command center with all three bureaus and daily score updates.</p>
<p class="price">${PRICE} <small>/per month</small></p>
${!user ? '<a class="btn big block" href="/sign-up">Start ' + TRIAL + '-Day Trial for ' + VERIFY + '</a>' : b && b.access ? '<a class="btn big block" href="/dashboard">Go to your dashboard</a>' : '<button class="btn big block" type="button" id="start-trial">Start ' + TRIAL + '-Day Trial for ' + VERIFY + '</button><p class="err center" id="trial-err" role="alert"></p>'}
<a class="btn big ghost block dim" href="#plan-features">View Details</a>
<p class="muted small center fine">${VERIFY} is charged today to confirm your card. After your ${TRIAL}-day trial, your card is billed ${PRICE}/month automatically until you cancel. Cancel anytime.</p>
<hr><ul class="feat" id="plan-features"><li><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Daily credit score (3 bureaus)</li><li><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Full 3-bureau credit reports</li><li><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Real-time score alerts</li><li><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Credit utilization tracker</li><li><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Score simulator &amp; action plan</li><li><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Identity theft protection</li><li><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Dark web monitoring</li><li><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>$1M identity theft insurance</li><li><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Lost wallet protection</li><li><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>24/7 restoration support</li></ul></div></div></section>` });

const authPage = (mode, user) => {
  const signup = mode === 'sign-up';
  return layout({ user, title: `${signup ? 'Sign up' : 'Log in'} — CreditFlex.ai`, active: signup ? '' : '/login', body: `
<section class="wrap sect"><div class="card form"><h2>${signup ? 'Create your account' : 'Welcome back'}</h2>
<form id="auth" data-mode="${signup ? 'signup' : 'login'}">
${signup ? '<label>Full name<input name="name" required autocomplete="name"></label>' : ''}
<label>Email<input name="email" type="email" id="email-field" required autocomplete="email"></label>
<label>Password<input name="password" type="password" required minlength="8" autocomplete="${signup ? 'new-password' : 'current-password'}"></label>
<p class="err" id="err" role="alert"></p>
<button class="btn big" type="submit">${signup ? 'Create account' : 'Log in'}</button>${signup ? '<p class="muted small center fine">Next you will start your ${TRIAL}-day trial. ${VERIFY} is charged today to confirm your card, then your card is billed ${PRICE}/month automatically until you cancel. Cancel anytime.</p>' : ''}</form>
<p class="muted small">${signup ? 'Already a member? <a href="/login">Log in</a>' : 'New here? <a href="/sign-up">Create an account</a>'}</p></div></section>` });
};

const fmtDate = iso => { try { return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' }); } catch (_) { return ''; } };
const dashboard = (user, b = {}) => {
  const enrolled = !!user.array_user_id;
  const statusLine = b.status === 'trialing' ? `Your ${TRIAL}-day trial is active${b.trialEnd ? ' and ends ' + fmtDate(b.trialEnd) : ''}. After that, ${PRICE}/month until you cancel.`
    : b.status === 'active' ? 'Your membership is active.' : b.status === 'comped' ? 'You have complimentary access.' : '';
  const manage = b.canManage ? '<button class="btn ghost" type="button" id="manage-billing">Manage billing</button> <span class="err" id="bill-err" role="alert"></span>' : '';
  const locked = !b.access;
  const lockMsg = b.status === 'past_due' ? 'Your last payment did not go through. Update your payment method to restore access.'
    : b.status === 'canceled' ? 'Your membership has ended. Restart it to open your credit tools.'
    : `Start your ${TRIAL}-day trial to unlock your credit tools. ${VERIFY} is charged today to confirm your card, then your card is billed ${PRICE}/month automatically after the trial until you cancel.`;
  return layout({ user, title: 'Dashboard — CreditFlex.ai', active: '/dashboard', body: `
<section class="wrap sect"><p class="eyebrow">Your dashboard</p>
<h2>Welcome, ${esc(user.name.split(' ')[0])}</h2>
${locked ? `<div class="card" style="margin:16px 0;max-width:640px"><h3>Activate your membership</h3><p class="muted">${lockMsg}</p>
${b.billingOn ? (b.status === 'past_due' && b.canManage ? manage : '<button class="btn big" type="button" id="start-trial">Start ' + TRIAL + '-Day Trial for ' + VERIFY + '</button><p class="err" id="trial-err" role="alert"></p>') : '<p class="muted small">Billing is being set up. Please check back soon.</p>'}</div>`
: `<p class="muted lead2">${enrolled
  ? 'Your identity is verified. Open your Credit Dashboard any time to see your scores, reports and protection tools.'
  : 'To activate your credit tools you will verify your identity once. After that you can open your Credit Dashboard any time without verifying again.'}</p>
${statusLine ? '<p class="muted small">' + esc(statusLine) + '</p>' : ''}
<p><a class="btn big" href="/credit-dashboard">${enrolled ? 'Open Credit Dashboard' : 'Verify identity &amp; activate'}</a> ${manage}</p>`}
<h2 class="sub">What you get with CreditFlex</h2>
<div class="grid3 prods"><div class="card prod"><h3>Credit Score &amp; Reports</h3><p class="muted">See your credit score from all three bureaus and your full credit reports, with daily updates and real-time score alerts.</p></div><div class="card prod"><h3>Identity Theft Protection</h3><p class="muted">Monitoring for signs of identity theft, $1M identity theft insurance, lost wallet protection and 24/7 restoration support.</p></div><div class="card prod"><h3>Dark Web &amp; Breach Monitoring</h3><p class="muted">Get alerted if your personal information shows up in a data breach or on the dark web.</p></div><div class="card prod"><h3>Personal Info Removal</h3><p class="muted">Find where your personal information is exposed online and request its removal.</p></div><div class="card prod"><h3>Subscription Manager</h3><p class="muted">See the recurring subscriptions on your accounts and cancel the ones you no longer want.</p></div><div class="card prod"><h3>Student Loan Aid</h3><p class="muted">Tools to help you understand your student loans and apply for assistance.</p></div><div class="card prod"><h3>Home Value</h3><p class="muted">Track the estimated value of your home over time.</p></div></div></section>` });
};

// Not linked from the navigation. The Array script is injected by /js/credit-tools.js (once).
const creditTools = user => layout({ user, title: 'Credit Dashboard — CreditFlex.ai', active: '/credit-dashboard',
  body: `<section class="wrap sect"><div id="array-host" class="array-host"><p class="muted">Loading your credit tools…</p></div></section>
<script>window.__ARRAY_APP_KEY__=${JSON.stringify(cfg.arrayAppKey)};</script><script src="/js/credit-tools.js"></script>` });

const admin = (user, rows = [], mailOn = false, mailTo = '', stripeOn = false) => layout({ user, title: 'Admin — CreditFlex.ai', body: `
<section class="wrap sect"><h2>Enrolled members</h2>
<p class="muted">${rows.length} enrolled. ${mailOn ? 'A daily summary email (about 8am Central) goes to ' + esc(mailTo) + '.' : 'Summary emails are OFF: set RESEND_API_KEY and EMAIL_FROM in Render.'}</p>
<p><a class="btn ghost" href="/admin/affiliates">Affiliate program</a></p>
<p class="muted small">Billing (Stripe): ${stripeOn ? 'on' : 'OFF. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Render.'}</p>
<p><a class="btn" href="/admin/enrollments.csv">Download CSV</a> <button class="btn ghost" id="testmail">Send test email</button> <span class="muted small" id="mailout"></span></p>
<div class="tablewrap"><table class="grid"><thead><tr><th>Enrolled</th><th>Name</th><th>Email</th><th>Products</th><th>Billing</th><th>Array user ID</th></tr></thead><tbody>
${rows.map(e => `<tr><td>${esc(e.enrolled_at)}</td><td>${esc(e.name)}</td><td>${esc(e.email)}</td><td>${esc(e.enrollment_status || '')}${e.rejected ? ' <span class="muted small">(' + esc(e.rejected) + ')</span>' : ''}</td><td>${esc(e.billing_status || '')}</td><td class="mono">${esc(e.array_user_id)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No enrolled members yet.</td></tr>'}
</tbody></table></div>
<h2 class="sub">Check the Array connection</h2>
<p class="muted">Tests each proxy (ProxyMesh, QuotaGuard) against Array's token service. Use this if members see "We couldn't reach your credit tools."</p>
<p><button class="btn ghost" id="testarray">Test Array connection</button></p>
<pre class="card" id="arrout" style="white-space:pre-wrap;min-height:60px">Results will appear here.</pre>
<h2 class="sub">Enroll existing members in all products</h2>
<p class="muted">Enrolls every member who has an Array ID, one at a time. Safe to run more than once.</p>
<p><button class="btn big" id="enroll">Enroll existing members</button></p>
<pre class="card" id="out" style="white-space:pre-wrap;min-height:80px">Results will appear here.</pre></section>
<script>
function post(url) { return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(function (r) { return r.json(); }); }
document.getElementById('enroll').addEventListener('click', function () {
  var out = document.getElementById('out'); out.textContent = 'Working…';
  post('/api/array/enroll-existing').then(function (j) { out.textContent = JSON.stringify(j, null, 2); }).catch(function () { out.textContent = 'Request failed. Check the Render logs.'; });
});
document.getElementById('testarray').addEventListener('click', function () {
  var o = document.getElementById('arrout'); o.textContent = 'Testing…';
  post('/api/admin/test-array').then(function (j) {
    if (j.error) { o.textContent = 'Error: ' + j.error; return; }
    var t = 'Server token set: ' + j.tokenSetting + (j.tokenInfo ? ' (length ' + j.tokenInfo.length + (j.tokenInfo.hadOuterSpaceOrQuote ? ', has stray space or quote' : '') + (j.tokenInfo.hasInnerSpace ? ', contains a space' : '') + ')' : '') + '\\nApp key used: ' + j.appKey + (j.appKeyFromRender ? '  (from the ARRAY_APP_KEY setting in Render)' : '  (built-in default)') + '\\nTested with: ' + (j.usingOwnMember ? 'your own member record' : 'a dummy user (a 4xx answer from Array still proves the connection works)') + '\\n';
    j.results.forEach(function (r) { t += '\\n' + (r.ok ? 'OK    ' : 'FAIL  ') + r.proxy + '\\n      ' + r.detail + '\\n'; });
    o.textContent = t;
  }).catch(function () { o.textContent = 'Request failed. Check the Render logs.'; });
});
document.getElementById('testmail').addEventListener('click', function () {
  var o = document.getElementById('mailout'); o.textContent = 'Sending…';
  post('/api/admin/test-email').then(function (j) { o.textContent = j.ok ? 'Sent to ' + j.sentTo + (j.summary && j.summary.sent ? ' (plus pending enrollments)' : '') : 'Failed: ' + (j.error || 'unknown'); }).catch(function () { o.textContent = 'Request failed.'; });
});
</script>` });

// ---------- Affiliate program ----------
const usd = c => (c < 0 ? '-' : '') + '$' + (Math.abs(c) / 100).toFixed(2);
const COMM = usd(cfg.affiliate.commissionCents), HOLD = cfg.affiliate.holdDays, MINPAY = usd(cfg.affiliate.minPayoutCents);
const refLink = a => `${cfg.stripe.siteUrl}/r/${a.code}`;

const affiliate = (user, aff) => layout({ user, title: 'Affiliate Program — CreditFlex.ai', active: '', body: `
<section class="wrap sect"><p class="eyebrow">Affiliate program</p>
<h2>Earn ${COMM} every month for each premium member you refer</h2>
<p class="muted lead2">Share your personal link. When someone you refer becomes a paying CreditFlex Premium member, you earn ${COMM} for every month they stay subscribed, for as long as they stay.</p>
<div class="grid3 prods">
<div class="card prod"><h3>1. Join free</h3><p class="muted">Create a CreditFlex account, then apply below. We review each application.</p></div>
<div class="card prod"><h3>2. Share your link</h3><p class="muted">You get a personal link that tracks anyone who signs up within ${cfg.affiliate.cookieDays} days of clicking it.</p></div>
<div class="card prod"><h3>3. Earn monthly</h3><p class="muted">${COMM} per referred member for each month their Premium payment goes through. Free trials and cancelled members do not earn commission.</p></div></div>
<h2 class="sub">How payouts work</h2>
<ul class="muted"><li>A commission becomes payable ${HOLD} days after the member's payment, to cover refunds and chargebacks. Refunded or disputed payments are removed.</li>
<li>We send payouts once your payable balance reaches ${MINPAY}, by PayPal or the payout method you give us.</li>
<li>Partners who earn $600 or more in a calendar year must provide a W-9 for tax reporting.</li></ul>
<h2 class="sub">Program rules</h2>
<ul class="muted"><li>No referring yourself or your own accounts.</li>
<li>Clearly disclose that you earn a commission when you promote CreditFlex (required by the FTC).</li>
<li>No misleading claims, no promises about credit score results, and no spam.</li>
<li>We may suspend partners who break these rules and withhold commissions earned through violations.</li></ul>
<div class="card" style="max-width:560px;margin:28px 0">
${aff ? `<h3>You are in the program</h3><p class="muted">Status: <b>${esc(aff.status)}</b>${aff.status === 'pending' ? '. Your application is under review. Your link already tracks sign-ups, and commissions are paid once you are approved.' : ''}</p><p><a class="btn big" href="/affiliate/dashboard">Open partner dashboard</a></p>`
: !user ? '<h3>Ready to join?</h3><p class="muted">Create a free CreditFlex account first, then come back to apply.</p><p><a class="btn big" href="/sign-up">Create an account</a> <a class="btn big ghost" href="/login">Log in</a></p>'
: `<h3>Apply to the program</h3><form id="affiliate-join">
<label class="lbl">PayPal email (or other payout details)<input name="payoutMethod" required maxlength="120" placeholder="you@example.com"></label>
<label class="lbl chk"><input type="checkbox" name="agree" required> I agree to the program rules above and will disclose my affiliate relationship when I promote CreditFlex.</label>
<p class="err" id="aff-err" role="alert"></p><button class="btn big" type="submit">Apply now</button></form>`}
</div></section>` });

const stat = (label, value) => `<div class="card prod"><p class="muted small">${label}</p><p class="price" style="font-size:2rem;margin:.2em 0">${value}</p></div>`;
const STATE_LABEL = { pending: 'In hold period', payable: 'Payable', paid: 'Paid', void: 'Removed' };
const affiliateDashboard = (user, a, comms, payouts) => layout({ user, title: 'Partner dashboard — CreditFlex.ai', active: '', body: `
<section class="wrap sect"><p class="eyebrow">Partner dashboard</p><h2>Your referrals</h2>
${a.status === 'pending' ? '<p class="card" style="max-width:640px">Your application is under review. Your link already tracks sign-ups, and your commissions are paid once you are approved.</p>' : ''}
${a.status === 'suspended' ? '<p class="card" style="max-width:640px">Your partner account is suspended. Contact support@creditflex.ai.</p>' : ''}
<p class="muted">Your personal link</p>
<p><input class="linkbox" id="reflink" readonly value="${esc(refLink(a))}" onclick="this.select()"> <button class="btn ghost" type="button" id="copylink">Copy link</button></p>
<p class="muted small">Anyone who clicks it and signs up within ${cfg.affiliate.cookieDays} days is credited to you.</p>
<div class="grid3 prods">${stat('Link clicks', a.clicks)}${stat('Sign-ups', a.signups)}${stat('Active premium members', a.active_members)}
${stat('In hold period', usd(a.pending_cents))}${stat('Payable now', usd(a.payable_cents))}${stat('Paid to date', usd(a.paid_cents))}</div>
<p class="muted small">You earn ${COMM} per referred member for each paid month. Commissions become payable ${HOLD} days after payment. Payouts are sent once your payable balance reaches ${MINPAY}. For privacy, we never show you who your referred members are.</p>
<h2 class="sub">Commission history</h2>
<div class="tablewrap"><table class="grid"><thead><tr><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>
${comms.map(c => `<tr><td>${esc(c.created_at)}</td><td>${usd(c.amount_cents)}</td><td>${STATE_LABEL[c.state] || ''}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No commissions yet.</td></tr>'}
</tbody></table></div>
<h2 class="sub">Payments sent to you</h2>
<div class="tablewrap"><table class="grid"><thead><tr><th>Date</th><th>Amount</th><th>Method</th></tr></thead><tbody>
${payouts.map(p => `<tr><td>${esc(p.paid_at)}</td><td>${usd(p.amount_cents)}</td><td>${esc(p.method)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No payouts yet.</td></tr>'}
</tbody></table></div></section>` });

const adminAffiliates = (user, affs, comms, payouts) => {
  const approved = affs.filter(a => a.status === 'approved');
  const totalPayable = approved.reduce((n, a) => n + (a.payable_cents >= cfg.affiliate.minPayoutCents ? a.payable_cents : 0), 0);
  const pendingApps = affs.filter(a => a.status === 'pending').length;
  return layout({ user, title: 'Affiliates — CreditFlex.ai', body: `
<section class="wrap sect"><p><a href="/admin">&larr; Admin</a></p><h2>Affiliate program</h2>
<p class="muted">${affs.length} partners, ${pendingApps} waiting for approval. Due for payout now (balance of ${MINPAY} or more): <b>${usd(totalPayable)}</b>. Commission: ${COMM} per paid month, payable after a ${HOLD}-day hold.</p>
<p><a class="btn" href="/admin/payouts.csv">Download payouts due (CSV)</a> <span class="muted small" id="affout"></span></p>
<div class="tablewrap"><table class="grid"><thead><tr><th>Partner</th><th>Code</th><th>Status</th><th>Payout details</th><th>Clicks</th><th>Sign-ups</th><th>Active</th><th>In hold</th><th>Payable</th><th>Paid</th><th>W-9</th><th>Actions</th></tr></thead><tbody>
${affs.map(a => `<tr data-id="${a.id}"><td>${esc(a.name)}<br><span class="muted small">${esc(a.email)}</span></td><td class="mono">${esc(a.code)}</td><td>${esc(a.status)}</td><td>${esc(a.payout_method)}</td><td>${a.clicks}</td><td>${a.signups}</td><td>${a.active_members}</td><td>${usd(a.pending_cents)}</td><td><b>${usd(a.payable_cents)}</b></td><td>${usd(a.paid_cents)}</td>
<td><input type="checkbox" class="w9" ${a.w9_on_file ? 'checked' : ''}></td>
<td>${a.status !== 'approved' ? '<button class="btn ghost act" data-act="approved" type="button">Approve</button>' : '<button class="btn ghost act" data-act="suspended" type="button">Suspend</button>'}
${a.status === 'approved' && a.payable_cents >= cfg.affiliate.minPayoutCents ? '<button class="btn act" data-act="payout" type="button">Record payout</button>' : ''}</td></tr>`).join('') || '<tr><td colspan="12" class="muted">No partners yet.</td></tr>'}
</tbody></table></div>
<p class="muted small">"Record payout" does not send money. Pay the partner yourself (PayPal, Zelle or ACH), then click it and enter the payment reference. It marks everything currently payable as paid.</p>
<h2 class="sub">Recent commissions</h2>
<div class="tablewrap"><table class="grid"><thead><tr><th>Date</th><th>Partner</th><th>Referred member</th><th>Amount</th><th>Status</th><th>Stripe invoice</th><th></th></tr></thead><tbody>
${comms.map(c => `<tr data-cid="${c.id}"><td>${esc(c.created_at)}</td><td>${esc(c.affiliate_email)}</td><td>${esc(c.member_email || '')}</td><td>${usd(c.amount_cents)}</td><td>${STATE_LABEL[c.state] || ''}</td><td class="mono">${esc(c.stripe_invoice_id)}</td><td>${c.state !== 'void' && c.amount_cents > 0 ? '<button class="btn ghost voidc" type="button">Void</button>' : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">No commissions yet.</td></tr>'}
</tbody></table></div>
<p class="muted small">Void a commission if the member's payment was refunded or disputed. Voiding one that was already paid creates a negative adjustment that comes off the partner's next payout.</p>
<h2 class="sub">Payout history</h2>
<div class="tablewrap"><table class="grid"><thead><tr><th>Date</th><th>Partner</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody>
${payouts.map(p => `<tr><td>${esc(p.paid_at)}</td><td>${esc(p.affiliate_email)}</td><td>${usd(p.amount_cents)}</td><td>${esc(p.method)}</td><td class="mono">${esc(p.reference)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No payouts yet.</td></tr>'}
</tbody></table></div></section>
<script>
function ap(url, body) { return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }); }
function done(x) { if (x.ok) location.reload(); else alert(x.j.error || 'Something went wrong'); }
document.querySelectorAll('button.act').forEach(function (b) { b.addEventListener('click', function () {
  var id = Number(b.closest('tr').dataset.id), act = b.dataset.act;
  if (act === 'payout') { var ref = prompt('Payment reference (for example the PayPal transaction ID):'); if (!ref) return; ap('/api/admin/affiliate/payout', { id: id, reference: ref }).then(done); }
  else ap('/api/admin/affiliate/status', { id: id, status: act }).then(done);
}); });
document.querySelectorAll('input.w9').forEach(function (c) { c.addEventListener('change', function () { ap('/api/admin/affiliate/w9', { id: Number(c.closest('tr').dataset.id), value: c.checked }).then(function (x) { if (!x.ok) alert(x.j.error || 'Failed'); }); }); });
document.querySelectorAll('button.voidc').forEach(function (b) { b.addEventListener('click', function () {
  var reason = prompt('Why is this commission being voided? (refund, chargeback, fraud...)'); if (reason === null) return;
  ap('/api/admin/commission/void', { id: Number(b.closest('tr').dataset.cid), reason: reason }).then(done);
}); });
</script>` });
};

const simple = (user, title, text) => layout({ user, title: `${title} — CreditFlex.ai`, body: `<section class="wrap sect"><h2>${esc(title)}</h2><p class="muted">${esc(text)}</p></section>` });

module.exports = { home, pricing, authPage, dashboard, creditTools, admin, affiliate, affiliateDashboard, adminAffiliates, simple };
