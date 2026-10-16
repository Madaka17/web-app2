import {
  Train,
  Maximize,
  MapPin,
  BedDouble,
  CalendarClock,
  Building2,
  Car,
  Home,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PredictionInput } from "@/lib/types";
import { formatBaht } from "@/lib/prediction";
import { ApiPrediction, Comparables } from "@/lib/api";
import {
  DEFAULT_GROWTH_PCT,
  GROWTH_MAX_PCT,
  GROWTH_MIN_PCT,
  GROWTH_STEP_PCT,
  HORIZONS_YEARS,
  compound,
} from "@/lib/growth";
import { ConclusionCards } from "./ConclusionCards";
import { Baht } from "./ResultAtoms";

const ICON_MAP: Record<string, typeof Train> = {
  Train,
  Maximize,
  MapPin,
  BedDouble,
  CalendarClock,
  Building2,
  Car,
  Home,
};

interface ResultPanelProps {
  result: ApiPrediction;
  input: PredictionInput;
}

export function ResultPanel({ result, input }: ResultPanelProps) {
  const maxFeatureValue = Math.max(...result.features.map((f) => f.value));
  const barTotal = result.contributions.reduce((sum, c) => sum + c.weight, 0);
  const [rate, setRate] = useState<number>(DEFAULT_GROWTH_PCT[input.propertyType]);
  // A new property type brings its own starting rate.
  useEffect(() => setRate(DEFAULT_GROWTH_PCT[input.propertyType]), [input.propertyType]);

  return (
    <div className="space-y-4 animate-slide-up">
      <ConclusionCards result={result} input={input} rate={rate} />

      {/* Ensemble */}
      <div className="grid grid-cols-1 gap-4">
        <section className="card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="label">สามโมเดลว่าอย่างไร</h3>
            <span className="text-[11px] text-faint">น้ำหนักเลือกจากชุด validation</span>
          </div>

          <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full">
            {result.contributions.map((c) => (
              <div
                key={c.name}
                className="h-full origin-left animate-grow-x rounded-sm"
                style={{ width: `${(c.weight / barTotal) * 100}%`, backgroundColor: c.color, transition: "width 500ms ease-out" }}
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
                <span className="num whitespace-nowrap text-right text-[13px] text-ink"><Baht value={c.prediction} /></span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <WhyThisPrice result={result} input={input} />

      <FutureValue result={result} input={input} rate={rate} onRate={setRate} />

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
                      className="h-full origin-left animate-grow-x rounded-full bg-gradient-to-r from-accent-2 to-accent transition-[width] duration-500 ease-out"
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

const perSqm = (v: number) => `฿${Math.round(v).toLocaleString("en-US")}/ตร.ม.`;

/** Turn the comparables the models were handed into plain sentences. */
function explain(c: Comparables, r: ApiPrediction, input: PredictionInput): string[] {
  const type = r.meta.collateral_type;
  const dist = r.meta.district;
  const lines: string[] = [];

  if (c.district_n > 0) {
    lines.push(
      `${type}ในเขต${dist}ที่ประกาศขายอยู่ ${c.district_n.toLocaleString("en-US")} รายการ ราคากลาง ${perSqm(c.district_ppsqm)}`,
    );
  } else {
    lines.push(
      `ไม่มี${type}ในเขต${dist}ในข้อมูล จึงใช้ค่ากลางของ${type}ทั้งจังหวัด ${perSqm(c.province_type_ppsqm)}`,
    );
  }

  if (c.subdistrict_n > 0) {
    const gap = (c.subdistrict_ppsqm / c.district_ppsqm - 1) * 100;
    const dir = Math.abs(gap) < 3 ? "ใกล้เคียงทั้งเขต" : gap > 0 ? `แพงกว่าทั้งเขต ${gap.toFixed(0)}%` : `ถูกกว่าทั้งเขต ${(-gap).toFixed(0)}%`;
    lines.push(
      `เฉพาะแขวง${r.meta.subdistrict} มี ${c.subdistrict_n.toLocaleString("en-US")} รายการ ราคา ${perSqm(c.subdistrict_ppsqm)} — ${dir}`,
    );
  }

  if (c.size_band_n > 0) {
    const gap = (c.size_band_ppsqm / c.district_ppsqm - 1) * 100;
    const dir = Math.abs(gap) < 3 ? "ใกล้เคียงค่ากลางของเขต" : gap > 0 ? `แพงกว่าค่ากลางของเขต ${gap.toFixed(0)}%` : `ถูกกว่าค่ากลางของเขต ${(-gap).toFixed(0)}%`;
    lines.push(
      `ขนาดใกล้เคียง ${input.area} ตร.ม. (±28%) มี ${c.size_band_n.toLocaleString("en-US")} รายการ ราคา ${perSqm(c.size_band_ppsqm)} — ${dir}`,
    );
  }

  if (c.exact_size_n > 0) {
    lines.push(
      `ขนาด ${input.area} ตร.ม. พอดี มี ${c.exact_size_n.toLocaleString("en-US")} รายการ ราคา ${perSqm(c.exact_size_ppsqm)}`,
    );
  } else {
    lines.push(
      `ไม่มีประกาศขนาด ${input.area} ตร.ม. พอดีในเขตนี้ ขนาดที่ใกล้ที่สุดอยู่ที่ ${perSqm(c.nearest_size_ppsqm)}`,
    );
  }

  const vs = c.vs_district_pct;
  const rel = Math.abs(vs) < 3 ? "เท่ากับค่ากลางของเขต" : vs > 0 ? `สูงกว่าค่ากลางของเขต ${vs.toFixed(0)}%` : `ต่ำกว่าค่ากลางของเขต ${(-vs).toFixed(0)}%`;
  lines.push(`โมเดลจึงตั้งราคาที่ ${perSqm(c.predicted_ppsqm)} ${rel} × ${input.area} ตร.ม. = ${formatBaht(r.predictedPrice)}`);

  return lines;
}

function WhyThisPrice({ result, input }: ResultPanelProps) {
  const c = result.comparables;
  const thin = c.district_n < 30;
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="label">ทำไมถึงราคานี้</h3>
        <span className="text-[11px] text-faint">จากประกาศเทียบเคียงที่โมเดลใช้</span>
      </div>
      <ol className="mt-4 space-y-2.5">
        {explain(c, result, input).map((line, i) => (
          <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-ink">
            <span className="num mt-0.5 w-4 flex-shrink-0 text-[11px] text-faint">{i + 1}</span>
            <span>{line}</span>
          </li>
        ))}
      </ol>
      {thin && (
        <p className="mt-4 border-t border-line/80 pt-3 text-[11.5px] leading-relaxed text-warn">
          เขตนี้มีประกาศเทียบเคียงน้อย ({c.district_n} รายการ) ราคาจึงพึ่งค่าระดับจังหวัดมากขึ้นและคลาดเคลื่อนได้มากกว่าปกติ
        </p>
      )}
    </section>
  );
}

function FutureValue({
  result,
  input,
  rate,
  onRate,
}: ResultPanelProps & { rate: number; onRate: (r: number) => void }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="label">มูลค่าในอนาคต</h3>
        <span className="text-[11px] text-faint">สมมติฐาน ไม่ใช่คำทำนาย</span>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <label htmlFor="growth-rate" className="text-[13px] text-muted">
          ราคาขึ้นปีละ
        </label>
        <input
          id="growth-rate"
          type="range"
          min={GROWTH_MIN_PCT}
          max={GROWTH_MAX_PCT}
          step={GROWTH_STEP_PCT}
          value={rate}
          onChange={(e) => onRate(parseFloat(e.target.value))}
          className="flex-1 accent-ink"
        />
        <span className="num w-14 text-right text-[15px] font-medium text-ink">
          {rate > 0 ? "+" : ""}
          {rate.toFixed(1)}%
        </span>
      </div>

      {/* Scrolls sideways on a phone rather than breaking "ล้านบาท" over two lines. */}
      <div className="-mx-1 mt-4 overflow-x-auto px-1 scrollbar-thin">
        <table className="w-full min-w-[340px] whitespace-nowrap text-[12.5px] sm:text-[13px]">
          <thead>
            <tr className="text-[11px] text-faint">
              <th className="pb-2 text-left font-medium">ปี</th>
              <th className="pb-2 text-right font-medium">ต่ำ</th>
              <th className="pb-2 text-right font-medium">คาดการณ์</th>
              <th className="pb-2 text-right font-medium">สูง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {HORIZONS_YEARS.map((y) => (
              <tr key={y}>
                <td className="py-2 pr-2 text-muted">
                  {input.year + y} <span className="hidden text-faint min-[420px]:inline">(+{y} ปี)</span>
                </td>
                <td className="num py-2 text-right text-muted"><Baht value={compound(result.lowerBound, rate, y)} /></td>
                <td className="num py-2 text-right font-medium text-ink">
                  <Baht value={compound(result.predictedPrice, rate, y)} />
                </td>
                <td className="num py-2 text-right text-muted"><Baht value={compound(result.upperBound, rate, y)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 border-t border-line/80 pt-3 text-[11.5px] leading-relaxed text-faint">
        ทบต้นจากราคาคาดการณ์วันนี้ด้วยอัตราที่เลือก ค่าเริ่มต้นเป็นค่าเฉลี่ยระยะยาวคร่าว ๆ ของดัชนีราคาที่อยู่อาศัย
        ไม่ได้คำนวณจากประกาศในชุดข้อมูล เพราะประกาศส่วนใหญ่เป็นปีเดียวกันและประกาศเก่าที่ยังค้างคือของที่ขายไม่ออก
        จึงบอกแนวโน้มตลาดไม่ได้
      </p>
    </section>
  );
}
