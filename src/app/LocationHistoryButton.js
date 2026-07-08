"use client";

import { useState } from "react";

function formatTs(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts + "Z").toLocaleString("en-US", {
      month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    });
  } catch { return ts; }
}

export default function LocationHistoryButton({ logId }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(null);

  const openModal = async () => {
    setOpen(true);
    if (history !== null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/location/history?logId=${logId}`);
      const data = await res.json();
      setHistory(data.history || []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // Build Google Maps path URL from all pings
  const mapsPathUrl =
    history && history.length > 0
      ? "https://www.google.com/maps/dir/" +
        history.map((p) => `${p.lat},${p.lon}`).join("/")
      : null;

  return (
    <>
      <button
        onClick={openModal}
        className="px-2.5 py-1 text-[10px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-all font-semibold"
      >
        📍 مسار
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="relative w-full max-w-2xl bg-slate-900 border border-white/8 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h3 className="text-sm font-bold text-gray-200">
                📍 سجل الحركة — الزائر #{logId}
              </h3>
              <div className="flex items-center gap-2">
                {mapsPathUrl && (
                  <a
                    href={mapsPathUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs rounded-lg hover:bg-cyan-500/20 transition-all font-semibold"
                  >
                    🗺️ عرض المسار كاملاً
                  </a>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all flex items-center justify-center text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="py-12 flex flex-col items-center gap-3">
                  <div className="h-8 w-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-gray-500">جاري تحميل سجل الحركة...</p>
                </div>
              ) : history && history.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-sm text-gray-500">لا توجد نبضات موقع مسجلة لهذا الزائر بعد.</p>
                  <p className="text-xs text-gray-600 mt-1">النبضات تُسجَّل عند فتح صفحة التوقعات فقط.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase bg-slate-800/50">
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">الوقت</th>
                      <th className="px-4 py-3 text-left">خط العرض</th>
                      <th className="px-4 py-3 text-left">خط الطول</th>
                      <th className="px-4 py-3 text-left">الدقة</th>
                      <th className="px-4 py-3 text-left">الخريطة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {history.map((ping, i) => (
                      <tr key={ping.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-2.5 text-gray-600 tabular-nums">{i + 1}</td>
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap tabular-nums text-xs">{formatTs(ping.timestamp)}</td>
                        <td className="px-4 py-2.5 text-violet-400 font-mono tabular-nums text-xs">{parseFloat(ping.lat).toFixed(6)}</td>
                        <td className="px-4 py-2.5 text-violet-400 font-mono tabular-nums text-xs">{parseFloat(ping.lon).toFixed(6)}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">
                          {ping.accuracy ? `±${Math.round(ping.accuracy)}م` : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <a
                            href={`https://www.google.com/maps?q=${ping.lat},${ping.lon}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 hover:underline text-xs"
                          >
                            📍 فتح
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {history && history.length > 0 && (
              <div className="px-5 py-3 border-t border-white/5 bg-slate-900/60 text-xs text-gray-500 flex justify-between">
                <span>{history.length} نبضة موقع مسجلة</span>
                {history.length >= 2 && (
                  <span>
                    من {formatTs(history[0].timestamp)} إلى {formatTs(history[history.length - 1].timestamp)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
