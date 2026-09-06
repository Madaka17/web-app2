import { useState } from "react";
import {
  ChevronRight,
  Zap,
  Target,
  Gauge,
  Timer,
  Award,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { MODEL_METRICS } from "@/lib/data";
import { ModelMetric } from "@/lib/types";

type MetricKey = "rmse" | "mae" | "r2" | "mape" | "inferenceMs";

const METRIC_CONFIG: {
  key: MetricKey;
  label: string;
  icon: typeof Target;
  unit: string;
  lowerIsBetter: boolean;
  format: (v: number) => string;
}[] = [
  {
    key: "rmse",
    label: "RMSE",
    icon: Target,
    unit: "฿",
    lowerIsBetter: true,
    format: (v) => `${(v / 1000).toFixed(0)}K`,
  },
  {
    key: "mae",
    label: "MAE",
    icon: Gauge,
    unit: "฿",
    lowerIsBetter: true,
    format: (v) => `${(v / 1000).toFixed(0)}K`,
  },
  {
    key: "r2",
    label: "R² Score",
    icon: TrendingUp,
    unit: "",
    lowerIsBetter: false,
    format: (v) => v.toFixed(3),
  },
  {
    key: "mape",
    label: "MAPE",
    icon: Target,
    unit: "%",
    lowerIsBetter: true,
    format: (v) => v.toFixed(1),
  },
  {
    key: "inferenceMs",
    label: "Inference Time",
    icon: Timer,
    unit: "ms",
    lowerIsBetter: true,
    format: (v) => v.toFixed(0),
  },
];

export function ModelMetrics() {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("rmse");
  const config = METRIC_CONFIG.find((m) => m.key === selectedMetric)!;

  const bestValue = config.lowerIsBetter
    ? Math.min(...MODEL_METRICS.map((m) => m[selectedMetric]))
    : Math.max(...MODEL_METRICS.map((m) => m[selectedMetric]));

  const maxValue = Math.max(...MODEL_METRICS.map((m) => m[selectedMetric]));
  const minValue = Math.min(...MODEL_METRICS.map((m) => m[selectedMetric]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span>เปรียบเทียบโมเดล</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-medium">Model Metrics</span>
      </div>

      {/* Model Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MODEL_METRICS.map((model) => (
          <ModelCard key={model.name} model={model} />
        ))}
      </div>

      {/* Metric Selector + Chart */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-500/10">
              <Award className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Metric Comparison</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {config.lowerIsBetter ? "ค่าต่ำกว่า = ดีกว่า" : "ค่าสูงกว่า = ดีกว่า"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {METRIC_CONFIG.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  onClick={() => setSelectedMetric(m.key)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${
                      selectedMetric === m.key
                        ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }
                  `}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bar Chart */}
        <div className="space-y-4">
          {MODEL_METRICS.map((model) => {
            const value = model[selectedMetric];
            const isBest = value === bestValue;
            const range = maxValue - minValue || 1;
            const normalizedWidth = config.lowerIsBetter
              ? ((maxValue - value) / range) * 100
              : ((value - minValue) / range) * 100;
            const barWidth = Math.max(15, normalizedWidth);

            return (
              <div key={model.name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-md"
                      style={{ backgroundColor: model.color }}
                    />
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {model.name}
                    </span>
                    {isBest && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400">
                        BEST
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {config.format(value)}
                    {config.unit && (
                      <span className="text-xs font-normal text-slate-400 ml-0.5">{config.unit}</span>
                    )}
                  </span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out relative"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: model.color,
                    }}
                  >
                    {isBest && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ensemble Weights */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-500/10">
            <Zap className="w-5 h-5 text-orange-500 dark:text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ensemble Weights</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">น้ำหนักของแต่ละโมเดลในการทำนายรวม</p>
          </div>
        </div>

        <div className="flex h-4 rounded-full overflow-hidden mb-4">
          {MODEL_METRICS.map((m) => (
            <div
              key={m.name}
              className="h-full transition-all duration-500"
              style={{ width: `${m.weight}%`, backgroundColor: m.color }}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {MODEL_METRICS.map((m) => (
            <div key={m.name} className="text-center">
              <div
                className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center"
                style={{ backgroundColor: `${m.color}20` }}
              >
                <div className="w-4 h-4 rounded" style={{ backgroundColor: m.color }} />
              </div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{m.weight}%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{m.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModelCard({ model }: { model: ModelMetric }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${model.color}20` }}
        >
          <div className="w-5 h-5 rounded-md" style={{ backgroundColor: model.color }} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">{model.name}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Weight: {model.weight}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">R²</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">{model.r2.toFixed(3)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">MAPE</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">{model.mape.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">RMSE</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            ฿{(model.rmse / 1000).toFixed(0)}K
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Speed</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {model.inferenceMs}ms
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Strengths
        </p>
        {model.strengths.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
            <span className="text-xs text-slate-600 dark:text-slate-400">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
