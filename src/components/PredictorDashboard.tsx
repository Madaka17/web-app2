import { useState, useEffect, useRef } from "react";
import {
  Maximize,
  Building2,
  CalendarClock,
  Layers,
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
  // "any" for a measured quantity: step is what the spinner arrows move by,
  // but the browser also refuses to submit a typed value off that grid, so a
  // step of 5 made 72 sqm invalid ("the two nearest valid values are 70 and
  // 75"). Counts stay on 1, where every whole number is on the grid anyway.
  step: number | "any";
  hint: string;
}

// A condo is a unit in a tower; a plot of land is priced by the rai. One range
// for both meant a 1-rai plot (1,600 sqm) was silently clamped to 500 and the
// model was asked to price something the user never typed. prepare_data.py
// accepts 10-20,000 sqm, so nothing here may exceed that.
const AREA_RANGE: Record<PropertyType, { min: number; max: number; hint: string }> = {
  condo: { min: 20, max: 500, hint: "พื้นที่ใช้สอยของห้อง" },
  house: { min: 30, max: 5000, hint: "ที่ดิน + สิ่งปลูกสร้าง" },
  townhome: { min: 30, max: 2000, hint: "ที่ดิน + สิ่งปลูกสร้าง" },
  land: { min: 40, max: 20000, hint: "1 ไร่ = 1,600 ตร.ม." },
};

function generalFields(type: PropertyType): FieldConfig[] {
  const area = AREA_RANGE[type];
  return [
    { key: "area", label: "ขนาดพื้นที่", icon: Maximize, unit: "ตร.ม.", min: area.min, max: area.max, step: "any", hint: area.hint },
    { key: "nUnits", label: "จำนวนหน่วย", icon: Layers, unit: "หน่วย", min: 1, max: 4, step: 1, hint: "ประเมินพร้อมกันกี่หลัง/ห้อง" },
    { key: "year", label: "ปีที่ประเมิน", icon: CalendarClock, unit: "พ.ศ.", min: YEAR_MIN, max: YEAR_MAX, step: 1, hint: `${YEAR_MIN}–${YEAR_MAX}` },
  ];
}

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

  const fields = generalFields(input.propertyType);

  const updateSubdistrict = (subdistrictId: string) => {
    setInput((prev) => ({ ...prev, subdistrictId }));
  };

  // 800 sqm is a normal plot and an impossible condo, so the area has to be
  // pulled back into the new type's range rather than left silently invalid.
  const updateType = (propertyType: PropertyType) => {
    const { min, max } = AREA_RANGE[propertyType];
    setDrafts((prev) => {
      const next = { ...prev };
      delete next.area;
      return next;
    });
    setInput((prev) => ({ ...prev, propertyType, area: clamp(prev.area, min, max) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handlePredict();
  };

  const handlePredict = async () => {
    // A field can still hold an unclamped draft if the button is clicked
    // without blurring it first.
    const payload = generalFields(input.propertyType).reduce<PredictionInput>(
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
        <span className="text-slate-900 dark:text-white font-medium">
          Predictor Dashboard
        </span>
      </div>

      <ModelStatus />

      {/* Everything the model is asked for sits in one card above the fold, so
          a change and its effect on the price never need a scroll between them. */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm"
      >
        <div className="mb-5 space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
            <Building2 className="w-3.5 h-3.5" />
            ประเภทอสังหาริมทรัพย์
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PROPERTY_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => updateType(t.id)}
                aria-pressed={input.propertyType === t.id}
                className={`rounded-xl px-2 py-2.5 text-xs font-semibold transition-colors ${
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-start">
          {fields.map((field) => {
            const Icon = field.icon;
            return (
              <div key={field.key} className="space-y-1.5 lg:col-span-2">
                <label
                  htmlFor={`field-${field.key}`}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {field.label}
                </label>
                <div className="relative">
                  <input
                    id={`field-${field.key}`}
                    type="number"
                    value={drafts[field.key] ?? String(input[field.key])}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    onBlur={() => handleFieldBlur(field)}
                    className="w-full pl-3 pr-12 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500 pointer-events-none">
                    {field.unit}
                  </span>
                </div>
                <p className="text-[11px] leading-4 text-slate-400 dark:text-slate-500">
                  {field.hint} · {field.min.toLocaleString("en-US")}–
                  {field.max.toLocaleString("en-US")}
                </p>
              </div>
            );
          })}

          <div className="sm:col-span-2 lg:col-span-4">
            <LocationSelector
              subdistrictId={input.subdistrictId}
              onChange={updateSubdistrict}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-2 lg:pt-[22px]">
            <button
              type="submit"
              disabled={isRunning}
              className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-semibold py-2.5 px-4 shadow-lg shadow-brand-500/30 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center gap-2">
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">กำลังคำนวณ...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span className="text-sm">คำนวณราคา</span>
                  </>
                )}
              </div>
              <div className="absolute inset-0 shimmer-bg animate-shimmer pointer-events-none" />
            </button>
            <p className="mt-1.5 text-center text-[11px] text-slate-400 dark:text-slate-500">
              หรือกด Enter
            </p>
          </div>
        </div>
      </form>

      {/* Output, full width */}
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
            description={`${error} — ตรวจว่า API รันอยู่ที่ http://127.0.0.1:8000 (เปิดเทอร์มินัลอีกหน้าต่าง แล้วรัน: cd ml  แล้ว  python api.py)`}
          />
        ) : result ? (
          <ResultPanel result={result} input={input} />
        ) : (
          <StatusPanel
            variant="empty"
            icon={TrendingUp}
            title="ยังไม่มีผลการทำนาย"
            description={'กรอกข้อมูลด้านบนแล้วกด "คำนวณราคา" เพื่อดูผลลัพธ์'}
          />
        )}
      </div>
    </div>
  );
}
