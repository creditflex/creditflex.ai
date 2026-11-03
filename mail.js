const https = require('https');
const http = require('http');
const cfg = require('./config');

exports.configured = () => !!(cfg.mail.apiKey && cfg.mail.from && cfg.mail.to);

// Sends a plain-text email through the Resend HTTPS API. Never logs the API key.
exports.send = (subject, text) => new Promise((resolve, reject) => {
  if (!exports.configured()) return reject(new Error('Email is not configured (set RESEND_API_KEY and EMAIL_FROM)'));
  const u = new URL(cfg.mail.apiUrl);
  const lib = u.protocol === 'http:' ? http : https;
  const data = JSON.stringify({ from: cfg.mail.from, to: [cfg.mail.to], subject: String(subject).replace(/[\r\n]+/g, ' ').slice(0, 200), text });
  const req = lib.request({
    hostname: u.hostname, port: u.port || (u.protocol === 'http:' ? 80 : 443), path: u.pathname, method: 'POST', timeout: 15000,
    headers: { Authorization: 'Bearer ' + cfg.mail.apiKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
  }, res => {
    let b = '';
    res.on('data', c => (b += c));
    res.on('end', () => (res.statusCode >= 200 && res.statusCode < 300
      ? resolve()
      : reject(new Error('Email service returned HTTP ' + res.statusCode + ' ' + b.slice(0, 200)))));
  });
  req.on('timeout', () => req.destroy(new Error('Email request timed out')));
  req.on('error', reject);
  req.end(data);
});
