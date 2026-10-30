const cfg = require('./config');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TITLE = 'CreditFlex.ai — Know Your Score. Own Your Future.';
const DESC = 'Free credit score monitoring, full 3-bureau reports, and real-time identity theft alerts.';

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
${user ? '' : '<a class="btn" href="/sign-up">Get Started Free</a>'}
</div></header>
<main>${body}</main>
<footer class="foot"><div class="wrap">
<div class="foot-grid">
<div class="flogo">${LOGO}<p class="muted">Premium credit monitoring and identity theft protection for everyday consumers. Know your score. Own your future.</p>
<ul class="badges"><li><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>256-bit Encryption</li><li><svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/></svg>SOC 2 Certified</li><li><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>FCRA Compliant</li></ul></div>
<div><h4>Products</h4><a href="/">Home</a><a href="/pricing">Pricing</a><a href="/credit-dashboard">Credit Dashboard</a><a href="/credit-cards">Credit Cards</a><a href="/loans">Loans</a></div>
<div><h4>Company</h4><a href="/about">About</a><a href="/contact">Contact</a><a href="/affiliate">Affiliate Program</a></div>
<div><h4>Legal</h4><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Use</a><a href="/security">Security</a><a href="/cookies">Cookie Policy</a></div>
</div>
<p class="muted small">© 2026 CreditFlex.ai, Inc. All rights reserved.</p>
<p class="muted small">CreditFlex.ai is not a credit repair organization. Credit scores are for educational purposes only.</p>
</div></footer>
<script src="/js/site.js"></script></body></html>`;
}

const CHECK = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>';
const home = user => layout({ user, active: '/', body: `
<section class="hero"><div class="wrap hero-in">
<div class="hero-copy"><span class="tag"><i></i>Premium credit monitoring</span>
<h1>Good Credit is A <em>Flex...</em></h1>
<p class="lead">Real-time credit monitoring and full credit reports — all in one powerful platform built for everyday consumers.</p>
<div class="cta-row"><a class="btn big" href="/sign-up">Get Started Free <svg class="chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></a> <a class="btn big ghost" href="#features">See How It Works</a></div>
<ul class="checks"><li>${CHECK}500K+ members</li><li>${CHECK}No credit card required</li><li>${CHECK}Cancel anytime</li></ul></div>
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
<p class="muted">Join over 500,000 members who've taken control of their financial future. Get started free today.</p>
<form class="email-cta" id="email-cta"><input type="email" name="email" placeholder="Enter your email address" required aria-label="Email address"><button class="btn big" type="submit">Get Started Free</button></form>
<p class="muted small">No credit card required. Cancel anytime.</p></div></section>` });

const pricing = user => layout({ user, title: 'Pricing — CreditFlex.ai', active: '/pricing', body: `
<section class="wrap sect"><div class="plan-card"><div class="plan-flag">Most Popular</div>
<div class="plan-body"><h3>Premium</h3><p class="muted">Full credit command center with all three bureaus and daily score updates.</p>
<p class="price">$29.99 <small>/per month</small></p>
<a class="btn big block" href="/sign-up">Start 7-Day Free Trial</a>
<a class="btn big ghost block dim" href="#plan-features">View Details</a>
<p class="muted small center fine">A $1 charge applies when you sign up, for security purposes.</p>
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
<button class="btn big" type="submit">${signup ? 'Get Started Free' : 'Log in'}</button>${signup ? '<p class="muted small center fine">A $1 charge applies when you sign up, for security purposes.</p>' : ''}</form>
<p class="muted small">${signup ? 'Already a member? <a href="/login">Log in</a>' : 'New here? <a href="/sign-up">Create an account</a>'}</p></div></section>` });
};

const dashboard = user => {
  const enrolled = !!user.array_user_id;
  return layout({ user, title: 'Dashboard — CreditFlex.ai', active: '/dashboard', body: `
<section class="wrap sect"><p class="eyebrow">Your dashboard</p>
<h2>Welcome, ${esc(user.name.split(' ')[0])}</h2>
<p class="muted lead2">${enrolled
  ? 'Your identity is verified. Open your Credit Dashboard any time to see your scores, reports and protection tools.'
  : 'To activate your credit tools you will verify your identity once. After that you can open your Credit Dashboard any time without verifying again.'}</p>
<p><a class="btn big" href="/credit-dashboard">${enrolled ? 'Open Credit Dashboard' : 'Verify identity &amp; activate'}</a></p>
<h2 class="sub">What you get with CreditFlex</h2>
<div class="grid3 prods"><div class="card prod"><h3>Credit Score &amp; Reports</h3><p class="muted">See your credit score from all three bureaus and your full credit reports, with daily updates and real-time score alerts.</p></div><div class="card prod"><h3>Identity Theft Protection</h3><p class="muted">Monitoring for signs of identity theft, $1M identity theft insurance, lost wallet protection and 24/7 restoration support.</p></div><div class="card prod"><h3>Dark Web &amp; Breach Monitoring</h3><p class="muted">Get alerted if your personal information shows up in a data breach or on the dark web.</p></div><div class="card prod"><h3>Personal Info Removal</h3><p class="muted">Find where your personal information is exposed online and request its removal.</p></div><div class="card prod"><h3>Subscription Manager</h3><p class="muted">See the recurring subscriptions on your accounts and cancel the ones you no longer want.</p></div><div class="card prod"><h3>Student Loan Aid</h3><p class="muted">Tools to help you understand your student loans and apply for assistance.</p></div><div class="card prod"><h3>Home Value</h3><p class="muted">Track the estimated value of your home over time.</p></div></div></section>` });
};

// Not linked from the navigation. The Array script is injected by /js/credit-tools.js (once).
const creditTools = user => layout({ user, title: 'Credit Dashboard — CreditFlex.ai', active: '/credit-dashboard',
  body: `<section class="wrap sect"><div id="array-host" class="array-host"><p class="muted">Loading your credit tools…</p></div></section>
<script>window.__ARRAY_APP_KEY__=${JSON.stringify(cfg.arrayAppKey)};</script><script src="/js/credit-tools.js"></script>` });

const admin = user => layout({ user, title: 'Admin — CreditFlex.ai', body: `
<section class="wrap sect"><h2>Admin</h2>
<p class="muted">Enrolls every member who has an Array ID in all CreditFlex products, one at a time. Safe to run more than once.</p>
<p><button class="btn big" id="enroll">Enroll existing members</button></p>
<pre class="card" id="out" style="white-space:pre-wrap;min-height:80px">Results will appear here.</pre></section>
<script>
document.getElementById('enroll').addEventListener('click', function () {
  var out = document.getElementById('out'); out.textContent = 'Working…';
  fetch('/api/array/enroll-existing', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    .then(function (r) { return r.json(); })
    .then(function (j) { out.textContent = JSON.stringify(j, null, 2); })
    .catch(function () { out.textContent = 'Request failed. Check the Render logs.'; });
});
</script>` });

const simple = (user, title, text) => layout({ user, title: `${title} — CreditFlex.ai`, body: `<section class="wrap sect"><h2>${esc(title)}</h2><p class="muted">${esc(text)}</p></section>` });

module.exports = { home, pricing, authPage, dashboard, creditTools, admin, simple };
