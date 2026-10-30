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
);`);
module.exports = {
  byEmail: e => db.prepare('SELECT * FROM users WHERE email = ?').get(e),
  byId: id => db.prepare('SELECT * FROM users WHERE id = ?').get(id),
  create: (email, name, hash) =>
    Number(db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?,?,?)').run(email, name, hash).lastInsertRowid),
  withArrayId: () => db.prepare('SELECT * FROM users WHERE array_user_id IS NOT NULL AND array_user_id <> \'\'').all(),
  setArrayUserId: (id, aid) => db.prepare('UPDATE users SET array_user_id = ? WHERE id = ?').run(aid, id),
};
