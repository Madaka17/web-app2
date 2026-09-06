import {
  TrendingUp,
  CheckCircle2,
  Info,
  ArrowUp,
  ArrowDown,
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
} from "lucide-react";
import { useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDownload = (format: "json" | "csv" | "txt") => {
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    if (format === "json") {
      downloadFile(reportToJSON(input, result), `prediction-report-${ts}.json`, "application/json");
    } else if (format === "csv") {
      downloadFile(reportToCSV(input, result), `prediction-report-${ts}.csv`, "text/csv");
    } else {
      downloadFile(reportToText(input, result), `prediction-report-${ts}.txt`, "text/plain");
    }
    setMenuOpen(false);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Price Display */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-600 to-brand-800 p-6 shadow-xl shadow-brand-500/20">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-400/20 rounded-full blur-3xl -ml-8 -mb-8" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-white/15 backdrop-blur-sm">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-brand-100">ราคาประเมินคาดการณ์</span>
          </div>

          <p className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-3">
            {formatBaht(result.predictedPrice)}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 backdrop-blur-sm">
              <ArrowDown className="w-3.5 h-3.5 text-green-300" />
              <span className="text-xs font-semibold text-white">
                ต่ำสุด {formatBaht(result.lowerBound)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 backdrop-blur-sm">
              <ArrowUp className="w-3.5 h-3.5 text-orange-300" />
              <span className="text-xs font-semibold text-white">
                สูงสุด {formatBaht(result.upperBound)}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-green-300 rounded-full"
                style={{ width: `${result.confidence}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-white">
              {result.confidence.toFixed(1)}% เข้าเป้า ±20%
            </span>
          </div>

          {/* Download button */}
          <div className="mt-4 relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs font-semibold transition-all"
            >
              <Download className="w-4 h-4" />
              ดาวน์โหลดรายงาน (Download Report)
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute bottom-full mb-2 left-0 z-20 w-56 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-fade-in">
                  <button
                    onClick={() => handleDownload("json")}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <FileJson className="w-4 h-4 text-brand-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">JSON</p>
                      <p className="text-[10px] text-slate-400">ข้อมูลดิบสำหรับนำไปประมวลผลต่อ</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDownload("csv")}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left border-t border-slate-100 dark:border-slate-700"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">CSV</p>
                      <p className="text-[10px] text-slate-400">เปิดด้วย Excel / Google Sheets</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDownload("txt")}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left border-t border-slate-100 dark:border-slate-700"
                  >
                    <FileText className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">Text</p>
                      <p className="text-[10px] text-slate-400">รายงานสรุปแบบอ่านง่าย</p>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* What the model actually used */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            ความแม่นยำจริงของกลุ่มนี้
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <Stat label="ค่าคลาดเคลื่อนกลาง" value={`${result.meta.median_abs_pct_error}%`} />
          <Stat label="อยู่ในช่วง ±20%" value={`${result.meta.within_20pct}%`} />
          <Stat
            label="ตัวอย่างที่วัด"
            value={result.meta.sample_size.toLocaleString("en-US")}
          />
        </div>

        <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
          วัดจากปี 2568–2569 ที่โมเดลไม่เคยเห็น · ทำเล{" "}
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {result.meta.province} › {result.meta.district}
          </span>
          {!result.meta.district_in_training_data && " (เขตนี้ไม่มีในข้อมูลเทรน ใช้ค่าระดับจังหวัดแทน)"}
        </p>
      </div>

      {/* Ensemble Breakdown */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-500/10">
            <Info className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Ensemble Breakdown — น้ำหนักการทำนายของโมเดล
          </h3>
        </div>

        {/* Stacked bar */}
        <div className="flex h-3 rounded-full overflow-hidden mb-4">
          {result.contributions.map((c) => (
            <div
              key={c.name}
              className="h-full transition-all duration-500"
              style={{
                width: `${(c.weight / barTotal) * 100}%`,
                backgroundColor: c.color,
              }}
            />
          ))}
        </div>

        <div className="space-y-3">
          {result.contributions.map((c) => (
            <div key={c.name} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-md flex-shrink-0" style={{ backgroundColor: c.color }} />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1">
                {c.name}
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {(c.weight * 100).toFixed(0)}%
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 w-28 text-right">
                {formatBaht(c.prediction)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Importance */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-500/10">
            <CheckCircle2 className="w-4 h-4 text-orange-500 dark:text-orange-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            ปัจจัยที่มีผลต่อราคามากที่สุด — Feature Importance
          </h3>
        </div>

        <div className="space-y-2.5">
          {result.features.map((feature, i) => {
            const Icon = ICON_MAP[feature.icon] ?? MapPin;
            const widthPct = (feature.value / maxFeatureValue) * 100;
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 w-32 flex-shrink-0">
                  {feature.label}
                </span>
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-700 ease-out"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-900 dark:text-white w-10 text-right">
                  {(feature.value * 100).toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 text-center">
      <p className="text-sm font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-400">{label}</p>
    </div>
  );
}
