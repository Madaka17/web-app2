import { PredictionInput, PredictionResult } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3030";

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

export interface ApiPrediction extends PredictionResult {
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
