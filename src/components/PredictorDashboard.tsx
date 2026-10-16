import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, ChevronDown, Loader2, RefreshCw, Search, TrendingUp } from "lucide-react";
import { PredictionInput, PropertyType } from "@/lib/types";
import { DEFAULT_SUBDISTRICT_ID, DEFAULT_YEAR, YEAR_MAX, YEAR_MIN } from "@/lib/defaults";
import { ApiPrediction, EstateProject, predict } from "@/lib/api";
import { ResultPanel } from "./ResultPanel";
import { LocationSelector } from "./LocationSelector";
import { StatusPanel } from "./StatusPanel";
import { ModelStatus } from "./ModelStatus";
import { EstatePicker } from "./EstatePicker";

const PROPERTY_TYPES: { id: PropertyType; label: string }[] = [
  { id: "condo", label: "คอนโด" },
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
  unit: string;
  hint: string;
  min: number;
  max: number;
  step: number;
}

const GENERAL_FIELDS: FieldConfig[] = [
  { key: "area", label: "พื้นที่ใช้สอย", unit: "ตร.ม.", hint: "20–500", min: 20, max: 500, step: 1 },
  { key: "nUnits", label: "จำนวนหน่วย", unit: "หน่วย", hint: "1–4", min: 1, max: 4, step: 1 },
  { key: "year", label: "ปีที่ประเมิน", unit: "พ.ศ.", hint: `${YEAR_MIN}–${YEAR_MAX}`, min: YEAR_MIN, max: YEAR_MAX, step: 1 },
];

type OptionalKey = "bedrooms" | "bathrooms" | "buildingAge";

// Left blank, the model treats these as unknown - as it did for listings that
// did not state them.
const OPTIONAL_FIELDS: { key: OptionalKey; label: string; unit: string; max: number }[] = [
  { key: "bedrooms", label: "ห้องนอน", unit: "ห้อง", max: 20 },
  { key: "bathrooms", label: "ห้องน้ำ", unit: "ห้อง", max: 20 },
  { key: "buildingAge", label: "อายุอาคาร (ค่าเสื่อม)", unit: "ปี", max: 100 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Keystrokes inside this window collapse into one request.
const AUTO_PREDICT_DELAY_MS = 450;

function clampAll(input: PredictionInput): PredictionInput {
  return GENERAL_FIELDS.reduce<PredictionInput>(
    (acc, f) => ({ ...acc, [f.key]: clamp(acc[f.key] as number, f.min, f.max) }),
    input,
  );
}

interface PredictorDashboardProps {
  /** A point picked on the map page; prices from it instead of the sub-district. */
  point: { lat: number; lng: number } | null;
  onClearPoint: () => void;
}

export function PredictorDashboard({ point: mapPoint, onClearPoint }: PredictorDashboardProps) {
  const [input, setInput] = useState<PredictionInput>(() => ({ ...DEFAULT_INPUT, ...mapPoint }));
  const [result, setResult] = useState<ApiPrediction | null>(null);
  // The form values the current result was priced from; `input` may already
  // have moved on while the next request is in flight.
  const [resultInput, setResultInput] = useState<PredictionInput>(DEFAULT_INPUT);
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

  // Picking a sub-district from the list drops the map point and any chosen
  // village; otherwise the point wins (the API locates from lat/lng).
  const updateSubdistrict = (subdistrictId: string) => {
    setInput((prev) => ({ ...prev, subdistrictId, lat: undefined, lng: undefined, project: undefined }));
    setVillage(null);
    onClearPoint();
  };

  // A chosen village prices from its own listings and stands at its pin.
  const [village, setVillage] = useState<EstateProject | null>(null);
  const pickVillage = (v: EstateProject | null) => {
    setVillage(v);
    setInput((prev) =>
      v
        ? { ...prev, estate: "in", project: v.key, lat: v.lat ?? undefined, lng: v.lng ?? undefined }
        : { ...prev, project: undefined, lat: undefined, lng: undefined },
    );
    if (!v) onClearPoint();
  };
  const pickEstate = (estate: PredictionInput["estate"]) => {
    if (estate !== "in" && village) pickVillage(null);
    setInput((prev) => ({ ...prev, estate }));
  };

  const handleOptionalChange = (key: OptionalKey, raw: string, max: number) => {
    const parsed = parseFloat(raw);
    setInput((prev) => ({
      ...prev,
      [key]: raw.trim() === "" || !Number.isFinite(parsed) ? undefined : clamp(parsed, 0, max),
    }));
  };

  const point = input.lat !== undefined && input.lng !== undefined ? { lat: input.lat, lng: input.lng } : null;

  // The previous result stays on screen while the next one loads, so the
  // numbers glide from old to new instead of flashing through a spinner.
  const runPredict = useCallback(async (payload: PredictionInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setError(null);
    try {
      const next = await predict(payload, controller.signal);
      setResult(next);
      setResultInput(payload);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setIsRunning(false);
    }
  }, []);

  // Every change to the form re-prices it after a short pause - no button
  // press needed. The button remains for an explicit re-run.
  useEffect(() => {
    if (!GENERAL_FIELDS.every((f) => Number.isFinite(input[f.key] as number))) return;
    const payload = clampAll(input);
    const timer = window.setTimeout(() => void runPredict(payload), AUTO_PREDICT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [input, runPredict]);

  const handlePredict = () => {
    // A field can still hold an unclamped draft if the button is clicked
    // without blurring it first.
    const payload = clampAll(input);
    setInput(payload);
    setDrafts({});
    void runPredict(payload);
  };

  const areaField = GENERAL_FIELDS.find((f) => f.key === "area") as FieldConfig;
  const moreFields = GENERAL_FIELDS.filter((f) => f.key !== "area");

  return (
    <div className="space-y-10">
      <form
        className="space-y-8"
        // Values are clamped in handlePredict; the browser's own step/range
        // popup would otherwise block any area that is not a multiple of 5.
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void handlePredict();
        }}
      >
        {/* z-20 + isolation: the location dropdown paints above the cards below. */}
        <section className="horizon z-20 px-1 pb-14 pt-8 text-center sm:pt-12">
          <h2 className="wordmark text-[40px] leading-tight sm:text-[56px]">ราคาบ้าน</h2>
          <p className="mt-1 text-[15px] text-muted">AI based property price estimator</p>
          <p className="mt-3 text-[13px] text-ink/80">ประกาศขายจริงกว่า 2 แสนรายการ · กรุงเทพฯ และปริมณฑล</p>
          <div className="mt-3 flex justify-center">
            <ModelStatus />
          </div>

          <div className="z-10 mx-auto mt-16 grid max-w-3xl gap-4 sm:mt-24 sm:grid-cols-3">
            <div>
              <div className="glass-field relative sm:-rotate-2 sm:translate-y-2">
                <select
                  aria-label="ประเภททรัพย์"
                  value={input.propertyType}
                  onChange={(e) => setInput((prev) => ({ ...prev, propertyType: e.target.value as PropertyType }))}
                  className="w-full appearance-none rounded-xl bg-transparent px-3 py-3 pr-9 text-[15px] font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t.id} value={t.id} className="bg-surface text-ink">
                      {t.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              </div>
              <p className="mt-2 text-center text-[12px] text-muted sm:mt-4">ประเภททรัพย์</p>
            </div>

            <div>
              <div className="glass-field relative focus-within:ring-2 focus-within:ring-accent/60">
                <label htmlFor="field-area" className="sr-only">
                  {areaField.label}
                </label>
                <input
                  id="field-area"
                  type="number"
                  inputMode="numeric"
                  value={drafts.area ?? String(input.area)}
                  min={areaField.min}
                  max={areaField.max}
                  step={areaField.step}
                  onChange={(e) => handleFieldChange(areaField, e.target.value)}
                  onBlur={() => handleFieldBlur(areaField)}
                  className="num w-full bg-transparent px-3 py-3 pr-14 text-[15px] font-medium text-ink focus:outline-none"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">
                  {areaField.unit}
                </span>
              </div>
              <p className="mt-2 text-center text-[12px] text-muted">
                {areaField.label} <span className="text-faint">· ช่วง {areaField.hint}</span>
              </p>
            </div>

            <div>
              <div className="sm:[&_[role=combobox]]:rotate-2 sm:[&_[role=combobox]]:translate-y-2">
                <LocationSelector hideHeader wide subdistrictId={input.subdistrictId} onChange={updateSubdistrict} />
              </div>
              <p className="mt-2 text-center text-[12px] text-muted sm:mt-4">ทำเล</p>
            </div>
          </div>

          <div className="mt-4 space-y-1">
            {point && village && (
              <p className="text-[11.5px] text-accent">
                ใช้ตำแหน่งของ{village.name} — เลือกแขวงใหม่เพื่อยกเลิก
              </p>
            )}
            {point && !village && (
              <p className="text-[11.5px] text-accent">
                ใช้ตำแหน่งที่คลิกบนแผนที่ ({point.lat.toFixed(4)}, {point.lng.toFixed(4)}) — เลือกแขวงใหม่เพื่อยกเลิก
              </p>
            )}
            {point && result?.meta.location_from === "map" && (
              <p className="text-[11.5px] text-muted">
                {result.meta.project
                  ? `โครงการตรงจุดที่คลิก: ${result.meta.project}`
                  : "ไม่พบโครงการในระยะ 75 ม. — ใช้ราคาประกาศรอบ ๆ แทน"}
              </p>
            )}
            {!point && (
              <p className="text-[11.5px] text-faint">
                เลือกจุดในหน้า{" "}
                <a href="#/map" className="text-accent underline-offset-2 hover:underline">
                  แผนที่
                </a>{" "}
                จะแม่นกว่าเลือกแขวงอย่างเดียวมาก
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-col items-center pb-4">
            <button
              type="submit"
              disabled={isRunning}
              aria-label="ประเมินราคา"
              className="orb-btn relative disabled:cursor-wait"
            >
              {isRunning ? <Loader2 className="h-6 w-6 animate-spin" /> : <ArrowRight className="h-6 w-6" />}
              <svg
                aria-hidden="true"
                viewBox="0 0 200 40"
                className="pointer-events-none absolute left-1/2 top-full mt-1 h-10 w-[200px] -translate-x-1/2 text-ink"
              >
                <path id="orb-arc" d="M 20 6 Q 100 36 180 6" fill="none" />
                <text>
                  <textPath href="#orb-arc" startOffset="50%" textAnchor="middle">
                    ประเมินราคา
                  </textPath>
                </text>
              </svg>
            </button>
            <p className="mt-12 text-center text-[11px] text-faint">ราคาอัปเดตเองทุกครั้งที่แก้ข้อมูล</p>
          </div>
        </section>

        <details className="card group mx-auto max-w-3xl p-5 sm:p-6">
          <summary className="label flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
            ตัวเลือกเพิ่มเติม
            <ChevronDown className="h-4 w-4 text-faint transition-transform duration-200 group-open:rotate-180" />
          </summary>

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
            {moreFields.map((field) => (
              <div key={field.key}>
                <label htmlFor={`field-${field.key}`} className="label block">
                  {field.label}
                </label>
                <div className="relative mt-2">
                  <input
                    id={`field-${field.key}`}
                    type="number"
                    inputMode="numeric"
                    value={drafts[field.key] ?? String(input[field.key])}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    onBlur={() => handleFieldBlur(field)}
                    className="field num pr-12 text-[15px]"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">
                    {field.unit}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-faint">ช่วง {field.hint}</p>
              </div>
            ))}
          </div>

          <p className="label mt-6">ข้อมูลเพิ่มเติม (ไม่บังคับ)</p>
          {/* items-end: a label that wraps must not push its input out of line. */}
          <div className="mt-3 grid grid-cols-2 items-end gap-3 sm:grid-cols-3">
            {OPTIONAL_FIELDS.map((f) => (
              <div key={f.key}>
                <label htmlFor={`field-${f.key}`} className="block text-[11.5px] text-muted">
                  {f.label}
                </label>
                <div className="relative mt-1.5">
                  <input
                    id={`field-${f.key}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={f.max}
                    placeholder="ไม่ระบุ"
                    value={input[f.key] ?? ""}
                    onChange={(e) => handleOptionalChange(f.key, e.target.value, f.max)}
                    className="field num pr-10 text-[14px]"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">
                    {f.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <EstatePicker
              propertyType={input.propertyType}
              estate={input.estate}
              village={village}
              onEstate={pickEstate}
              onVillage={pickVillage}
            />
          </div>
        </details>
      </form>

      {/* Result */}
      <div className="relative">
        {isRunning && result && (
          <span className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/95 px-2.5 py-1 text-[11px] text-muted shadow-card backdrop-blur animate-fade-in">
            <RefreshCw className="h-3 w-3 animate-spin" />
            กำลังอัปเดต
          </span>
        )}
        {isRunning && !result ? (
          <StatusPanel
            variant="loading"
            icon={Search}
            title="กำลังหาประกาศเทียบเคียงในเขตนี้"
            description="CatBoost, LightGBM และ XGBoost ทำนายแยกกัน แล้วถ่วงน้ำหนักรวม"
          />
        ) : error ? (
          <StatusPanel
            variant="empty"
            icon={TrendingUp}
            title="เรียกโมเดลไม่สำเร็จ"
            description={`${error} — ตรวจว่า API รันอยู่ที่ http://127.0.0.1:3030 (cd ml && python api.py)`}
          />
        ) : result ? (
          <div className={`transition-opacity duration-300 ${isRunning ? "opacity-60" : "opacity-100"}`}>
            <ResultPanel result={result} input={resultInput} />
          </div>
        ) : (
          <StatusPanel
            variant="empty"
            icon={TrendingUp}
            title="ยังไม่มีผล"
            description="เลือกประเภท ใส่พื้นที่ เลือกแขวง แล้วกด “ประเมินราคา” ผลจะขึ้นตรงนี้"
          />
        )}
      </div>
    </div>
  );
}
