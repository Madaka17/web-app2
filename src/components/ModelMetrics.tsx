import { useState } from "react";
import { CircleAlert } from "lucide-react";
import { useModelMetrics } from "@/lib/useApi";
import { ModelMetricsReport, TestMetrics } from "@/lib/api";
import { FEATURE_LABELS } from "@/lib/featureLabels";

const MODEL_COLORS: Record<string, string> = {
  CatBoost: "#f97316",
  LightGBM: "#22c55e",
  XGBoost: "#3b82f6",
  Ensemble: "rgb(var(--c-ink))",
};
const MODEL_ORDER = ["CatBoost", "LightGBM", "XGBoost", "Ensemble"];

type MetricKey = keyof TestMetrics;

const METRICS: { key: MetricKey; label: string; hint: string; lowerIsBetter: boolean; format: (v: number) => string }[] = [
  { key: "MdAPE", label: "MdAPE", hint: "คลาดเคลื่อนกลาง", lowerIsBetter: true, format: (v) => `${v.toFixed(1)}%` },
  { key: "MAPE", label: "MAPE", hint: "คลาดเคลื่อนเฉลี่ย", lowerIsBetter: true, format: (v) => `${v.toFixed(1)}%` },
  { key: "Within_20Pct", label: "±20%", hint: "สัดส่วนที่ถูกภายใน 20%", lowerIsBetter: false, format: (v) => `${v.toFixed(1)}%` },
  { key: "Within_10Pct", label: "±10%", hint: "สัดส่วนที่ถูกภายใน 10%", lowerIsBetter: false, format: (v) => `${v.toFixed(1)}%` },
  { key: "R2", label: "R²", hint: "อธิบายความแปรปรวน", lowerIsBetter: false, format: (v) => v.toFixed(3) },
  { key: "MAE", label: "MAE", hint: "คลาดเคลื่อนเฉลี่ย (บาท)", lowerIsBetter: true, format: (v) => `${(v / 1_000_000).toFixed(2)}M` },
];

export function ModelMetrics() {
  const metrics = useModelMetrics();

  return (
    <div className="space-y-8">
      <div className="max-w-xl">
        <h2 className="font-display text-[28px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[32px]">
          โมเดลผิดบ่อยแค่ไหน
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          ทุกตัวเลขวัดจากปี test ที่โมเดลไม่เคยเห็นตอนเทรน ไม่ใช่คะแนนบนข้อมูลที่มันจำได้
        </p>
      </div>

      {metrics.status === "loading" && <ReportSkeleton />}
      {metrics.status === "error" && (
        <div className="flex items-start gap-2.5 rounded-xl border border-bad/25 bg-bad-soft px-4 py-3 text-[13px] text-bad">
          <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          อ่านรายงานไม่ได้ ({metrics.message}) — ต้องมี API ที่ 127.0.0.1:3030
        </div>
      )}
      {metrics.status === "ready" && <Report report={metrics.data} />}
    </div>
  );
}

function Report({ report }: { report: ModelMetricsReport }) {
  const [metricKey, setMetricKey] = useState<MetricKey>("MdAPE");
  const metric = METRICS.find((m) => m.key === metricKey)!;
  const ens = report.results.Ensemble.test;
  const models = MODEL_ORDER.filter((k) => report.results[k]);
  const values = models.map((k) => report.results[k].test[metricKey]);
  const best = metric.lowerIsBetter ? Math.min(...values) : Math.max(...values);
  const max = Math.max(...values);

  // jsonify sorts keys alphabetically, so the trainer's importance order is lost in transit.
  const importance = Object.entries(report.feature_importance)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const maxImportance = importance[0]?.[1] ?? 1;
  const calibration = Object.entries(report.calibration ?? {}).filter(([k]) => k !== "__default__");

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Headline tiles: one heavy, three light */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card col-span-2 flex flex-col justify-between p-6 lg:row-span-2">
          <p className="label">Ensemble · คลาดเคลื่อนกลาง (MdAPE)</p>
          <div>
            <p className="num mt-4 font-display text-[56px] font-semibold leading-none tracking-tight text-ink sm:text-[72px]">
              {ens.MdAPE.toFixed(1)}
              <span className="text-[28px] text-muted">%</span>
            </p>
            <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-muted">
              ครึ่งหนึ่งของประกาศในชุด test ทายพลาดน้อยกว่านี้ อีกครึ่งพลาดมากกว่า — ราคาประกาศขายกระจายกว้างกว่าราคาประเมินมาก
            </p>
          </div>
        </div>
        <Tile label="ถูกภายใน ±20%" value={`${ens.Within_20Pct.toFixed(1)}%`} />
        <Tile label="ถูกภายใน ±10%" value={`${ens.Within_10Pct.toFixed(1)}%`} />
        <Tile label="แถว test" value={report.rows.test.toLocaleString("en-US")} sub={`ปี ${report.protocol.test_years.join(", ")}`} />
        <Tile
          label="แถวที่เทรน"
          value={(report.rows.fit + report.rows.validation).toLocaleString("en-US")}
          sub={`ปี ${Math.min(...report.protocol.served_model_fit_years)}–${Math.max(...report.protocol.served_model_fit_years)}`}
        />
      </div>

      {/* Comparison */}
      <section className="card p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="label">เทียบทีละตัว</h3>
            <p className="mt-1 text-[12px] text-muted">
              {metric.hint} · {metric.lowerIsBetter ? "ต่ำกว่าดีกว่า" : "สูงกว่าดีกว่า"}
            </p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg bg-raised p-0.5">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetricKey(m.key)}
                aria-pressed={metricKey === m.key}
                className={`num rounded-md px-2.5 py-1 text-[12px] font-medium transition-all active:scale-95 ${
                  metricKey === m.key ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-5 space-y-3">
          {models.map((k, i) => {
            const v = values[i];
            const isBest = v === best;
            const w = report.results[k].weight;
            return (
              <li key={k} className="grid grid-cols-[110px_minmax(0,1fr)_72px] items-center gap-3 sm:grid-cols-[140px_minmax(0,1fr)_88px]">
                <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: MODEL_COLORS[k] }} />
                  <span className="truncate">{k}</span>
                  {k !== "Ensemble" && <span className="num text-[11px] text-faint">{Math.round(w * 100)}%</span>}
                </span>
                <div className="h-2 overflow-hidden rounded-full bg-raised">
                  <div
                    className={`h-full origin-left animate-grow-x rounded-full ${isBest ? "" : "opacity-60"}`}
                    style={{ width: `${(v / max) * 100}%`, backgroundColor: MODEL_COLORS[k] }}
                  />
                </div>
                <span className={`num text-right text-[13px] ${isBest ? "font-semibold text-ink" : "text-muted"}`}>
                  {metric.format(v)}
                </span>
              </li>
            );
          })}
        </ul>

        {/* Full table for the curious */}
        <details className="mt-5 border-t border-line/70 pt-4">
          <summary className="cursor-pointer text-[12.5px] font-medium text-muted transition-colors hover:text-ink">
            ดูตารางเต็ม
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="num w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-label text-faint">
                  <th className="pb-2 pr-3 font-medium">โมเดล</th>
                  {METRICS.map((m) => (
                    <th key={m.key} className="pb-2 pr-3 text-right font-medium">
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {models.map((k) => (
                  <tr key={k}>
                    <td className="py-2 pr-3 font-sans font-medium text-ink">{k}</td>
                    {METRICS.map((m) => (
                      <td key={m.key} className="py-2 pr-3 text-right text-muted">
                        {m.format(report.results[k].test[m.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Calibration by type */}
        <section className="card p-5 sm:p-6 lg:col-span-2">
          <h3 className="label">แยกตามประเภท</h3>
          <p className="mt-1 text-[12px] text-muted">ช่วงต่ำ–สูงที่หน้าเว็บใช้ = ราคาทาย × ตัวคูณ</p>
          <ul className="mt-4 divide-y divide-line/70">
            {calibration.map(([type, c]) => (
              <li key={type} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13.5px] font-medium text-ink">{type}</span>
                  <span className="num text-[11px] text-faint">n = {c.n.toLocaleString("en-US")}</span>
                </div>
                <div className="num mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-muted">
                  <span>
                    ×{c.q10.toFixed(2)} – ×{c.q90.toFixed(2)}
                  </span>
                  <span>MdAPE {c.MdAPE.toFixed(1)}%</span>
                  <span>±20% {c.within_20pct.toFixed(1)}%</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Feature importance */}
        <section className="card p-5 sm:p-6 lg:col-span-3">
          <div className="flex items-baseline justify-between">
            <h3 className="label">ตัวแปรที่ CatBoost พึ่งมากที่สุด</h3>
            <span className="text-[11px] text-faint">10 จาก {report.features.length}</span>
          </div>
          <ul className="mt-4 space-y-2.5">
            {importance.map(([key, v]) => (
              <li key={key} className="grid grid-cols-[minmax(0,1fr)_40px] items-center gap-3">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[13px] text-ink">{FEATURE_LABELS[key] ?? key}</span>
                    <code className="num hidden flex-shrink-0 text-[10.5px] text-faint sm:inline">{key}</code>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised">
                    <div
                      className="h-full origin-left animate-grow-x rounded-full bg-ink/80"
                      style={{ width: `${(v / maxImportance) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="num text-right text-[12px] text-muted">{(v * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="label">{label}</p>
      <p className="num mt-2 font-display text-[26px] font-semibold leading-none tracking-tight text-ink">{value}</p>
      {sub && <p className="num mt-1.5 text-[11px] text-faint">{sub}</p>}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" role="status" aria-label="กำลังโหลดรายงาน">
      <div className="card col-span-2 h-56 animate-pulse lg:row-span-2" />
      <div className="card h-24 animate-pulse" />
      <div className="card h-24 animate-pulse" />
      <div className="card h-24 animate-pulse" />
      <div className="card h-24 animate-pulse" />
    </div>
  );
}
