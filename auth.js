const crypto = require('crypto');
const cfg = require('./config');

exports.hashPassword = pw => {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64);
  return `${salt.toString('hex')}:${h.toString('hex')}`;
};
exports.verifyPassword = (pw, stored) => {
  const [s, h] = String(stored).split(':');
  if (!s || !h) return false;
  const a = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 64);
  const b = Buffer.from(h, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const sign = v => crypto.createHmac('sha256', cfg.sessionSecret).update(v).digest('base64url');
const NAME = 'cf_session';

exports.setSession = (res, uid) => {
  const payload = Buffer.from(JSON.stringify({ uid, exp: Date.now() + 14 * 864e5 })).toString('base64url');
  const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${14 * 86400}${cfg.isProd ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', `${NAME}=${payload}.${sign(payload)}; ${flags}`);
};
exports.clearSession = res =>
  res.setHeader('Set-Cookie', `${NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${cfg.isProd ? '; Secure' : ''}`);

exports.getSessionUserId = req => {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${NAME}=([^;]+)`));
  if (!m) return null;
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig) return null;
  const good = sign(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return d.exp > Date.now() ? d.uid : null;
  } catch (_) { return null; }
};
