import type { PredictionInput } from "./types";
import type { MapPoint, TypeGroup } from "./mapData";
import { DEFAULT_SUBDISTRICT_ID, DEFAULT_YEAR, YEAR_MAX, YEAR_MIN } from "./defaults";

// Limits enforced by ml/api.py on the area field.
export const AREA_MIN = 10;
export const AREA_MAX = 20000;

/** Served price model coverage: roughly the Bangkok metro and its neighbours. */
const COVERAGE = { latMin: 13.4, latMax: 14.3, lngMin: 99.8, lngMax: 101.0 };

export const DEFAULT_FORM: PredictionInput = {
  propertyType: "condo",
  area: 65,
  nUnits: 1,
  year: DEFAULT_YEAR,
  subdistrictId: DEFAULT_SUBDISTRICT_ID,
};

export interface PriceTarget {
  lat: number;
  lng: number;
  source: "map" | "listing" | "project";
  point?: MapPoint;
}

export function isInCoverage(lat: number, lng: number): boolean {
  return (
    lat >= COVERAGE.latMin && lat <= COVERAGE.latMax && lng >= COVERAGE.lngMin && lng <= COVERAGE.lngMax
  );
}

/**
 * Fields a chosen map point writes into the form. Project and estate are always
 * cleared first so an earlier project pick does not carry over to a new target.
 */
export function targetPatch(target: PriceTarget): Partial<PredictionInput> {
  const patch: Partial<PredictionInput> = { project: undefined, estate: undefined };
  const point = target.point;
  if (!point) return patch;

  if (point.kind === "listing") {
    if (point.group !== "other") patch.propertyType = point.group as Exclude<TypeGroup, "other">;
    if (point.bedrooms !== null) patch.bedrooms = point.bedrooms;
    if (point.bathrooms !== null) patch.bathrooms = point.bathrooms;
    if (point.area !== null) patch.area = point.area;
    return patch;
  }

  patch.propertyType = point.projectKind === "village" ? "house" : "condo";
  patch.area = point.area;
  patch.project = point.id;
  if (point.projectKind === "village") patch.estate = "in";
  return patch;
}

/** Clamps a required number to [lo, hi]; a non-finite value takes the fallback. */
function fitRequired(value: number, fallback: number, lo: number, hi: number, integer: boolean): number {
  if (!Number.isFinite(value)) return fallback;
  const v = integer ? Math.round(value) : value;
  return Math.min(hi, Math.max(lo, v));
}

/** Clamps an optional number to [lo, hi]; blank or non-finite stays undefined. */
function fitOptional(value: number | undefined, lo: number, hi: number, integer: boolean): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const v = integer ? Math.round(value) : value;
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Builds the request body. Every numeric field is clamped to the range ml/api.py
 * accepts, so a half-typed value never reaches the API. Takes lat/lng from the target, if any.
 */
export function toPayload(form: PredictionInput, target: PriceTarget | null): PredictionInput {
  const area = Number.isFinite(form.area) ? Math.min(AREA_MAX, Math.max(AREA_MIN, form.area)) : AREA_MIN;
  const fitted: PredictionInput = {
    ...form,
    area,
    nUnits: fitRequired(form.nUnits, DEFAULT_FORM.nUnits, 1, 4, true),
    year: fitRequired(form.year, DEFAULT_FORM.year, YEAR_MIN, YEAR_MAX, true),
    bedrooms: fitOptional(form.bedrooms, 0, 20, false),
    bathrooms: fitOptional(form.bathrooms, 0, 20, false),
    buildingAge: fitOptional(form.buildingAge, 0, 100, false),
  };
  if (!target) {
    return { ...fitted, lat: undefined, lng: undefined, project: undefined };
  }
  return { ...fitted, lat: target.lat, lng: target.lng };
}

/** Percentage by which the asking price is above (positive) or below (negative) the prediction. */
export function askingGap(asking: number, predicted: number): number {
  return ((asking - predicted) / predicted) * 100;
}
