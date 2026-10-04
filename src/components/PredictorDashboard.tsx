import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, Loader2, RefreshCw, Search, TrendingUp } from "lucide-react";
import { PredictionInput, PropertyType } from "@/lib/types";
import { DEFAULT_SUBDISTRICT_ID, DEFAULT_YEAR, YEAR_MAX, YEAR_MIN } from "@/lib/defaults";
import { ApiPrediction, predict } from "@/lib/api";
import { ResultPanel } from "./ResultPanel";
import { LocationSelector } from "./LocationSelector";
import { StatusPanel } from "./StatusPanel";
import { ModelStatus } from "./ModelStatus";
import { AREA_SPECS, BUILDING_LABELS, PROPERTY_GROUPS, groupOf } from "@/lib/market";

const DEFAULT_INPUT: PredictionInput = {
  propertyType: "condo",
  area: AREA_SPECS.condo.initial * AREA_SPECS.condo.sqmPerUnit,
  nUnits: 1,
  year: DEFAULT_YEAR,
  subdistrictId: DEFAULT_SUBDISTRICT_ID,
};

interface FieldConfig {
  key: keyof PredictionInput;
  label: string;
  unit: string;
  hint: string;
  /** min/max are in display units */
  min: number;
  max: number;
  step: number;
  /** input value (stored) per display unit - 4 for land in ตร.ว., else 1 */
  scale: number;
}

/** The form's fields for a property type. Area is always sent to the API in
 * sqm; land is typed in ตร.ว. and converted. */
function fieldsFor(type: PropertyType): FieldConfig[] {
  const a = AREA_SPECS[type];
  return [
    { key: "area", label: a.label, unit: a.unit, hint: `${a.min.toLocaleString("en-US")}–${a.max.toLocaleString("en-US")}`, min: a.min, max: a.max, step: 1, scale: a.sqmPerUnit },
    { key: "nUnits", label: "จำนวนหน่วย", unit: "หน่วย", hint: "1–4", min: 1, max: 4, step: 1, scale: 1 },
    { key: "year", label: "ปีที่ประกาศขาย", unit: "พ.ศ.", hint: `${YEAR_MIN}–${YEAR_MAX}`, min: YEAR_MIN, max: YEAR_MAX, step: 1, scale: 1 },
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Keystrokes inside this window collapse into one request.
const AUTO_PREDICT_DELAY_MS = 450;

function clampAll(input: PredictionInput): PredictionInput {
  return fieldsFor(input.propertyType).reduce<PredictionInput>(
    (acc, f) => ({ ...acc, [f.key]: clamp(acc[f.key] as number, f.min * f.scale, f.max * f.scale) }),
    input,
  );
}

function displayValue(value: number, scale: number): string {
  return String(Math.round((value / scale) * 100) / 100);
}

export function PredictorDashboard() {
  const [input, setInput] = useState<PredictionInput>(DEFAULT_INPUT);
  const [result, setResult] = useState<ApiPrediction | null>(null);
  // The form values the current result was priced from; `input` may already
  // have moved on while the next request is in flight.
  const [resultInput, setResultInput] = useState<PredictionInput>(DEFAULT_INPUT);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController>();
  // The seller's asking price, in baht. Never sent to the model: it is what
  // the prediction and the market price are judged against.
  const [askingPrice, setAskingPrice] = useState<number | null>(null);
  const [askingDraft, setAskingDraft] = useState("");
  const fields = fieldsFor(input.propertyType);
  const group = groupOf(input.propertyType);

  const selectType = (type: PropertyType) => {
    if (type === input.propertyType) return;
    const a = AREA_SPECS[type];
    // A 35 sqm "land plot" or a 100 ตร.ว. condo is meaningless: each type
    // starts from its own typical size.
    setDrafts({});
    setInput((prev) => ({ ...prev, propertyType: type, area: a.initial * a.sqmPerUnit }));
  };

  useEffect(() => () => abortRef.current?.abort(), []);

  // While a field has focus the raw text is kept as-is, so half-typed values
  // survive. Clamping on every keystroke made "120" impossible to type: after
  // the first "1" the value snapped to the minimum.
  const [drafts, setDrafts] = useState<Partial<Record<keyof PredictionInput, string>>>({});

  const handleFieldChange = (field: FieldConfig, raw: string) => {
    setDrafts((prev) => ({ ...prev, [field.key]: raw }));
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed)) {
      setInput((prev) => ({ ...prev, [field.key]: parsed * field.scale }));
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
          ? clamp(current, field.min * field.scale, field.max * field.scale)
          : field.min * field.scale;
      return { ...prev, [field.key]: value };
    });
  };

  const updateSubdistrict = (subdistrictId: string) => {
    setInput((prev) => ({ ...prev, subdistrictId }));
  };

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
    if (!fieldsFor(input.propertyType).every((f) => Number.isFinite(input[f.key] as number))) return;
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

  return (
    <div className="space-y-8">
      {/* Page intro */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <h2 className="font-display text-[28px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[32px]">
            ที่ดิน บ้าน หรือคอนโด
            <br />
            ราคานี้ถูกหรือแพงกว่าตลาด
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            CatBoost, LightGBM และ XGBoost ทำนายราคาประกาศขายที่ควรเป็น แล้ววางเทียบกับราคาที่ประกาศเทียบเคียงในพื้นที่ตั้งไว้จริง
            ใส่ราคาที่ผู้ขายตั้งไว้ เพื่อดูว่าถูก สมเหตุสมผล หรือแพงเกินตลาด
          </p>
        </div>
        <ModelStatus />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Form */}
        <form
          className="space-y-5 lg:col-span-5"
          // Values are clamped in handlePredict; the browser's own step/range
          // popup would otherwise block any area that is not a multiple of 5.
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handlePredict();
          }}
        >
          <div className="card p-5 sm:p-6">
            <fieldset>
              <legend className="label">ประเภททรัพย์</legend>
              <div className="mt-2.5 grid grid-cols-[1fr_1.6fr_1fr] gap-1 rounded-xl bg-raised p-1">
                {PROPERTY_GROUPS.map((g) => {
                  const active = group === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => selectType(g.types[0])}
                      aria-pressed={active}
                      className={`rounded-lg px-2 py-2 text-[13px] font-medium leading-tight transition-all duration-200 active:scale-[0.97] ${
                        active ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
              {group === "land-building" && (
                <div className="mt-3 flex items-center gap-2 animate-fade-in">
                  <span className="text-[12px] text-muted">สิ่งปลูกสร้าง</span>
                  {PROPERTY_GROUPS.find((g) => g.id === "land-building")!.types.map((t) => {
                    const active = input.propertyType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => selectType(t)}
                        aria-pressed={active}
                        className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                          active
                            ? "border-ink bg-ink text-canvas"
                            : "border-line text-muted hover:border-faint hover:text-ink"
                        }`}
                      >
                        {BUILDING_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
              )}
            </fieldset>

            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5">
              {fields.map((field) => (
                <div key={field.key} className={field.key === "area" ? "col-span-2" : ""}>
                  <label htmlFor={`field-${field.key}`} className="label block">
                    {field.label}
                  </label>
                  <div className="relative mt-2">
                    <input
                      id={`field-${field.key}`}
                      type="number"
                      inputMode="numeric"
                      value={drafts[field.key] ?? displayValue(input[field.key] as number, field.scale)}
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
          </div>

          <div className="card p-5 sm:p-6">
            <LocationSelector subdistrictId={input.subdistrictId} onChange={updateSubdistrict} />
          </div>

          <div className="card p-5 sm:p-6">
            <label htmlFor="asking-price" className="label block">
              ราคาประกาศขาย <span className="font-normal normal-case text-faint">(ไม่บังคับ)</span>
            </label>
            <div className="relative mt-2">
              <input
                id="asking-price"
                type="number"
                inputMode="decimal"
                placeholder="เช่น 3.2"
                value={askingDraft}
                min={0}
                step={0.01}
                onChange={(e) => {
                  setAskingDraft(e.target.value);
                  const m = parseFloat(e.target.value);
                  setAskingPrice(Number.isFinite(m) && m > 0 ? m * 1_000_000 : null);
                }}
                className="field num pr-16 text-[15px]"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">
                ล้านบาท
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
              ใส่ราคาที่ผู้ขายตั้งไว้ เพื่อดูว่าถูกหรือแพงกว่าตลาด — ไม่ถูกส่งเข้าโมเดล
            </p>
          </div>

          <button type="submit" disabled={isRunning} className="btn-primary group w-full py-3.5 text-[15px]">
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังถามสามโมเดล
              </>
            ) : (
              <>
                ประเมินราคา
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </>
            )}
          </button>
          <p className="text-center text-[11.5px] text-faint">ราคาอัปเดตเองทุกครั้งที่แก้ข้อมูล</p>
        </form>

        {/* Result */}
        <div className="relative lg:col-span-7">
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
              <ResultPanel result={result} input={resultInput} askingPrice={askingPrice} />
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
    </div>
  );
}
