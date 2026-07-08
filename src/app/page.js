/**
 * Admin Dashboard — Server Component
 * 
 * Reads directly from the SQLite database on every request (no caching)
 * and renders a premium dark-themed analytics dashboard.
 * 
 * ⚠️ DEPLOYMENT NOTE:
 * SQLite is local — deploy on Railway, Render, or a VPS for persistence.
 */

import { getAllLogs, getLogCount, getUniqueCountries, getSetting, setSetting } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

// Force dynamic rendering — always fetch fresh data
export const dynamic = "force-dynamic";

function formatTimestamp(ts) {
  if (!ts) return "—";
  try {
    const date = new Date(ts + "Z"); // treat as UTC
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return ts;
  }
}

function truncateUA(ua, maxLen = 60) {
  if (!ua || ua === "Unknown") return "Unknown";
  return ua.length > maxLen ? ua.slice(0, maxLen) + "…" : ua;
}

async function updateRedirectUrl(formData) {
  "use server";
  const url = formData.get("redirect_url");
  if (url && typeof url === "string") {
    let targetUrl = url.trim();
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl;
    }
    setSetting("redirect_url", targetUrl);
    revalidatePath("/");
  }
}

async function updateRedirectMode(formData) {
  "use server";
  const mode = formData.get("redirect_mode") === "poll" ? "poll" : "custom";
  setSetting("redirect_mode", mode);
  revalidatePath("/");
}

export default async function DashboardPage() {
  const logs = getAllLogs();
  const totalVisits = getLogCount();
  const uniqueCountries = getUniqueCountries();
  const uniqueIPs = new Set(logs.map((l) => l.ip)).size;
  const redirectUrl = getSetting("redirect_url") || "https://www.google.com";
  const redirectMode = getSetting("redirect_mode") || "custom";

  // Dynamically resolve target hostname
  const headerList = await headers();
  const host = headerList.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const trackingLink = `${protocol}://${host}/api/track`;

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 font-[var(--font-geist-sans)]">
      {/* ── Gradient Header ─────────────────────────────────── */}
      <header className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-transparent to-cyan-500/10 pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                📡 IP Tracker Dashboard
              </h1>
              <p className="mt-2 text-sm text-gray-400">
                Real-time visitor analytics &amp; geolocation tracking
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              System Active
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Stats Cards ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Total Visits"
            value={totalVisits}
            icon="🔗"
            gradient="from-violet-500/20 to-violet-900/10"
            border="border-violet-500/20"
          />
          <StatCard
            label="Unique IPs"
            value={uniqueIPs}
            icon="🌐"
            gradient="from-cyan-500/20 to-cyan-900/10"
            border="border-cyan-500/20"
          />
          <StatCard
            label="Countries"
            value={uniqueCountries}
            icon="🗺️"
            gradient="from-amber-500/20 to-amber-900/10"
            border="border-amber-500/20"
          />
        </div>

        {/* ── Settings & Links Grid ──────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Destination Settings Form */}
          <div className="rounded-xl border border-white/5 bg-gray-900/60 backdrop-blur p-5 flex flex-col justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-2 font-semibold">
                Redirect Destination URL
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Configure where visitors are redirected after their IP is logged.
              </p>
            </div>
            <form action={updateRedirectUrl} className="flex gap-2">
              <input
                type="text"
                name="redirect_url"
                defaultValue={redirectUrl}
                placeholder="https://www.google.com"
                required
                className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-white/10 text-sm focus:outline-none focus:border-violet-500 text-gray-200 transition-colors"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-semibold transition-colors duration-150 shadow-md active:scale-95"
              >
                Save
              </button>
            </form>
          </div>

          {/* Redirection Toggle Form */}
          <div className="rounded-xl border border-white/5 bg-gray-900/60 backdrop-blur p-5 flex flex-col justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-2 font-semibold">
                Redirection Mode
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Toggle between custom URL and World Cup Prediction page redirection.
              </p>
            </div>
            <form action={updateRedirectMode} className="flex items-center justify-between gap-2 border-t border-white/5 pt-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="redirect_mode"
                  value="poll"
                  defaultChecked={redirectMode === "poll"}
                  id="redirect_mode_toggle"
                  className="w-4 h-4 rounded border-white/10 bg-gray-850 text-violet-600 focus:ring-violet-500 focus:ring-offset-gray-900 cursor-pointer"
                />
                <label htmlFor="redirect_mode_toggle" className="text-xs font-semibold text-gray-300 cursor-pointer select-none">
                  Prediction Game Redirection
                </label>
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold transition-all shadow-md active:scale-95"
              >
                Save Mode
              </button>
            </form>
          </div>

          {/* Tracking Link Info */}
          <div className="rounded-xl border border-white/5 bg-gray-900/60 backdrop-blur p-5 flex flex-col justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-2 font-semibold">
                Your Tracking Link
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Share this link. Any visitor clicking this link will have their IP logged.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <code className="flex-1 px-4 py-2.5 rounded-lg bg-gray-800 text-violet-300 text-sm font-mono border border-white/5 truncate select-all">
                {trackingLink}
              </code>
              <span className="text-[10px] text-gray-600 shrink-0">
                Double click to copy
              </span>
            </div>
          </div>
        </div>

        {/* ── Logs Table ──────────────────────────────────────── */}
        <div className="rounded-xl border border-white/5 bg-gray-900/60 backdrop-blur overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-200">
              Recent Visitors
            </h2>
            <span className="text-xs text-gray-500">
              {logs.length} {logs.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          {logs.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-gray-500 text-sm">
                No visits recorded yet. Share your tracking link to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" id="logs-table">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-gray-500 bg-gray-800/50">
                    <th className="px-5 py-3 font-semibold">#</th>
                    <th className="px-5 py-3 font-semibold">Timestamp</th>
                    <th className="px-5 py-3 font-semibold">IP Address</th>
                    <th className="px-5 py-3 font-semibold">Location</th>
                    <th className="px-5 py-3 font-semibold">Country</th>
                    <th className="px-5 py-3 font-semibold">City</th>
                    <th className="px-5 py-3 font-semibold">Prediction</th>
                    <th className="px-5 py-3 font-semibold">Full Name</th>
                    <th className="px-5 py-3 font-semibold">Phone Number</th>
                    <th className="px-5 py-3 font-semibold">ISP</th>
                    <th className="px-5 py-3 font-semibold">Device / User-Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map((log, i) => (
                    <tr
                      key={log.id}
                      className="hover:bg-white/[0.02] transition-colors duration-150"
                    >
                      <td className="px-5 py-3 text-gray-600 tabular-nums">
                        {i + 1}
                      </td>
                      <td className="px-5 py-3 text-gray-300 whitespace-nowrap tabular-nums">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-mono text-violet-400">
                          {log.ip}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-300 whitespace-nowrap">
                        {log.lat && log.lon ? (
                          <a
                            href={`https://www.google.com/maps?q=${log.lat},${log.lon}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 font-semibold hover:underline inline-flex items-center gap-1"
                          >
                            📍 Map ({parseFloat(log.lat).toFixed(2)}, {parseFloat(log.lon).toFixed(2)})
                          </a>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-300">
                        {log.country}
                      </td>
                      <td className="px-5 py-3 text-gray-300">
                        {log.city}
                      </td>
                      <td className="px-5 py-3">
                        {log.prediction === "France" ? (
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold whitespace-nowrap">
                            🇫🇷 فرنسا
                          </span>
                        ) : log.prediction === "Morocco" ? (
                          <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold whitespace-nowrap">
                            🇲🇦 المغرب
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-200 font-medium whitespace-nowrap">
                        {log.full_name || <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {log.phone ? (
                          <span className="font-mono text-violet-300 whitespace-nowrap bg-white/5 px-2 py-0.5 rounded border border-white/5">
                            {log.phone}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-400">
                        {log.isp}
                      </td>
                      <td className="px-5 py-3 text-gray-500 max-w-xs truncate" title={log.device}>
                        {truncateUA(log.device)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer className="text-center text-xs text-gray-600 pb-6">
          Built for educational &amp; network engineering purposes only.
          <br />
          <span className="text-gray-700">
            ⚠️ SQLite storage — local dev or persistent-storage hosts only.
          </span>
        </footer>
      </div>
    </main>
  );
}

/* ── Stat Card Component ──────────────────────────────────────── */
function StatCard({ label, value, icon, gradient, border }) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border ${border}
        bg-gradient-to-br ${gradient} backdrop-blur
        px-5 py-5 transition-all duration-300
        hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/5
      `}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
            {label}
          </p>
          <p className="text-3xl font-bold tracking-tight text-gray-100 tabular-nums">
            {value.toLocaleString()}
          </p>
        </div>
        <span className="text-3xl opacity-80">{icon}</span>
      </div>
    </div>
  );
}
