(function () {
  var APP_KEY = window.__ARRAY_APP_KEY__;
  var SRC = 'https://embed.array.io/cms/array-dynamic-controller.js?appKey=' + APP_KEY;
  var host = document.getElementById('array-host');
  var busy = false; // prevents the logout flow from running twice at once

  function show(msg, withRetry) {
    host.innerHTML = '';
    var p = document.createElement('p'); p.textContent = msg; host.appendChild(p);
    if (withRetry) {
      var b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Try again';
      b.onclick = function () { show('Loading your credit tools…'); start(); };
      host.appendChild(b);
    }
  }

  function loadScript() {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[data-array-dmc]')) return resolve(); // never add it twice
      var s = document.createElement('script');
      s.src = SRC; s.async = true; s.setAttribute('data-array-dmc', '1');
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Resolves { token, failed }. failed=true means the server HAS an Array user for this
  // member but could not get a token (a temporary problem). We must not show signup then.
  function fetchToken() {
    return fetch('/api/array/token', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : { userToken: null, error: 'http-' + r.status }; })
      .then(function (j) { return { token: j && j.userToken ? j.userToken : null, failed: !!(j && j.error) }; })
      .catch(function () { return { token: null, failed: true }; });
  }
  // A member who already has an Array ID (server says failed=true when it could not get a token)
  // must never be shown signup / identity verification again: retry once, then show a message.
  function getToken() {
    return fetchToken().then(function (r) {
      if (!r.failed) return r;
      return new Promise(function (res) { setTimeout(res, 1500); }).then(fetchToken);
    });
  }

  function mount(token) {
    host.innerHTML = '';
    var el = document.createElement('array-dynamic-controller');
    el.setAttribute('appKey', APP_KEY);
    el.setAttribute('configKey', 'DMCConfig');
    el.setAttribute('forceColorScheme', 'light');
    if (token) el.setAttribute('userToken', token); // only when non-null
    host.appendChild(el);
  }

  function mountFrom(r) {
    if (r.failed && !r.token) return show("We couldn't reach your credit tools right now.", true);
    mount(r.token);
  }

  function post(url, body) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  function enrolledUserId(d) {
    var cu = d.metadata && d.metadata.createdUsers;
    if (!cu) return null;
    var u = cu[APP_KEY];
    if (!u) { var k = Object.keys(cu)[0]; u = k ? cu[k] : null; } // fall back to the first created user
    return u && u.userId ? u.userId : null;
  }

  function onArrayEvent(event) {
    var d = event && event.detail;
    if (!d) return;
    var name = d.event || d.type || d.eventType || d.name;
    // Log which events arrive (names/keys only) so the server log shows what Array sends.
    post('/api/array/event-log', { event: name, keys: Object.keys(d), metaKeys: Object.keys(d.metadata || {}) }).catch(function () {});
    if (name === 'enrollment-complete') {
      var id = enrolledUserId(d);
      if (id) post('/api/array/enrolled', { userId: id });
    } else if (name === 'logout') {
      if (busy) return;
      busy = true;
      getToken().then(mountFrom).then(function () { busy = false; }, function () { busy = false; });
    }
  }

  function start() {
    loadScript().then(getToken).then(mountFrom).catch(function () {
      show("We couldn't load your credit tools. Please refresh the page.");
    });
  }

  window.addEventListener('array-event', onArrayEvent);
  window.addEventListener('pagehide', function () { window.removeEventListener('array-event', onArrayEvent); });
  start();
})();
