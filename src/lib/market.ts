import { PropertyType } from "./types";

/**
 * The thesis groups property into three kinds. "ที่ดินพร้อมสิ่งปลูกสร้าง" is
 * two categories in the trained model (บ้านเดี่ยว, ทาวน์เฮ้าส์), so the form
 * asks for the group first and the building kind second.
 */
export type PropertyGroup = "land" | "land-building" | "condo";

export const PROPERTY_GROUPS: { id: PropertyGroup; label: string; types: PropertyType[] }[] = [
  { id: "land", label: "ที่ดิน", types: ["land"] },
  { id: "land-building", label: "ที่ดินพร้อมสิ่งปลูกสร้าง", types: ["house", "townhome"] },
  { id: "condo", label: "คอนโด", types: ["condo"] },
];

export const BUILDING_LABELS: Record<PropertyType, string> = {
  condo: "คอนโด",
  house: "บ้านเดี่ยว",
  townhome: "ทาวน์โฮม",
  land: "ที่ดิน",
};

export function groupOf(type: PropertyType): PropertyGroup {
  return PROPERTY_GROUPS.find((g) => g.types.includes(type))!.id;
}

/** 1 ตารางวา = 4 ตารางเมตร. Land is bought and sold by the ตร.ว. */
export const SQM_PER_WA = 4;

export interface AreaSpec {
  label: string;
  unit: string;
  /** square metres in one display unit */
  sqmPerUnit: number;
  min: number;
  max: number;
  /** value shown when the type is first picked, in display units */
  initial: number;
}

/** What the area field means, and its unit, for each type. The API takes sqm
 * (10–20,000); the limits below stay inside that in every unit. */
export const AREA_SPECS: Record<PropertyType, AreaSpec> = {
  land: { label: "เนื้อที่ดิน", unit: "ตร.ว.", sqmPerUnit: SQM_PER_WA, min: 10, max: 5000, initial: 100 },
  house: { label: "พื้นที่ใช้สอย", unit: "ตร.ม.", sqmPerUnit: 1, min: 30, max: 1500, initial: 160 },
  townhome: { label: "พื้นที่ใช้สอย", unit: "ตร.ม.", sqmPerUnit: 1, min: 30, max: 600, initial: 120 },
  condo: { label: "พื้นที่ห้อง", unit: "ตร.ม.", sqmPerUnit: 1, min: 20, max: 500, initial: 35 },
};

/** Baht per display unit (ตร.ว. for land, ตร.ม. otherwise). */
export function perUnit(priceOrPpsqm: number, type: PropertyType, areaSqm?: number): number {
  const ppsqm = areaSqm ? priceOrPpsqm / areaSqm : priceOrPpsqm;
  return ppsqm * AREA_SPECS[type].sqmPerUnit;
}

export function formatPerUnit(ppsqm: number, type: PropertyType): string {
  return `฿${Math.round(perUnit(ppsqm, type)).toLocaleString("en-US")}/${AREA_SPECS[type].unit}`;
}

/** Market price block from /api/predict (ml/market.py). */
export interface MarketPrice {
  level: "exact" | "size_band" | "subdistrict" | "district" | "province_type";
  basis: string;
  n: number;
  ppsqm: number;
  price: number;
  low: number | null;
  high: number | null;
  predicted_vs_market_pct: number;
}

export type VerdictKind = "below" | "fair" | "above";

export interface Verdict {
  kind: VerdictKind;
  label: string;
  /** asking vs predicted, % */
  gapPct: number;
}

export const VERDICT_LABELS: Record<VerdictKind, string> = {
  below: "ถูกกว่าตลาด",
  fair: "สมเหตุสมผล",
  above: "แพงเกินตลาด",
};

/**
 * Three-Way Decision on an asking price. The boundary region is the model's
 * own calibrated interval (P10–P90 of held-out error): inside it the listing
 * cannot be told apart from a fairly priced one, so the decision is deferred
 * to "สมเหตุสมผล". Only a price outside it is called cheap or expensive.
 */
export function verdict(asking: number, predicted: number, lower: number, upper: number): Verdict {
  const kind: VerdictKind = asking < lower ? "below" : asking > upper ? "above" : "fair";
  return { kind, label: VERDICT_LABELS[kind], gapPct: (asking / predicted - 1) * 100 };
}
