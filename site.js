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
