import { useEffect, useState } from "react";
import { CircleAlert, Cpu, Loader2 } from "lucide-react";
import { getHealth, ModelHealth } from "@/lib/api";

/** Shows whether the page is talking to the trained ensemble or nothing at all. */
export function ModelStatus() {
  const [health, setHealth] = useState<ModelHealth | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then(setHealth)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, []);

  if (failed) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/25 dark:bg-red-500/10">
        <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
        <p className="text-xs leading-5 text-red-700 dark:text-red-300">
          ต่อกับ Model API ไม่ได้ — เปิดด้วย{" "}
          <code className="rounded bg-red-100 px-1 dark:bg-red-500/20">
            cd ml &amp;&amp; .venv/bin/python api.py
          </code>
        </p>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        <p className="text-xs text-slate-500 dark:text-slate-400">กำลังเช็คสถานะโมเดล...</p>
      </div>
    );
  }

  const weights = Object.entries(health.weights)
    .sort((a, b) => b[1] - a[1])
    .map(([name, w]) => `${name} ${Math.round(w * 100)}%`)
    .join(" · ");

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-500/25 dark:bg-green-500/10">
      <span className="flex items-center gap-1.5 text-xs font-bold text-green-700 dark:text-green-400">
        <Cpu className="h-3.5 w-3.5" />
        โมเดลพร้อมใช้งาน
      </span>
      <span className="text-xs text-green-800/80 dark:text-green-300/80">{weights}</span>
      <span className="text-xs text-green-800/60 dark:text-green-300/60">
        เทรนจาก {health.rows_trained.toLocaleString("en-US")} รายการจำลอง (ปี{" "}
        {Math.min(...health.fit_years)}–{Math.max(...health.fit_years)})
      </span>
    </div>
  );
}
