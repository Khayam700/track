"use client";

import { useState } from "react";
import { submitPrediction } from "./actions";

export default function PredictForm({ logId }) {
  const [prediction, setPrediction] = useState(null); // 'France' or 'Morocco'
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prediction) {
      setError("الرجاء اختيار الفائز أولاً!");
      return;
    }
    if (!fullName.trim() || !phone.trim()) {
      setError("الرجاء تعبئة جميع الحقول!");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("logId", logId);
    formData.append("prediction", prediction);
    formData.append("fullName", fullName);
    formData.append("phone", phone);

    try {
      const res = await submitPrediction(formData);
      if (res.success) {
        setIsSuccess(true);
      } else {
        setError(res.error || "حدث خطأ ما. الرجاء المحاولة لاحقاً.");
      }
    } catch (err) {
      setError("فشل الاتصال بالسيرفر. حاول مرة أخرى.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 text-gray-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Animated background glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-md w-full bg-slate-900/80 border border-emerald-500/30 rounded-3xl p-8 text-center backdrop-blur-md shadow-[0_0_50px_rgba(16,185,129,0.15)] animate-fade-in">
          {/* Animated Trophy Icon */}
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 mb-6 text-5xl animate-bounce">
            🏆
          </div>

          <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent mb-4">
            لقد دخلت السحب بنجاح! 🎉
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed mb-6">
            تم تسجيل توقعك بنجاح لصالح فريق{" "}
            <span className="font-bold text-amber-400">
              {prediction === "France" ? "فرنسا 🇫🇷" : "المغرب 🇲🇦"}
            </span>
            .
            <br />
            سيتم السحب قريباً والتواصل مع الفائز بالجائزة البالغة{" "}
            <span className="font-bold text-emerald-400">10,000 ريال يمني</span> عبر رقم الجوال المسجل.
          </p>

          <div className="py-2.5 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs inline-flex items-center gap-1.5 font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            تم حفظ البيانات وتأكيد هويتك
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-rose-950/40 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-950/30 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative max-w-xl w-full bg-slate-900/60 border border-white/5 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl flex flex-col gap-6">

        {/* Header Title */}
        <div className="text-center">
          <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-3">
            🏆 مسابقة التوقعات الكبرى لكأس العالم
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-400 bg-clip-text text-transparent">
            شارك واربح 10,000 ريال يمني!
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-gray-400">
            توقع المنتخب الفائز في مباراة القمة الكلاسيكية وسجل معلوماتك للدخول في السحب الرسمي
          </p>
        </div>

        {/* Matchup Component */}
        <div className="grid grid-cols-2 gap-4 items-center relative my-2">
          {/* VS badge */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-mono font-bold text-sm text-amber-400 shadow-md">
            VS
          </div>

          {/* France Card */}
          <button
            type="button"
            onClick={() => setPrediction("France")}
            className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border transition-all duration-300 ${prediction === "France"
                ? "border-amber-400 bg-slate-900/80 shadow-[0_0_20px_rgba(251,191,36,0.15)] scale-[1.03]"
                : "border-white/5 bg-slate-900/40 hover:border-white/15 hover:scale-[1.01]"
              }`}
          >
            {/* flag design */}
            <div className="w-16 h-12 flex rounded-md overflow-hidden border border-white/10 shadow-lg mb-3">
              <div className="w-1/3 bg-blue-600" />
              <div className="w-1/3 bg-white" />
              <div className="w-1/3 bg-red-600" />
            </div>
            <span className="font-bold text-sm sm:text-base text-gray-200">فرنسا</span>
            <span className="text-[10px] text-gray-500 mt-1">Dina&#39;s prediction</span>

            {prediction === "France" && (
              <span className="absolute top-2 right-2 text-amber-400 text-xs bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                محدد ✓
              </span>
            )}
          </button>

          {/* Morocco Card */}
          <button
            type="button"
            onClick={() => setPrediction("Morocco")}
            className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border transition-all duration-300 ${prediction === "Morocco"
                ? "border-amber-400 bg-slate-900/80 shadow-[0_0_20px_rgba(251,191,36,0.15)] scale-[1.03]"
                : "border-white/5 bg-slate-900/40 hover:border-white/15 hover:scale-[1.01]"
              }`}
          >
            {/* flag design */}
            <div className="w-16 h-12 bg-red-600 flex items-center justify-center rounded-md overflow-hidden border border-white/10 shadow-lg mb-3 relative">
              {/* Star */}
              <span className="text-emerald-500 font-bold text-2xl absolute drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">⭐</span>
            </div>
            <span className="font-bold text-sm sm:text-base text-gray-200">المغرب</span>
            <span className="text-[10px] text-gray-500 mt-1">Lions prediction</span>

            {prediction === "Morocco" && (
              <span className="absolute top-2 right-2 text-amber-400 text-xs bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                محدد ✓
              </span>
            )}
          </button>
        </div>

        {/* Prediction Form */}
        {prediction && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 animate-fade-in">
            <div className="h-px bg-white/5 my-1" />

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium">
                ⚠️ {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="fullName" className="text-xs font-semibold text-amber-400/90 text-right">
                الاسم الكامل (كما هو مكتوب في البطاقة الشخصية)
              </label>
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="أدخل اسمك الثلاثي أو الرباعي"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-sm focus:outline-none focus:border-amber-400 text-gray-200 text-right transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="text-xs font-semibold text-amber-400/90 text-right">
                رقم الجوال
              </label>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07xxxxxxxx أو رقم هاتفك الفعال"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-sm focus:outline-none focus:border-amber-400 text-gray-200 text-right transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 font-bold rounded-xl text-sm transition-all duration-150 active:scale-98 disabled:opacity-50 shadow-[0_4px_20px_rgba(245,158,11,0.25)] flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full" />
                  جاري تسجيل بياناتك...
                </>
              ) : (
                "تأكيد وتثبيت التوقع للمشاركة بالسحب"
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
