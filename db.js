const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const dir = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(path.join(dir, 'creditflex.db'));
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  array_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  array_user_id TEXT NOT NULL UNIQUE,
  enrollment_status TEXT,
  rejected TEXT,
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  notified_at TEXT
);
-- Members who were already enrolled before this table existed: list them, but do not email about them.
INSERT OR IGNORE INTO enrollments (user_id, array_user_id, enrollment_status, enrolled_at, notified_at)
  SELECT id, array_user_id, 'unknown', created_at, datetime('now') FROM users
  WHERE array_user_id IS NOT NULL AND array_user_id <> '';
`);
// Billing columns. Members who existed before billing was added are marked 'comped' (free access) once.
{
  const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!cols.includes('billing_status')) {
    for (const c of ['billing_status', 'stripe_customer_id', 'stripe_subscription_id', 'trial_end', 'period_end']) db.exec(`ALTER TABLE users ADD COLUMN ${c} TEXT`);
    db.exec("UPDATE users SET billing_status = 'comped'");
  }
}

// ---------- Affiliate program ----------
{
  const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!cols.includes('referred_by_affiliate_id')) db.exec('ALTER TABLE users ADD COLUMN referred_by_affiliate_id INTEGER');
}
db.exec(`
CREATE TABLE IF NOT EXISTS affiliates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | approved | suspended
  payout_method TEXT NOT NULL DEFAULT '',      -- e.g. a PayPal email, as typed by the partner
  w9_on_file INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT
);
CREATE TABLE IF NOT EXISTS payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  paid_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- One row per paid monthly invoice of a referred member (UNIQUE invoice id = never counted twice).
CREATE TABLE IF NOT EXISTS commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_id INTEGER NOT NULL,
  member_id INTEGER,
  stripe_invoice_id TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL,               -- negative for a clawback adjustment
  status TEXT NOT NULL DEFAULT 'accrued',      -- accrued | void
  payout_id INTEGER,                           -- set when included in a payout
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  eligible_at TEXT NOT NULL                    -- payable once this time has passed (refund/chargeback hold)
);
`);
const PAYABLE = "c.status = 'accrued' AND c.payout_id IS NULL AND c.eligible_at <= datetime('now')";
const PENDING = "c.status = 'accrued' AND c.payout_id IS NULL AND c.eligible_at > datetime('now')";
const sum = (cond, extra = '') => `COALESCE((SELECT SUM(c.amount_cents) FROM commissions c WHERE c.affiliate_id = a.id AND ${cond}${extra}), 0)`;
const AFF_SELECT = `SELECT a.*, u.email, u.name,
  (SELECT COUNT(*) FROM users r WHERE r.referred_by_affiliate_id = a.id) AS signups,
  (SELECT COUNT(*) FROM users r WHERE r.referred_by_affiliate_id = a.id AND r.billing_status IN ('trialing','active')) AS active_members,
  ${sum(PENDING)} AS pending_cents, ${sum(PAYABLE)} AS payable_cents,
  COALESCE((SELECT SUM(p.amount_cents) FROM payouts p WHERE p.affiliate_id = a.id), 0) AS paid_cents
  FROM affiliates a JOIN users u ON u.id = a.user_id`;

const BILLING_FIELDS = ['billing_status', 'stripe_customer_id', 'stripe_subscription_id', 'trial_end', 'period_end'];
module.exports = {
  hasAccess: u => !!u && ['trialing', 'active', 'comped'].includes(u.billing_status),
  // ----- affiliates -----
  affiliateByUser: uid => db.prepare(AFF_SELECT + ' WHERE a.user_id = ?').get(uid),
  affiliateByCode: code => db.prepare(AFF_SELECT + ' WHERE a.code = ?').get(String(code).toLowerCase()),
  affiliateById: id => db.prepare(AFF_SELECT + ' WHERE a.id = ?').get(id),
  listAffiliates: () => db.prepare(AFF_SELECT + ' ORDER BY a.created_at DESC').all(),
  createAffiliate: (uid, code, method) =>
    Number(db.prepare('INSERT INTO affiliates (user_id, code, payout_method) VALUES (?,?,?)').run(uid, code, method).lastInsertRowid),
  setAffiliateStatus: (id, status) =>
    db.prepare("UPDATE affiliates SET status = ?, approved_at = CASE WHEN ? = 'approved' AND approved_at IS NULL THEN datetime('now') ELSE approved_at END WHERE id = ?").run(status, status, id),
  setAffiliateW9: (id, v) => db.prepare('UPDATE affiliates SET w9_on_file = ? WHERE id = ?').run(v ? 1 : 0, id),
  setAffiliatePayoutMethod: (id, m) => db.prepare('UPDATE affiliates SET payout_method = ? WHERE id = ?').run(m, id),
  incClicks: id => db.prepare('UPDATE affiliates SET clicks = clicks + 1 WHERE id = ?').run(id),
  setReferredBy: (userId, affId) => db.prepare('UPDATE users SET referred_by_affiliate_id = ? WHERE id = ? AND referred_by_affiliate_id IS NULL').run(affId, userId),
  addCommission: (affId, memberId, invoiceId, cents, holdDays) =>
    db.prepare(`INSERT OR IGNORE INTO commissions (affiliate_id, member_id, stripe_invoice_id, amount_cents, eligible_at)
      VALUES (?,?,?,?, datetime('now', ?))`).run(affId, memberId, invoiceId, cents, `+${Math.max(0, Math.floor(holdDays))} days`).changes === 1,
  listCommissions: (affId, limit = 200) =>
    db.prepare(`SELECT c.*, a.code, u.email AS affiliate_email, m.email AS member_email,
      CASE WHEN c.status = 'void' THEN 'void' WHEN c.payout_id IS NOT NULL THEN 'paid' WHEN c.eligible_at > datetime('now') THEN 'pending' ELSE 'payable' END AS state
      FROM commissions c JOIN affiliates a ON a.id = c.affiliate_id JOIN users u ON u.id = a.user_id LEFT JOIN users m ON m.id = c.member_id
      ${affId ? 'WHERE c.affiliate_id = ?' : ''} ORDER BY c.created_at DESC, c.id DESC LIMIT ${Number(limit) | 0}`).all(...(affId ? [affId] : [])),
  commissionById: id => db.prepare('SELECT * FROM commissions WHERE id = ?').get(id),
  // Voiding an unpaid commission removes it. Voiding a PAID one records a negative adjustment so the next payout nets it out.
  voidCommission: (id, reason) => {
    const c = db.prepare('SELECT * FROM commissions WHERE id = ?').get(id);
    if (!c || c.status === 'void' || c.amount_cents <= 0) return { ok: false, error: 'Nothing to void' };
    db.exec('BEGIN');
    try {
      db.prepare("UPDATE commissions SET status = 'void', note = ? WHERE id = ?").run(String(reason || '').slice(0, 200), id);
      let clawback = false;
      if (c.payout_id) {
        db.prepare(`INSERT INTO commissions (affiliate_id, member_id, stripe_invoice_id, amount_cents, note, eligible_at)
          VALUES (?,?,?,?,?, datetime('now'))`).run(c.affiliate_id, c.member_id, 'clawback-' + id, -c.amount_cents, 'Clawback of commission #' + id, );
        clawback = true;
      }
      db.exec('COMMIT');
      return { ok: true, clawback };
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  },
  // Pays everything currently payable for one partner, in one transaction.
  createPayout: (affId, method, reference, note, minCents) => {
    db.exec('BEGIN');
    try {
      const row = db.prepare(`SELECT COALESCE(SUM(c.amount_cents),0) AS total, COUNT(*) AS n FROM commissions c WHERE c.affiliate_id = ? AND ${PAYABLE}`).get(affId);
      if (!row.n || row.total <= 0 || row.total < minCents) { db.exec('ROLLBACK'); return { ok: false, error: row.n ? 'Payable amount is below the minimum payout.' : 'Nothing payable yet.', total: row.total }; }
      const pid = Number(db.prepare('INSERT INTO payouts (affiliate_id, amount_cents, method, reference, note) VALUES (?,?,?,?,?)').run(affId, row.total, method, reference, note).lastInsertRowid);
      db.prepare(`UPDATE commissions SET payout_id = ? WHERE affiliate_id = ? AND id IN (SELECT c.id FROM commissions c WHERE c.affiliate_id = ? AND ${PAYABLE})`).run(pid, affId, affId);
      db.exec('COMMIT');
      return { ok: true, payoutId: pid, total: row.total, count: row.n };
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  },
  listPayouts: affId => db.prepare(`SELECT p.*, u.email AS affiliate_email FROM payouts p JOIN affiliates a ON a.id = p.affiliate_id JOIN users u ON u.id = a.user_id ${affId ? 'WHERE p.affiliate_id = ?' : ''} ORDER BY p.paid_at DESC, p.id DESC LIMIT 200`).all(...(affId ? [affId] : [])),
  affiliateYearPaidCents: affId => db.prepare("SELECT COALESCE(SUM(amount_cents),0) AS t FROM payouts WHERE affiliate_id = ? AND strftime('%Y', paid_at) = strftime('%Y', 'now')").get(affId).t,
  setBilling: (id, f) => {
    const keys = Object.keys(f).filter(k => BILLING_FIELDS.includes(k));
    if (keys.length) db.prepare(`UPDATE users SET ${keys.map(k => k + ' = ?').join(', ')} WHERE id = ?`).run(...keys.map(k => f[k]), id);
  },
  byStripeCustomer: cid => db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?').get(cid),
  byEmail: e => db.prepare('SELECT * FROM users WHERE email = ?').get(e),
  byId: id => db.prepare('SELECT * FROM users WHERE id = ?').get(id),
  create: (email, name, hash) =>
    Number(db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?,?,?)').run(email, name, hash).lastInsertRowid),
  withArrayId: () => db.prepare('SELECT * FROM users WHERE array_user_id IS NOT NULL AND array_user_id <> \'\'').all(),
  recordEnrollment: (userId, arrayUserId, status, rejected) =>
    db.prepare(`INSERT INTO enrollments (user_id, array_user_id, enrollment_status, rejected) VALUES (?,?,?,?)
      ON CONFLICT(array_user_id) DO UPDATE SET enrollment_status = excluded.enrollment_status,
      rejected = excluded.rejected, updated_at = datetime('now')`).run(userId, arrayUserId, status, rejected || ''),
  pendingEnrollments: () =>
    db.prepare(`SELECT e.enrolled_at, e.array_user_id, e.enrollment_status, u.email, u.name FROM enrollments e
      JOIN users u ON u.id = e.user_id WHERE e.notified_at IS NULL ORDER BY e.enrolled_at`).all(),
  markNotified: ids => { const st = db.prepare("UPDATE enrollments SET notified_at = datetime('now') WHERE array_user_id = ?"); ids.forEach(i => st.run(i)); },
  getMeta: k => { const r = db.prepare('SELECT v FROM meta WHERE k = ?').get(k); return r ? r.v : ''; },
  setMeta: (k, v) => db.prepare('INSERT INTO meta (k, v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, v),
  listEnrollments: () =>
    db.prepare(`SELECT e.enrolled_at, e.updated_at, e.array_user_id, e.enrollment_status, e.rejected, u.email, u.name, u.billing_status
      FROM enrollments e JOIN users u ON u.id = e.user_id ORDER BY e.enrolled_at DESC`).all(),
  setArrayUserId: (id, aid) => db.prepare('UPDATE users SET array_user_id = ? WHERE id = ?').run(aid, id),
};
