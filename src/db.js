import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      store TEXT NOT NULL,
      url TEXT NOT NULL,
      image_url TEXT,
      target_price REAL,
      min_discount_percent REAL NOT NULL DEFAULT 25,
      currency TEXT DEFAULT 'MXN',
      enabled INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      price REAL NOT NULL,
      currency TEXT DEFAULT 'MXN',
      source TEXT,
      raw_title TEXT,
      checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      price REAL NOT NULL,
      previous_price REAL,
      currency TEXT DEFAULT 'MXN',
      reason TEXT NOT NULL,
      sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id, checked_at DESC);
    CREATE INDEX IF NOT EXISTS idx_alerts_product ON alerts(product_id, created_at DESC);
  `);
}

export function ensureInitialAdmin() {
  const count = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
  if (count > 0) return;

  const passwordHash = bcrypt.hashSync(config.adminPassword, 12);
  db.prepare(`
    INSERT INTO users (name, email, password_hash, role, active)
    VALUES (?, ?, ?, 'admin', 1)
  `).run(config.adminName, config.adminEmail.toLowerCase(), passwordHash);
}

export function initDatabase() {
  migrate();
  ensureInitialAdmin();
}
