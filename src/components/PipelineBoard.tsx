import { Check, Loader2, CircleAlert } from "lucide-react";
import { useModelHealth, useModelMetrics } from "@/lib/useApi";
import { ModelMetricsReport } from "@/lib/api";

const MODEL_COLORS: Record<string, string> = { CatBoost: "#f97316", LightGBM: "#22c55e", XGBoost: "#3b82f6" };

const n = (v: number | undefined) => (v === undefined ? "—" : v.toLocaleString("en-US"));

interface Stage {
  id: string;
  title: string;
  file: string;
  summary: string;
  detail: (m: ModelMetricsReport | null) => { label: string; value: string }[];
}

/** The real path from a scraped listing to a served price, one step per script in ml/. */
const STAGES: Stage[] = [
  {
    id: "scrape",
    title: "เก็บประกาศขาย",
    file: "Data/scrape_dotproperty.py",
    summary: "ดึงประกาศจาก dotproperty.co.th ในกรุงเทพฯ และปริมณฑล: ประเภท พื้นที่ ราคา เขต จังหวัด วันที่ลง",
    detail: (m) => [
      { label: "ประกาศ 4 ประเภท หลังตัดซ้ำ", value: n(m?.cleaning.rows_in) },
    ],
  },
  {
    id: "prepare",
    title: "ทำความสะอาดและสร้างตัวแปร",
    file: "ml/prepare_data.py",
    summary:
      "ตัดราคานอกช่วง 50,000–200 ล้าน และพื้นที่นอก 10–20,000 ตร.ม. แล้วอธิบายทุกแถวด้วยประกาศเทียบเคียงจากปีก่อนหน้า สี่ระดับความกว้าง",
    detail: (m) => [
      { label: "ตัดเพราะข้อมูลว่าง", value: n(m?.cleaning.dropped_null) },
      { label: "ตัดเพราะราคานอกช่วง", value: n(m?.cleaning.dropped_value_range) },
      { label: "ตัดเพราะพื้นที่นอกช่วง", value: n(m?.cleaning.dropped_area_range) },
      { label: "เหลือใช้", value: n(m?.cleaning.rows_out) },
    ],
  },
  {
    id: "train",
    title: "เทรนสามโมเดล",
    file: "ml/train_models.py",
    summary:
      "CatBoost, LightGBM, XGBoost ทำนาย log ราคาต่อ ตร.ม. ด้วย loss แบบ absolute error แบ่งตามปี: fit ปีเก่า เลือกน้ำหนักด้วยปี validation แล้ววัดผลครั้งเดียวกับปี test",
    detail: (m) => [
      { label: "แถว fit", value: n(m?.rows.fit) },
      { label: "แถว validation", value: n(m?.rows.validation) },
      { label: "แถว test", value: n(m?.rows.test) },
      ...(m
        ? Object.entries(m.results)
            .filter(([k]) => k !== "Ensemble")
            .map(([k, v]) => ({ label: `เวลาเทรน ${k}`, value: v.train_seconds ? `${v.train_seconds}s` : "—" }))
        : []),
    ],
  },
  {
    id: "calibrate",
    title: "วัดช่วงความคลาดเคลื่อน",
    file: "ml/calibrate.py",
    summary:
      "เอาโมเดลที่จะให้บริการไปทายปี test ที่ไม่เคยเห็น แล้วเก็บเปอร์เซ็นไทล์ 10 และ 90 ของ ราคาจริง ÷ ราคาทาย แยกตามประเภท เป็นช่วงต่ำ–สูงที่หน้าเว็บแสดง",
    detail: (m) =>
      m?.calibration
        ? Object.entries(m.calibration)
            .filter(([k]) => k !== "__default__")
            .map(([k, c]) => ({ label: k, value: `×${c.q10.toFixed(2)} – ×${c.q90.toFixed(2)}` }))
        : [],
  },
  {
    id: "serve",
    title: "ให้บริการผ่าน API",
    file: "ml/api.py",
    summary: "Flask ที่ 127.0.0.1:3030 — /api/health, /api/predict, /api/metrics หน้าเว็บนี้เรียกตรง",
    detail: () => [],
  },
];

export function PipelineBoard() {
  const metrics = useModelMetrics();
  const health = useModelHealth();
  const report = metrics.status === "ready" ? metrics.data : null;

  return (
    <div className="space-y-8">
      <div className="max-w-xl">
        <h2 className="font-display text-[28px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[32px]">
          จากประกาศขายถึงตัวเลขบนหน้าเว็บ
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          ห้าขั้น ห้าไฟล์ ตัวเลขด้านล่างอ่านจาก <code className="num text-[12px] text-ink">metrics.json</code> ที่ตัวเทรนเขียนไว้
          ไม่ได้พิมพ์มือ
        </p>
      </div>

      {metrics.status === "error" && (
        <div className="flex items-start gap-2.5 rounded-xl border border-bad/25 bg-bad-soft px-4 py-3 text-[13px] text-bad">
          <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          อ่าน metrics ไม่ได้ ({metrics.message}) — ตัวเลขจะขึ้นเมื่อ API ทำงาน
        </div>
      )}

      <ol className="relative space-y-2">
        {STAGES.map((stage, i) => {
          const isServe = stage.id === "serve";
          const state: "done" | "loading" | "error" = isServe
            ? health.status === "ready"
              ? "done"
              : health.status === "error"
                ? "error"
                : "loading"
            : metrics.status === "ready"
              ? "done"
              : metrics.status === "error"
                ? "error"
                : "loading";
          const rows = stage.detail(report);

          return (
            <li key={stage.id} className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-4 sm:grid-cols-[40px_minmax(0,1fr)]">
              {/* Rail */}
              <div className="flex flex-col items-center">
                <span
                  className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-full border text-[12px] font-semibold ${
                    state === "done"
                      ? "border-ink bg-ink text-canvas"
                      : state === "error"
                        ? "border-bad/40 bg-bad-soft text-bad"
                        : "border-line bg-surface text-muted"
                  }`}
                  aria-label={state === "done" ? "เสร็จแล้ว" : state === "error" ? "ไม่พร้อม" : "กำลังโหลด"}
                >
                  {state === "done" ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  ) : state === "loading" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    i + 1
                  )}
                </span>
                {i < STAGES.length - 1 && <span className="my-1 w-px flex-1 bg-line" />}
              </div>

              {/* Content */}
              <div className={`pb-6 ${i === STAGES.length - 1 ? "pb-0" : ""}`}>
                <div className="card p-5 sm:p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="font-display text-[17px] font-semibold text-ink">
                      <span className="num mr-2 text-[13px] font-medium text-faint">0{i + 1}</span>
                      {stage.title}
                    </h3>
                    <code className="num text-[11.5px] text-muted">{stage.file}</code>
                  </div>
                  <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted">{stage.summary}</p>

                  {rows.length > 0 && (
                    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line/70 pt-4 sm:grid-cols-3 lg:grid-cols-4">
                      {rows.map((d) => (
                        <div key={d.label} className="min-w-0">
                          <dt className="truncate text-[11px] text-faint">{d.label}</dt>
                          <dd className="num text-[14px] font-medium text-ink">{d.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {stage.id === "train" && report && (
                    <div className="mt-4 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                      {Object.entries(report.results)
                        .filter(([k]) => k !== "Ensemble")
                        .map(([k, v]) => (
                          <div
                            key={k}
                            title={`${k} ${Math.round(v.weight * 100)}%`}
                            className="h-full rounded-sm"
                            style={{ width: `${v.weight * 100}%`, backgroundColor: MODEL_COLORS[k] }}
                          />
                        ))}
                    </div>
                  )}

                  {isServe && (
                    <p className="mt-4 border-t border-line/70 pt-4 text-[13px]">
                      {health.status === "ready" ? (
                        <span className="text-ok">
                          ตอบแล้ว · {health.data.models.join(", ")} · เทรนจาก{" "}
                          <span className="num">{health.data.rows_trained.toLocaleString("en-US")}</span> แถว
                        </span>
                      ) : health.status === "error" ? (
                        <span className="text-bad">
                          ยังไม่ตอบ — รัน <code className="num text-[12px]">cd ml &amp;&amp; python api.py</code>
                        </span>
                      ) : (
                        <span className="text-muted">กำลังเช็ค</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
