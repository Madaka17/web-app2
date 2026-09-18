import { PredictionInput, PredictionResult } from "./types";

// Same origin by default: the Vite dev server proxies /api to Flask (vite.config.ts).
const BASE = import.meta.env.VITE_API_URL ?? "";

export interface PredictionMeta {
  province: string;
  district: string;
  subdistrict: string;
  district_in_training_data: boolean;
  collateral_type: string;
  median_abs_pct_error: number;
  within_20pct: number;
  sample_size: number;
  source: string;
}

/** What comparable listings go for, in baht per sqm - the numbers the
 * models were handed (ml/prepare_data.add_features), not a post-hoc story. */
export interface Comparables {
  district_ppsqm: number;
  district_n: number;
  subdistrict_ppsqm: number;
  subdistrict_n: number;
  size_band_ppsqm: number;
  size_band_n: number;
  exact_size_ppsqm: number;
  exact_size_n: number;
  nearest_size_ppsqm: number;
  province_type_ppsqm: number;
  predicted_ppsqm: number;
  vs_district_pct: number;
}

export interface ApiPrediction extends PredictionResult {
  comparables: Comparables;
  meta: PredictionMeta;
}

export interface ModelHealth {
  status: string;
  models: string[];
  weights: Record<string, number>;
  trained_on: string;
  fit_years: number[];
  rows_trained: number;
}

export interface TestMetrics {
  RMSE: number;
  MAE: number;
  R2: number;
  MAPE: number;
  MdAPE: number;
  Within_10Pct: number;
  Within_20Pct: number;
}

export interface Calibration {
  n: number;
  q10: number;
  q90: number;
  median_ratio: number;
  MdAPE: number;
  within_20pct: number;
}

/** Shape of ml/models/metrics.json, served verbatim by /api/metrics. */
export interface ModelMetricsReport {
  protocol: {
    fit_years: number[];
    validation_year: number;
    test_years: number[];
    served_model_fit_years: number[];
  };
  rows: { fit: number; validation: number; test: number };
  cleaning: Record<string, number>;
  features: string[];
  feature_importance: Record<string, number>;
  results: Record<string, { test: TestMetrics; weight: number; train_seconds?: number }>;
  calibration?: Record<string, Calibration>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function getHealth(signal?: AbortSignal): Promise<ModelHealth> {
  return request<ModelHealth>("/api/health", { signal });
}

export function getMetrics(signal?: AbortSignal): Promise<ModelMetricsReport> {
  return request<ModelMetricsReport>("/api/metrics", { signal });
}

export function predict(
  input: PredictionInput,
  signal?: AbortSignal,
): Promise<ApiPrediction> {
  return request<ApiPrediction>("/api/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
}
