/**
 * Service Worker — Location Background Sync
 *
 * Stores pending GPS pings in IndexedDB and flushes them to /api/location
 * whenever the browser regains network connectivity or the 'location-sync'
 * Background Sync event fires (e.g. after the tab has been minimised).
 *
 * Limitations:
 *  – iOS Safari: background sync is not supported; pings are only sent
 *    while the page is actively open.
 *  – Android Chrome + PWA: works even when tab is in background.
 *  – Once the browser process is fully killed, no tracking is possible on the web.
 */

const SW_VERSION = "v1";
const DB_NAME = "track-location-db";
const STORE_NAME = "pending-pings";
const DB_VERSION = 1;

// ── IndexedDB helpers ──────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deletePing(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ── Background Sync ────────────────────────────────────────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === "location-sync") {
    event.waitUntil(flushPendingPings());
  }
});

async function flushPendingPings() {
  let db;
  try {
    db = await openDB();
    const pings = await getAllPending(db);

    for (const ping of pings) {
      const { id, ...data } = ping;
      try {
        const res = await fetch("/api/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          await deletePing(db, id);
        }
      } catch {
        // Will be retried on the next sync event
      }
    }
  } catch (err) {
    console.error("[SW] flushPendingPings error:", err);
  }
}
