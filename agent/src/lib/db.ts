import sqlite3 from "sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { config } from "./config.js";
import { logger } from "./logger.js";

mkdirSync(dirname(config.DB_PATH), { recursive: true });

export const db = new sqlite3.Database(config.DB_PATH, (err) => {
  if (err) logger.error({ err }, "SQLite open error");
  else logger.info({ db: config.DB_PATH }, "SQLite connected");
});

export function initSchema(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(
      `
      CREATE TABLE IF NOT EXISTS donations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        donor_ref TEXT NOT NULL,
        asset TEXT NOT NULL,
        amount TEXT NOT NULL,
        usd_estimate REAL NOT NULL,
        timestamp TEXT NOT NULL,
        tx_hash TEXT,
        receipt_cid TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS proposals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id TEXT NOT NULL,
        action TEXT NOT NULL,
        asset_from TEXT NOT NULL,
        asset_to TEXT NOT NULL,
        amount TEXT NOT NULL,
        usd_estimate REAL NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        confirmed_by TEXT,
        confirmed_at TEXT,
        receipt_cid TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nonce TEXT UNIQUE NOT NULL,
        event_type TEXT NOT NULL,
        cid TEXT,
        hash TEXT NOT NULL,
        previous_hash TEXT,
        timestamp TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp TEXT DEFAULT (datetime('now'))
      );
    `,
      (err) => {
        if (err) {
          logger.error({ err }, "Schema init failed");
          reject(err);
        } else {
          logger.info("Database schema initialized");
          resolve();
        }
      }
    );
  });
}

export function run(sql: string, params: unknown[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | undefined);
    });
  });
}

export function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}
