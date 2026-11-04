// Sends an HTTPS request through the QuotaGuard static-IP proxy using an HTTP CONNECT tunnel.
// No dependencies. Every Array server-to-server call goes through here so Array sees your static IPs.
const https = require('https');
const http = require('http');
const tls = require('tls');
const cfg = require('./config');

class ConnectAgent extends https.Agent {
  constructor(proxyUrl) {
    super({ keepAlive: false });
    this.proxy = new URL(proxyUrl);
  }
  createConnection(options, cb) {
    const p = this.proxy;
    const headers = {};
    if (p.username) {
      const cred = `${decodeURIComponent(p.username)}:${decodeURIComponent(p.password)}`;
      headers['Proxy-Authorization'] = 'Basic ' + Buffer.from(cred).toString('base64');
    }
    const target = `${options.host}:${options.port || 443}`;
    const req = http.request({ host: p.hostname, port: p.port || 80, method: 'CONNECT', path: target, headers });
    req.once('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        return cb(new Error(`Proxy CONNECT failed: HTTP ${res.statusCode}`));
      }
      cb(null, tls.connect({ socket, servername: options.servername || options.host }));
    });
    req.once('error', cb);
    req.end();
  }
}

const agents = new Map();
const agentFor = url => {
  if (!agents.has(url)) agents.set(url, new ConnectAgent(url));
  return agents.get(url);
};
const hostOf = url => { try { return new URL(url).host; } catch (_) { return 'proxy'; } };

function requestOnce(url, headers, data, agent) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        agent, host: u.hostname, port: 443, path: u.pathname + u.search, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
        timeout: 20000,
      },
      res => {
        let buf = '';
        res.on('data', c => (buf += c));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(buf); } catch (_) {}
          resolve({ status: res.statusCode, json, text: buf });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Request to Array timed out')));
    req.on('error', reject);
    req.end(data);
  });
}

// Tries the configured proxies in order, remembering the one that worked last so it goes first next time.
// Fails over when the proxy or network fails, AND when Array answers 403: Array returns 403 when the call comes
// from an IP address it has not approved, and the next proxy may use an approved one. Any other answer
// from Array (200, 400, 401...) is returned as-is. If every proxy gets a 403, the last 403 is returned.
let doRequest = requestOnce; // replaced only by tests
exports._setRequester = f => { doRequest = f; };
let preferred = 0;
exports.postJson = async (url, headers, body) => {
  const data = JSON.stringify(body);
  if (!cfg.proxyUrls.length) {
    if (cfg.isProd) throw new Error('No proxy configured (PROXYMESH_URL / QUOTAGUARDSTATIC_URL); refusing to call Array without a whitelisted proxy');
    return doRequest(url, headers, data, undefined); // local development only
  }
  const n = cfg.proxyUrls.length;
  let lastErr, lastResp;
  for (let k = 0; k < n; k++) {
    const i = (preferred + k) % n;
    const proxyUrl = cfg.proxyUrls[i];
    try {
      const r = await doRequest(url, headers, data, agentFor(proxyUrl));
      if (r.status === 403 && k < n - 1) {
        lastResp = r;
        console.error(`Proxy ${hostOf(proxyUrl)}: Array answered 403 (IP not approved or bad token); trying next`);
        continue;
      }
      if (r.status !== 403) preferred = i;
      return r;
    } catch (e) {
      lastErr = e;
      console.error(`Proxy ${hostOf(proxyUrl)} failed (${e.message}); trying next`);
    }
  }
  if (lastResp) return lastResp;
  throw lastErr;
};

function getOnce(url, agent) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ agent, host: u.hostname, port: 443, path: u.pathname, method: 'GET', timeout: 15000 }, res => {
      let b = ''; res.on('data', c => (b += c)); res.on('end', () => resolve(b.trim().slice(0, 60)));
    });
    req.on('timeout', () => req.destroy(new Error('timed out'))); req.on('error', reject); req.end();
  });
}

// Admin diagnostic: tries each configured proxy on its own and reports what happened (never shows credentials).
exports.probe = async (url, headers, body) => {
  const data = JSON.stringify(body);
  const out = [];
  if (!cfg.proxySources.length) return [{ proxy: '(none configured)', ok: false, detail: 'No proxy setting was found in Render Environment (PROXYMESH_URL / QUOTAGUARDSTATIC_URL)' }];
  for (const src of cfg.proxySources) {
    const notes = src.problems.length ? ' Notes: ' + src.problems.join('; ') + '.' : '';
    if (!src.valid) { out.push({ proxy: src.label, ok: false, detail: 'This value is not a valid proxy URL. Expected http://USERNAME:PASSWORD@HOST:PORT.' + notes }); continue; }
    const name = src.label + ' (' + hostOf(src.url) + ')';
    try {
      let ip = '';
      try { ip = await getOnce('https://api.ipify.org/', agentFor(src.url)); } catch (_) { ip = 'unknown'; }
      const r = await requestOnce(url, headers, data, agentFor(src.url));
      out.push({ ip, proxy: name, ok: true, status: r.status, hasToken: !!(r.json && r.json.userToken), detail: 'Array sees this IP: ' + ip + '. ' + (r.status === 200 ? 'Array answered and issued a token.' : 'Array answered with HTTP ' + r.status + ' ' + String(r.text).slice(0, 200)) + notes });
    } catch (e) { out.push({ proxy: name, ok: false, detail: String(e.message).replace(/\/\/[^@\s]*@/g, '//***@') + notes }); }
  }
  return out;
};
