import { useId } from "react";
import type { ReactNode } from "react";
import { Home } from "lucide-react";
import { PredictionInput } from "@/lib/types";
import { ApiPrediction } from "@/lib/api";
import { formatBaht } from "@/lib/prediction";
import { projectSeries, toPath } from "@/lib/projection";
import { Baht, DownloadMenu, Num } from "./ResultPanel";

interface ConclusionCardsProps {
  result: ApiPrediction;
  input: PredictionInput;
  rate: number;
}

export function ConclusionCards({ result, input, rate }: ConclusionCardsProps) {
  return (
    <section>
      <h2 className="section-title">สรุปผล</h2>
      {/* Raised so the download menu opens over the cards below. */}
      <div className="relative z-10 mt-5 grid gap-4 md:grid-cols-3">
        <Captioned caption="แนวโน้มราคา">
          <TrendCard result={result} input={input} rate={rate} />
        </Captioned>
        <Captioned caption="ราคาคาดการณ์">
          <EstimateCard result={result} input={input} />
        </Captioned>
        <Captioned caption="ความแม่นยำ">
          <AccuracyCard result={result} />
        </Captioned>
      </div>
    </section>
  );
}

function Captioned({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="flex-1 [&>*]:h-full">{children}</div>
      <p className="mt-2.5 text-center text-[12px] text-muted">{caption}</p>
    </div>
  );
}

const W = 300;
const H = 160;

function TrendCard({ result, input, rate }: ConclusionCardsProps) {
  const uid = useId();
  const lineId = `${uid}-line`;
  const glowId = `${uid}-glow`;
  const series = projectSeries(result.predictedPrice, result.lowerBound, result.upperBound, rate, input.year, 10);
  const min = Math.min(...series.map((p) => p.low));
  const max = Math.max(...series.map((p) => p.high));
  const mid = toPath(series.map((p) => p.mid), W, H, min, max);
  const highPath = toPath(series.map((p) => p.high), W, H, min, max);
  // Walk the low edge back from right to left so the band closes cleanly.
  const lowBack = toPath(series.map((p) => p.low), W, H, min, max)
    .split(" ")
    .reverse()
    .map((c) => `L${c.slice(1)}`)
    .join(" ");
  const band = `${highPath} ${lowBack} Z`;
  const first = series[0].year;
  const last = series[series.length - 1].year;
  const middle = series[Math.floor(series.length / 2)].year;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-[13px] text-muted">{result.meta.collateral_type}</p>
        <div className="text-right">
          <p className="num text-[15px] font-medium text-ink">
            <Baht value={result.predictedPrice} />
          </p>
          <p className="num text-[11.5px] text-accent-2">
            {rate > 0 ? "+" : ""}
            {rate.toFixed(1)}%/ปี
          </p>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 h-auto w-full overflow-visible"
        role="img"
        aria-label={`แนวโน้มราคา ${first} ถึง ${last}`}
      >
        <defs>
          <linearGradient id={lineId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgb(147 51 234)" />
            <stop offset="1" stopColor="rgb(236 72 153)" />
          </linearGradient>
          <filter id={glowId} x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1={0}
            x2={W}
            y1={(i * H) / 3}
            y2={(i * H) / 3}
            stroke="rgb(var(--c-line))"
            strokeOpacity={0.5}
            strokeWidth={1}
          />
        ))}
        <path d={band} fill="rgb(var(--c-accent))" fillOpacity={0.15} />
        <path
          d={mid}
          fill="none"
          stroke={`url(#${lineId})`}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${glowId})`}
        />
      </svg>
      <div className="num mt-3 flex justify-between text-[10.5px] text-faint">
        <span>{first}</span>
        <span>{middle}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}

function EstimateCard({ result, input }: { result: ApiPrediction; input: PredictionInput }) {
  const perSqm = result.predictedPrice / input.area;
  const { meta } = result;
  return (
    <div className="card p-5">
      <div className="space-y-2.5">
        <div className="glass-field flex items-center gap-3 px-4 py-3">
          <span className="text-[15px] text-muted">฿</span>
          <span className="num min-w-0 flex-1 truncate text-right text-[22px] font-semibold text-ink">
            <Baht value={result.predictedPrice} />
          </span>
        </div>
        <div className="glass-field flex items-center gap-3 px-4 py-3">
          <span className="text-[13px] text-muted">ตร.ม.</span>
          <span className="num min-w-0 flex-1 truncate text-right text-[22px] font-semibold text-ink">
            <Num value={perSqm} />
          </span>
          <span className="whitespace-nowrap text-[11px] text-faint">฿/ตร.ม.</span>
        </div>
      </div>
      <p className="num mt-3 text-center text-[12px] text-muted">
        ช่วง {formatBaht(result.lowerBound)} – {formatBaht(result.upperBound)}
      </p>
      <p className="mt-1.5 text-center text-[12px] text-muted">
        {meta.subdistrict}, {meta.district}
      </p>
      {meta.estate && (
        <p className="mt-2 flex justify-center">
          <span className="chip border-accent/30 bg-accent/10 text-accent">
            <Home className="h-3 w-3" />
            {meta.estate === "in" ? "ในหมู่บ้านจัดสรร" : "นอกหมู่บ้านจัดสรร"}
            {meta.estate === "in" && meta.project && ` · ${meta.project}`}
            {meta.estate_adjustment && ` · ปรับ ${meta.estate_adjustment.pct.toFixed(1)}% จากส่วนต่างที่วัดได้`}
          </span>
        </p>
      )}
      <div className="mt-4">
        <DownloadMenu input={input} result={result} triggerClassName="btn-primary w-full rounded-full" fullWidth />
      </div>
    </div>
  );
}

const R = 70;
const CIRC = 2 * Math.PI * R;

function AccuracyCard({ result }: { result: ApiPrediction }) {
  const uid = useId();
  const arcId = `${uid}-arc`;
  const { meta } = result;
  const frac = Math.min(1, Math.max(0, meta.within_20pct / 100));
  return (
    <div className="card p-5">
      <div className="relative mx-auto w-full max-w-[200px]">
        <svg viewBox="0 0 180 180" className="h-auto w-full" aria-hidden="true">
          <defs>
            <linearGradient id={arcId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="rgb(147 51 234)" />
              <stop offset="1" stopColor="rgb(236 72 153)" />
            </linearGradient>
          </defs>
          <g transform="rotate(-90 90 90)">
            <circle cx={90} cy={90} r={R} fill="none" stroke="rgb(var(--c-line))" strokeWidth={10} />
            <circle
              cx={90}
              cy={90}
              r={R}
              fill="none"
              stroke={`url(#${arcId})`}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${frac * CIRC} ${CIRC}`}
            />
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="text-[10.5px] text-faint">ถูกภายใน ±20%</span>
          <span className="num font-display text-[34px] font-semibold leading-tight text-ink">
            {meta.within_20pct}%
          </span>
          <span className="text-[10.5px] text-muted">คลาดเคลื่อนกลาง {meta.median_abs_pct_error}%</span>
        </div>
      </div>
      <div className="mt-4 flex flex-col items-center gap-1 text-[12px] text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent-2" />
          ตัวอย่าง {meta.sample_size.toLocaleString("en-US")}
        </span>
        {!meta.district_in_training_data && (
          <span className="text-center text-[11.5px] text-warn">
            เขตนี้ไม่มีในข้อมูลเทรน — ใช้ค่าระดับจังหวัดแทน
          </span>
        )}
      </div>
    </div>
  );
}
