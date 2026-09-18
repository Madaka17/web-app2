import {
  Train,
  Maximize,
  MapPin,
  BedDouble,
  CalendarClock,
  Building2,
  Car,
  Download,
  FileJson,
  FileText,
  FileSpreadsheet,
  Check,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PredictionInput } from "@/lib/types";
import { formatBaht } from "@/lib/prediction";
import { ApiPrediction } from "@/lib/api";
import { downloadFile, reportToJSON, reportToCSV, reportToText } from "@/lib/download";

const ICON_MAP: Record<string, typeof Train> = {
  Train,
  Maximize,
  MapPin,
  BedDouble,
  CalendarClock,
  Building2,
  Car,
};

interface ResultPanelProps {
  result: ApiPrediction;
  input: PredictionInput;
}

export function ResultPanel({ result, input }: ResultPanelProps) {
  const maxFeatureValue = Math.max(...result.features.map((f) => f.value));
  const barTotal = result.contributions.reduce((sum, c) => sum + c.weight, 0);
  const perSqm = result.predictedPrice / input.area;
  // Where the point estimate sits inside its own interval, for the range rule.
  const span = result.upperBound - result.lowerBound || 1;
  const pointPct = ((result.predictedPrice - result.lowerBound) / span) * 100;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Price */}
      <section className="card relative overflow-hidden p-6 sm:p-7">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom_left,black,transparent_60%)]" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="label">ราคาคาดการณ์ · {result.meta.collateral_type}</p>
              <p className="mt-2 font-display text-[40px] font-semibold leading-none tracking-tight text-accent sm:text-[48px]">
                {formatBaht(result.predictedPrice)}
              </p>
              <p className="mt-2 text-[13px] text-muted">
                ≈ <span className="num text-ink">฿{Math.round(perSqm).toLocaleString("en-US")}</span> ต่อ ตร.ม. ·{" "}
                {result.meta.subdistrict}, {result.meta.district}
              </p>
            </div>
            <DownloadMenu input={input} result={result} />
          </div>

          {/* Interval rule */}
          <div className="mt-7">
            <div className="relative h-1.5 rounded-full bg-line">
              <div
                className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-ink"
                style={{ left: `${pointPct}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="mt-2 flex justify-between text-[12px]">
              <span className="text-muted">
                ต่ำ <span className="num font-medium text-ink">{formatBaht(result.lowerBound)}</span>
              </span>
              <span className="text-muted">
                สูง <span className="num font-medium text-ink">{formatBaht(result.upperBound)}</span>
              </span>
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
              ช่วงนี้คือเปอร์เซ็นไทล์ที่ 10–90 ของ ราคาจริง ÷ ราคาที่ทำนาย บนชุดทดสอบของ{result.meta.collateral_type}
            </p>
          </div>
        </div>
      </section>

      {/* Accuracy + ensemble, side by side with different weights */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <section className="card p-5 md:col-span-2">
          <h3 className="label">แม่นแค่ไหนกับกลุ่มนี้</h3>
          <dl className="mt-4 space-y-3.5">
            <Stat label="ถูกต้องภายใน ±20%" value={`${result.meta.within_20pct}%`} emphasis />
            <Stat label="คลาดเคลื่อนกลาง" value={`${result.meta.median_abs_pct_error}%`} />
            <Stat label="ตัวอย่างที่วัด" value={result.meta.sample_size.toLocaleString("en-US")} />
          </dl>
          <p className="mt-4 border-t border-line/80 pt-3 text-[11.5px] leading-relaxed text-faint">
            วัดจากประกาศปีล่าสุดที่โมเดลไม่เคยเห็นตอนเทรน
            {!result.meta.district_in_training_data && (
              <span className="mt-1 block text-warn">
                เขตนี้ไม่มีในข้อมูลเทรน — ใช้ค่าระดับจังหวัดแทน
              </span>
            )}
          </p>
        </section>

        <section className="card p-5 md:col-span-3">
          <div className="flex items-baseline justify-between">
            <h3 className="label">สามโมเดลว่าอย่างไร</h3>
            <span className="text-[11px] text-faint">น้ำหนักเลือกจากชุด validation</span>
          </div>

          <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full">
            {result.contributions.map((c) => (
              <div
                key={c.name}
                className="h-full origin-left animate-grow-x rounded-sm"
                style={{ width: `${(c.weight / barTotal) * 100}%`, backgroundColor: c.color }}
              />
            ))}
          </div>

          <ul className="mt-4 divide-y divide-line/70">
            {result.contributions.map((c) => (
              <li key={c.name} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: c.color }} />
                <span className="flex-1 text-[13px] font-medium text-ink">{c.name}</span>
                <span className="num w-10 text-right text-[12px] text-muted">
                  {(c.weight * 100).toFixed(0)}%
                </span>
                <span className="num w-28 text-right text-[13px] text-ink">{formatBaht(c.prediction)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Feature importance */}
      <section className="card p-5 sm:p-6">
        <div className="flex items-baseline justify-between">
          <h3 className="label">อะไรดันราคามากที่สุด</h3>
          <span className="text-[11px] text-faint">ความสำคัญจาก CatBoost</span>
        </div>
        <ul className="mt-4 space-y-3">
          {result.features.map((feature, i) => {
            const Icon = ICON_MAP[feature.icon] ?? MapPin;
            const widthPct = (feature.value / maxFeatureValue) * 100;
            return (
              <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <Icon className="h-3.5 w-3.5 text-faint" strokeWidth={1.75} />
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px] text-ink">{feature.label}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised">
                    <div
                      className="h-full origin-left animate-grow-x rounded-full bg-ink/80"
                      style={{ width: `${widthPct}%`, animationDelay: `${i * 40}ms` }}
                    />
                  </div>
                </div>
                <span className="num w-10 text-right text-[12px] text-muted">
                  {(feature.value * 100).toFixed(0)}%
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={`num font-medium ${emphasis ? "text-[22px] text-ink" : "text-[15px] text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}

function DownloadMenu({ input, result }: ResultPanelProps) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleDownload = (format: "json" | "csv" | "txt") => {
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    if (format === "json") {
      downloadFile(reportToJSON(input, result), `prediction-report-${ts}.json`, "application/json");
    } else if (format === "csv") {
      downloadFile(reportToCSV(input, result), `prediction-report-${ts}.csv`, "text/csv");
    } else {
      downloadFile(reportToText(input, result), `prediction-report-${ts}.txt`, "text/plain");
    }
    setOpen(false);
    setDone(format);
    window.setTimeout(() => setDone(null), 1600);
  };

  const options = [
    { id: "json" as const, icon: FileJson, label: "JSON", hint: "ข้อมูลดิบ" },
    { id: "csv" as const, icon: FileSpreadsheet, label: "CSV", hint: "เปิดใน Excel / Sheets" },
    { id: "txt" as const, icon: FileText, label: "Text", hint: "สรุปอ่านง่าย" },
  ];

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="btn-ghost"
      >
        {done ? <Check className="h-4 w-4 text-ok" /> : <Download className="h-4 w-4" />}
        {done ? "บันทึกแล้ว" : "บันทึกรายงาน"}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop animate-fade-in"
        >
          {options.map((o) => (
            <button
              key={o.id}
              role="menuitem"
              onClick={() => handleDownload(o.id)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-raised"
            >
              <o.icon className="h-4 w-4 flex-shrink-0 text-muted" strokeWidth={1.75} />
              <span>
                <span className="block text-[13px] font-medium text-ink">{o.label}</span>
                <span className="block text-[11px] text-faint">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
