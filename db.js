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
const BILLING_FIELDS = ['billing_status', 'stripe_customer_id', 'stripe_subscription_id', 'trial_end', 'period_end'];
module.exports = {
  hasAccess: u => !!u && ['trialing', 'active', 'comped'].includes(u.billing_status),
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
