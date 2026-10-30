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

// Tries each configured proxy in order. Fails over only when the proxy or network fails
// (no response from Array); any HTTP response from Array, including errors, is returned as-is.
exports.postJson = async (url, headers, body) => {
  const data = JSON.stringify(body);
  if (!cfg.proxyUrls.length) {
    if (cfg.isProd) throw new Error('No proxy configured (PROXYMESH_URL / QUOTAGUARDSTATIC_URL); refusing to call Array without a whitelisted proxy');
    return requestOnce(url, headers, data, undefined); // local development only
  }
  let lastErr;
  for (const proxyUrl of cfg.proxyUrls) {
    try {
      return await requestOnce(url, headers, data, agentFor(proxyUrl));
    } catch (e) {
      lastErr = e;
      console.error(`Proxy ${hostOf(proxyUrl)} failed (${e.message}); trying next`);
    }
  }
  throw lastErr;
};
