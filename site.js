(function () {
  var f = document.getElementById('auth');
  if (f) f.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = Object.fromEntries(new FormData(f)), err = document.getElementById('err');
    err.textContent = '';
    fetch('/api/' + f.dataset.mode, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) { if (x.ok) location.href = '/dashboard'; else err.textContent = x.j.error || 'Something went wrong'; })
      .catch(function () { err.textContent = 'Network error, please try again'; });
  });
  if (f && new URLSearchParams(location.search).get('timeout')) { var te = document.getElementById('err'); if (te) te.textContent = 'You were signed out after 5 minutes of inactivity. Please log in again.'; }
  function billingBtn(id, endpoint, errId) {
    var b = document.getElementById(id); if (!b) return;
    b.addEventListener('click', function () {
      var e = document.getElementById(errId); if (e) e.textContent = ''; b.disabled = true;
      fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(function (r) { if (r.status === 401) { location.href = '/sign-up'; return null; } return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) { if (!x) return; if (x.ok && x.j.url) location.href = x.j.url; else { b.disabled = false; if (e) e.textContent = x.j.error || 'Something went wrong. Please try again.'; } })
        .catch(function () { b.disabled = false; if (e) e.textContent = 'Network error, please try again.'; });
    });
  }
  billingBtn('start-trial', '/api/billing/checkout', 'trial-err');
  billingBtn('manage-billing', '/api/billing/portal', 'bill-err');
  var lo = document.getElementById('logout');
  if (lo) lo.addEventListener('click', function (e) {
    e.preventDefault();
    fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(function () { location.href = '/'; });
  });
})();
(function () {
  var b = document.getElementById('burger'), m = document.getElementById('menu');
  if (b && m) b.addEventListener('click', function () {
    var open = m.classList.toggle('open'); b.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  var ec = document.getElementById('email-cta');
  if (ec) ec.addEventListener('submit', function (e) {
    e.preventDefault();
    location.href = '/sign-up?email=' + encodeURIComponent(ec.elements.email.value);
  });
  var ef = document.getElementById('email-field'), q = new URLSearchParams(location.search).get('email');
  if (ef && q) ef.value = q;
})();

(function () {
  // Inactivity sign-out: 5 minutes with no activity logs the member out (the server enforces the same limit).
  if (!document.getElementById('logout')) return;
  var LIMIT = 5 * 60000, WARN = 60000, last = Date.now(), lastPing = Date.now(), warned = false, bar;
  function activity() { if (Date.now() - last > LIMIT) return; last = Date.now(); if (warned) hide(); }
  ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'].forEach(function (ev) {
    window.addEventListener(ev, activity, { passive: true, capture: true });
  });
  window.addEventListener('blur', function () { // a click into an embedded frame (e.g. the Array module) counts as activity
    setTimeout(function () { if (document.activeElement && document.activeElement.tagName === 'IFRAME') activity(); }, 0);
  });
  function show() {
    if (bar) { bar.style.display = 'flex'; return; }
    bar = document.createElement('div');
    bar.setAttribute('role', 'alert');
    bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:50;max-width:520px;margin:0 auto;background:#111827;border:1px solid #00d4aa;border-radius:14px;padding:14px 18px;display:flex;gap:14px;align-items:center;justify-content:space-between;color:#f1f5fb;box-shadow:0 8px 30px rgba(0,0,0,.5)';
    bar.innerHTML = '<span>You will be signed out in 1 minute due to inactivity.</span><button class="btn" type="button">Stay signed in</button>';
    bar.querySelector('button').addEventListener('click', function () { last = Date.now(); hide(); ping(); });
    document.body.appendChild(bar);
  }
  function hide() { warned = false; if (bar) bar.style.display = 'none'; }
  function ping() {
    lastPing = Date.now();
    fetch('/api/session/ping', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { if (r.status === 401) out(); }).catch(function () {});
  }
  function out() {
    fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .catch(function () {}).then(function () { location.href = '/login?timeout=1'; });
  }
  setInterval(function () {
    var idle = Date.now() - last;
    if (idle >= LIMIT) return out();
    if (idle >= LIMIT - WARN && !warned) { warned = true; show(); }
    if (!warned && idle < 60000 && Date.now() - lastPing >= 60000) ping(); // keep the server session alive while active
  }, 5000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - last >= LIMIT) out(); });
})();
