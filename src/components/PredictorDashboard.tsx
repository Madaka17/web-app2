import { useState, useEffect, useRef } from "react";
import {
  Maximize,
  Building2,
  CalendarClock,
  Layers,
  MapPin,
  Sparkles,
  Loader2,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { PredictionInput, PropertyType } from "@/lib/types";
import { DEFAULT_SUBDISTRICT_ID, DEFAULT_YEAR, YEAR_MAX, YEAR_MIN } from "@/lib/defaults";
import { ApiPrediction, predict } from "@/lib/api";
import { ResultPanel } from "./ResultPanel";
import { LocationSelector } from "./LocationSelector";
import { StatusPanel } from "./StatusPanel";
import { ModelStatus } from "./ModelStatus";

const PROPERTY_TYPES: { id: PropertyType; label: string }[] = [
  { id: "condo", label: "คอนโด / ห้องชุด" },
  { id: "house", label: "บ้านเดี่ยว" },
  { id: "townhome", label: "ทาวน์โฮม" },
  { id: "land", label: "ที่ดิน" },
];

const DEFAULT_INPUT: PredictionInput = {
  propertyType: "condo",
  area: 65,
  nUnits: 1,
  year: DEFAULT_YEAR,
  subdistrictId: DEFAULT_SUBDISTRICT_ID,
};

interface FieldConfig {
  key: keyof PredictionInput;
  label: string;
  icon: typeof Maximize;
  unit: string;
  min: number;
  max: number;
  step: number;
}

const GENERAL_FIELDS: FieldConfig[] = [
  { key: "area", label: "ขนาดพื้นที่", icon: Maximize, unit: "ตร.ม.", min: 20, max: 500, step: 5 },
  { key: "nUnits", label: "จำนวนหน่วย", icon: Layers, unit: "หน่วย", min: 1, max: 4, step: 1 },
  { key: "year", label: "ปีที่ประเมิน", icon: CalendarClock, unit: "พ.ศ.", min: YEAR_MIN, max: YEAR_MAX, step: 1 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function PredictorDashboard() {
  const [input, setInput] = useState<PredictionInput>(DEFAULT_INPUT);
  const [result, setResult] = useState<ApiPrediction | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController>();

  useEffect(() => () => abortRef.current?.abort(), []);

  // While a field has focus the raw text is kept as-is, so half-typed values
  // survive. Clamping on every keystroke made "120" impossible to type: after
  // the first "1" the value snapped to the minimum.
  const [drafts, setDrafts] = useState<Partial<Record<keyof PredictionInput, string>>>({});

  const handleFieldChange = (field: FieldConfig, raw: string) => {
    setDrafts((prev) => ({ ...prev, [field.key]: raw }));
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed)) {
      setInput((prev) => ({ ...prev, [field.key]: parsed }));
    }
  };

  const handleFieldBlur = (field: FieldConfig) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[field.key];
      return next;
    });
    setInput((prev) => {
      const current = prev[field.key];
      const value =
        typeof current === "number" && Number.isFinite(current)
          ? clamp(current, field.min, field.max)
          : field.min;
      return { ...prev, [field.key]: value };
    });
  };

  const updateSubdistrict = (subdistrictId: string) => {
    setInput((prev) => ({ ...prev, subdistrictId }));
  };

  const handlePredict = async () => {
    // A field can still hold an unclamped draft if the button is clicked
    // without blurring it first.
    const payload = GENERAL_FIELDS.reduce<PredictionInput>(
      (acc, f) => ({ ...acc, [f.key]: clamp(acc[f.key] as number, f.min, f.max) }),
      input,
    );
    setInput(payload);
    setDrafts({});

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setResult(null);
    setError(null);
    try {
      setResult(await predict(payload, controller.signal));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span>หน้าหลัก</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-medium">Predictor Dashboard</span>
      </div>

      <ModelStatus />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="space-y-6">
          {/* General Info */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-500/10">
                <Building2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">ข้อมูลทั่วไป</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">General Information</p>
              </div>
            </div>

            <div className="mb-4 space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                <Building2 className="w-3.5 h-3.5" />
                ประเภทอสังหาริมทรัพย์
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PROPERTY_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setInput((prev) => ({ ...prev, propertyType: t.id }))}
                    aria-pressed={input.propertyType === t.id}
                    className={`rounded-xl px-2 py-2 text-xs font-semibold transition-colors ${
                      input.propertyType === t.id
                        ? "bg-brand-500 text-white shadow-sm shadow-brand-500/30"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {GENERAL_FIELDS.map((field) => {
                const Icon = field.icon;
                return (
                  <div key={field.key} className="space-y-2">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                      <Icon className="w-3.5 h-3.5" />
                      {field.label}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={drafts[field.key] ?? String(input[field.key])}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        onChange={(e) => handleFieldChange(field, e.target.value)}
                        onBlur={() => handleFieldBlur(field)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 transition-all"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500 pointer-events-none">
                        {field.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Location & Environment */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-500/10">
                <MapPin className="w-5 h-5 text-orange-500 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">ทำเลที่ตั้ง</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Location</p>
              </div>
            </div>

            <LocationSelector
              subdistrictId={input.subdistrictId}
              onChange={updateSubdistrict}
            />
          </div>

          {/* Run Button */}
          <button
            onClick={handlePredict}
            disabled={isRunning}
            className="w-full group relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-semibold py-4 px-6 shadow-lg shadow-brand-500/30 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-center gap-2.5">
              {isRunning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>กำลังคำนวณ...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span>คำนวณราคาประเมินด้วย AI (Run Prediction)</span>
                </>
              )}
            </div>
            <div className="absolute inset-0 shimmer-bg animate-shimmer pointer-events-none" />
          </button>
        </div>

        {/* Output Display */}
        <div>
          {isRunning ? (
            <StatusPanel
              variant="loading"
              icon={Sparkles}
              title="กำลังเรียกโมเดล..."
              description="รวมผลจาก CatBoost, LightGBM และ XGBoost"
            />
          ) : error ? (
            <StatusPanel
              variant="empty"
              icon={TrendingUp}
              title="เรียกโมเดลไม่สำเร็จ"
              description={`${error} — ตรวจว่า API รันอยู่ที่ http://127.0.0.1:8000 (cd ml && .venv/bin/python api.py)`}
            />
          ) : result ? (
            <ResultPanel result={result} input={input} />
          ) : (
            <StatusPanel
              variant="empty"
              icon={TrendingUp}
              title="ยังไม่มีผลการทำนาย"
              description={'กรอกข้อมูลอสังหาริมทรัพย์แล้วกดปุ่ม "คำนวณราคาประเมินด้วย AI" เพื่อดูผลลัพธ์'}
            />
          )}
        </div>
      </div>
    </div>
  );
}
