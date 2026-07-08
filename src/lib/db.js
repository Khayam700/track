/**
 * SQLite Database Helper Utility
 * 
 * ⚠️ DEPLOYMENT NOTE:
 * This SQLite setup is optimized for LOCAL DEVELOPMENT or platforms with
 * persistent file-system storage (Railway, Render, self-hosted VPS).
 * 
 * Vercel and similar serverless platforms use a READ-ONLY / EPHEMERAL
 * filesystem — the database file will be lost on every cold start.
 * For production on those platforms, migrate to PostgreSQL, MySQL,
 * or a managed SQLite service like Turso / LiteFS.
 */

import Database from "better-sqlite3";
import path from "path";

// Store the database file at the project root
const DB_PATH = path.join(process.cwd(), "tracker.db");

let db;

function getDatabase() {
  if (!db) {
    db = new Database(DB_PATH);

    // Enable WAL mode for better concurrent read performance
    db.pragma("journal_mode = WAL");

    // Create the logs table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        ip        TEXT NOT NULL,
        country   TEXT DEFAULT 'Unknown',
        city      TEXT DEFAULT 'Unknown',
        isp       TEXT DEFAULT 'Unknown',
        device    TEXT DEFAULT 'Unknown',
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Create the settings table for configurable values (e.g. redirect URL)
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Insert default redirect URL if not already set
    db.prepare(`
      INSERT OR IGNORE INTO settings (key, value)
      VALUES ('redirect_url', 'https://www.google.com')
    `).run();
  }
  return db;
}

/**
 * Insert a new tracking log entry
 */
export function insertLog({ ip, country, city, isp, device }) {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO logs (ip, country, city, isp, device, timestamp)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);
  return stmt.run(ip, country, city, isp, device);
}

/**
 * Retrieve all logs ordered by most recent first
 */
export function getAllLogs() {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT id, ip, country, city, isp, device, timestamp
    FROM logs
    ORDER BY id DESC
  `);
  return stmt.all();
}

/**
 * Get total count of tracked visits
 */
export function getLogCount() {
  const database = getDatabase();
  const row = database.prepare("SELECT COUNT(*) as count FROM logs").get();
  return row.count;
}

/**
 * Get unique country count
 */
export function getUniqueCountries() {
  const database = getDatabase();
  const row = database.prepare("SELECT COUNT(DISTINCT country) as count FROM logs WHERE country != 'Unknown'").get();
  return row.count;
}

/**
 * Get the most recent log entry
 */
export function getLatestLog() {
  const database = getDatabase();
  return database.prepare("SELECT * FROM logs ORDER BY id DESC LIMIT 1").get();
}

/**
 * Get a setting value by key
 */
export function getSetting(key) {
  const database = getDatabase();
  const row = database.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : null;
}

/**
 * Set a setting value (upsert)
 */
export function setSetting(key, value) {
  const database = getDatabase();
  database.prepare(`
    INSERT OR REPLACE INTO settings (key, value)
    VALUES (?, ?)
  `).run(key, value);
}
