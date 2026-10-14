import { PredictionInput, PredictionResult } from "./types";

// Same origin by default: the Vite dev server proxies /api to Flask (vite.config.ts).
const BASE = import.meta.env.VITE_API_URL ?? "";

export interface PredictionMeta {
  /** Project the map click snapped to (within 75 m), if any. */
  project: string | null;
  /** The estate status the models were given ("in" also when a project was named). */
  estate: "in" | "out" | null;
  estate_premium: EstatePremium | null;
  /** Measured discount applied when the house is stated to be outside an estate. */
  estate_adjustment: { factor: number; pct: number; basis: PremiumGap } | null;
  location_from: "map" | "subdistrict" | "project";
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

/** In-estate premium per sqm, matched on type, place and size (ml/estate.py). */
export interface PremiumGap {
  pct: number;
  lo: number;
  hi: number;
  cells: number;
  pairs: number;
}

export interface EstatePremium {
  n_in: number;
  n_out: number;
  n_unknown: number;
  /** vs listings that name no estate - a lower bound, the group is mixed. */
  vs_unnamed: PremiumGap | null;
  /** vs listings that say they are outside one - few of them. */
  vs_out: PremiumGap | null;
}

/** A หมู่บ้านจัดสรร or condo project from GET /api/projects (ml/projects.py). */
export interface EstateProject {
  key: string;
  name: string;
  kind: ProjectKind;
  grade: string;
  types: string[];
  n: number;
  ppsqm: number;
  price: number;
  area: number;
  transit_m: number | null;
  /** Share of its listings that mention security / a juristic person. */
  security: number;
  juristic: number;
  province: string;
  district: string;
  sub_district: string;
  lat: number | null;
  lng: number | null;
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

export type ProjectKind = "village" | "condo";

export interface ProjectFilter {
  q?: string;
  kind?: ProjectKind;
  province?: string;
  district?: string;
  grade?: string;
  limit?: number;
}

export function searchProjects(
  filter: ProjectFilter,
  signal?: AbortSignal,
): Promise<{ total: number; results: EstateProject[] }> {
  const q = new URLSearchParams({ kind: filter.kind ?? "village", limit: String(filter.limit ?? 10) });
  for (const key of ["q", "province", "district", "grade"] as const) {
    const v = filter[key];
    if (v) q.set(key, v);
  }
  return request(`/api/projects?${q}`, { signal });
}

export interface ProjectArea {
  province: string;
  n: number;
  districts: { district: string; n: number }[];
}

export function getProjectAreas(kind: ProjectKind = "village", signal?: AbortSignal): Promise<ProjectArea[]> {
  return request(`/api/project-areas?kind=${kind}`, { signal });
}

/** One grade of the ladder, from GET /api/grades. Figures are over projects
 * with at least `min_listings` listings and absent when a grade has none. */
export interface GradeRow {
  grade: string;
  label: string;
  low: number;
  high: number | null;
  projects: number;
  graded_projects: number;
  listings: number;
  price_median?: number;
  price_p25?: number;
  price_p75?: number;
  ppsqm_median?: number;
  area_median?: number;
  transit_m_median?: number | null;
  security_share?: number;
  juristic_share?: number;
  /** Median baht/sqm over the grade below, in percent. */
  ppsqm_vs_next_pct?: number;
  examples?: { key: string; name: string; district: string; price: number; ppsqm: number; n: number }[];
}

export function getGrades(
  signal?: AbortSignal,
): Promise<{ min_listings: number; village: GradeRow[]; condo: GradeRow[] }> {
  return request("/api/grades", { signal });
}

export function getEstatePremium(signal?: AbortSignal): Promise<{
  premium: Record<string, EstatePremium>;
  estates: number;
}> {
  return request("/api/estate", { signal });
}

export interface DepreciationStep {
  age_lo: number;
  age_hi: number;
  n: number;
  factor: number;
}

export interface NearbyGroup {
  type: string;
  label: string;
  n: number;
  median_ppsqm: number;
  p25_ppsqm: number;
  p75_ppsqm: number;
  median_price: number;
  median_area: number;
  /** Means after dropping NearbyResult.trim of listings from each end. */
  mean_price: number;
  mean_ppsqm: number;
  mean_area: number;
  n_with_age: number;
  median_age: number | null;
  adjusted_ppsqm?: number;
  age_factor?: number;
  mean_adjusted_ppsqm?: number;
}

/** Shape of GET /api/nearby: listings within a radius of a map click. */
export interface NearbyResult {
  lat: number;
  lng: number;
  radius_m: number;
  buildingAge: number | null;
  total: number;
  groups: NearbyGroup[];
  location: { province: string; district: string; subdistrict: string } | null;
  depreciation: DepreciationStep[];
  trim: number;
}

export function getNearby(
  params: { lat: number; lng: number; radius: number; type?: string; buildingAge?: number },
  signal?: AbortSignal,
): Promise<NearbyResult> {
  const q = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
    radius: String(params.radius),
  });
  if (params.type) q.set("type", params.type);
  if (params.buildingAge !== undefined) q.set("buildingAge", String(params.buildingAge));
  return request<NearbyResult>(`/api/nearby?${q}`, { signal });
}
