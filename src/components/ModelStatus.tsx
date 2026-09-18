import { CircleAlert, Loader2 } from "lucide-react";
import { useModelHealth } from "@/lib/useApi";

/** One line under the page title: is the page talking to the trained ensemble or not. */
export function ModelStatus() {
  const health = useModelHealth();

  if (health.status === "error") {
    return (
      <div
        role="alert"
        className="flex items-start gap-2.5 rounded-xl border border-bad/25 bg-bad-soft px-4 py-3 text-[13px] leading-relaxed text-bad"
      >
        <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>
          ต่อกับ Model API ไม่ได้ — เปิดด้วย{" "}
          <code className="num rounded bg-bad/10 px-1.5 py-0.5 text-xs">cd ml &amp;&amp; python api.py</code>{" "}
          แล้วรีเฟรชหน้านี้
        </p>
      </div>
    );
  }

  if (health.status === "loading") {
    return (
      <p className="flex items-center gap-2 text-xs text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        กำลังเช็คสถานะโมเดล
      </p>
    );
  }

  const { data } = health;
  const years = `${Math.min(...data.fit_years)}–${Math.max(...data.fit_years)}`;

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5 font-medium text-ok">
        <span className="h-1.5 w-1.5 rounded-full bg-ok" />
        โมเดลพร้อม
      </span>
      <span className="text-faint">·</span>
      <span>
        เทรนจากประกาศ <span className="num text-ink">{data.rows_trained.toLocaleString("en-US")}</span> รายการ
      </span>
      <span className="text-faint">·</span>
      <span>ปี {years}</span>
    </p>
  );
}
