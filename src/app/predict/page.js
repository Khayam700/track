import { Suspense } from "react";
import PredictForm from "./PredictForm";

export const dynamic = "force-dynamic";

export default async function PredictPage(props) {
  const searchParams = await props.searchParams;
  const logId = searchParams?.logId || "";

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="animate-spin h-8 w-8 border-4 border-amber-400 border-t-transparent rounded-full" />
          <p className="text-sm text-gray-400">جاري تحميل مسابقة التوقعات...</p>
        </div>
      </div>
    }>
      <PredictForm logId={logId} />
    </Suspense>
  );
}
