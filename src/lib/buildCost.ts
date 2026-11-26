// Material quantities and costs for the /build-cost page. Pure: the plan and the
// choices go in, priced lines come out. Every coefficient lives in
// src/data/buildCost.json with its source; prices come from materialPrices.json
// (Data/fetch_material_prices.py).
import spec from "../data/buildCost.json";
import priceFile from "../data/materialPrices.json";

export type RoomType = "living" | "bedroom" | "kitchen" | "bathroom" | "other";
export const ROOM_TYPES: RoomType[] = ["living", "bedroom", "kitchen", "bathroom", "other"];

export interface Room {
  name: string;
  type: RoomType;
  width_m: number;
  length_m: number;
}

export interface Plan {
  rooms: Room[];
  doors: number;
  windows: number;
  exterior_wall_m: number;
  interior_wall_m: number;
}

export interface Settings {
  wall_height_m: number;
  door_sqm: number;
  window_sqm: number;
  bath_tile_height_m: number;
  roof_overhang_m: number;
  roof_pitch_deg: number;
  roof_shape: "gable" | "hip";
}

/** Category id -> option id. */
export type Selection = Record<string, string>;

export interface Price {
  name: string;
  unit: string;
  price: number;
  month: string;
}
export type PriceTable = Record<string, Price>;

export interface Line {
  item: string;
  /** Category the item belongs to, or "common" when several categories use it (cement, sand). */
  category: string;
  name_th: string;
  unit_th: string;
  qty: number | null;
  unit_price: number | null;
  total: number | null;
  month: string | null;
  /** Why qty or price is missing; the line is listed but left out of the total. */
  missing?: string;
  /** False when a coefficient behind this line is a starting value, not a cited figure. */
  verified: boolean;
}

export interface Estimate {
  lines: Line[];
  subtotal: number;
  vat: number;
  total: number;
  bases: Record<string, number>;
  months: { oldest: string | null; newest: string | null };
}

type Rule = { value: number; verified?: boolean };
type Item = { code: string | null; name_th: string; unit_th: string; factor: number; whole: boolean; box_sqm?: number; missing_price?: string };
type SpecLine = { item: string; basis: string; rule: string | null; scale?: number; invert?: boolean; pack?: string; coats?: string; box?: boolean; missing_qty?: string };
type Option = { id: string; label_th: string; lines: SpecLine[] };
type Category = { id: string; label_th: string; fixed?: boolean; options: Option[] };

const RULES = spec.rules as Record<string, Rule>;
const ITEMS = spec.items as Record<string, Item>;
export const CATEGORIES = spec.categories as Category[];
export const PRESETS = spec.presets as Record<"economy" | "standard" | "premium", Selection>;
export const NOT_INCLUDED_TH: string[] = spec.not_included_th;
export const PRICES = priceFile.items as PriceTable;
export const PRICE_SOURCE = { url: priceFile.source, basis: priceFile.basis, region: priceFile.region };
export const VAT_RATE = spec.vat_rate;

export const DEFAULT_SETTINGS: Settings = {
  wall_height_m: spec.defaults.wall_height_m.value,
  door_sqm: spec.defaults.door_sqm.value,
  window_sqm: spec.defaults.window_sqm.value,
  bath_tile_height_m: spec.defaults.bath_tile_height_m.value,
  roof_overhang_m: spec.defaults.roof_overhang_m.value,
  roof_pitch_deg: spec.defaults.roof_pitch_deg.value,
  roof_shape: "gable",
};

const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** Areas (sqm) and counts every line is measured against. */
export function bases(plan: Plan, s: Settings): Record<string, number> {
  const area = (r: Room) => pos(r.width_m) * pos(r.length_m);
  const baths = plan.rooms.filter((r) => r.type === "bathroom");
  const floor = plan.rooms.reduce((t, r) => t + area(r), 0);
  const floorBath = baths.reduce((t, r) => t + area(r), 0);
  const doors = Math.round(pos(plan.doors));
  const windows = Math.round(pos(plan.windows));
  const h = pos(s.wall_height_m);
  const ext = pos(plan.exterior_wall_m);
  const openings = doors * pos(s.door_sqm) + windows * pos(s.window_sqm);
  const wall = pos((ext + pos(plan.interior_wall_m)) * h - openings);
  const plaster = 2 * wall;
  // v1 puts every window and the front door on the outside wall.
  const paintExt = pos(ext * h - windows * pos(s.window_sqm) - Math.min(doors, 1) * pos(s.door_sqm));
  // Tiled to bath_tile_height_m round each bathroom, less its one door.
  const bathWall = baths.reduce(
    (t, r) => t + pos(2 * (pos(r.width_m) + pos(r.length_m)) * pos(s.bath_tile_height_m) - pos(s.door_sqm)),
    0,
  );
  const paintInt = pos(plaster - paintExt - bathWall);
  const o = pos(s.roof_overhang_m);
  const pitch = (Math.min(Math.max(s.roof_pitch_deg, 0), 60) * Math.PI) / 180;
  // Footprint grown by the overhang on every side, then sloped.
  const roof = floor > 0 ? (floor + ext * o + 4 * o * o) / Math.cos(pitch) : 0;
  return {
    floor,
    floor_bath: floorBath,
    floor_dry: pos(floor - floorBath),
    wall,
    plaster,
    paint_ext: paintExt,
    paint_int: paintInt,
    primer: paintExt + paintInt,
    bath_wall: bathWall,
    ceiling: floor,
    roof,
    doors,
    windows,
    bathrooms: baths.length,
  };
}

/** Quantity of the item's selling unit per unit of basis, and whether that figure is cited. */
function perUnit(line: SpecLine, s: Settings): { per: number; verified: boolean } | null {
  if (!line.rule) return null;
  const rule = RULES[line.rule.replace("{shape}", s.roof_shape)];
  if (!rule) throw new Error(`unknown rule ${line.rule}`);
  let verified = rule.verified !== false;
  if (line.box) {
    return { per: rule.value / (ITEMS[line.item].box_sqm ?? 1), verified };
  }
  if (line.invert) {
    const coats = line.coats ? RULES[line.coats] : undefined;
    const pack = line.pack ? RULES[line.pack].value : 1;
    if (coats && coats.verified === false) verified = false;
    return { per: (coats?.value ?? 1) / (rule.value * pack), verified };
  }
  return { per: rule.value * (line.scale ?? 1), verified };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function estimate(plan: Plan, s: Settings, selection: Selection, prices: PriceTable = PRICES): Estimate {
  const b = bases(plan, s);
  type Acc = { raw: number; categories: Set<string>; verified: boolean; missingQty?: string };
  const acc = new Map<string, Acc>();
  for (const cat of CATEGORIES) {
    const option = cat.options.find((o) => o.id === selection[cat.id]) ?? cat.options[0];
    for (const line of option.lines) {
      const basis = b[line.basis];
      if (basis === undefined) throw new Error(`unknown basis ${line.basis}`);
      if (basis <= 0) continue;
      const a = acc.get(line.item) ?? { raw: 0, categories: new Set<string>(), verified: true };
      a.categories.add(cat.id);
      const p = perUnit(line, s);
      if (p) {
        a.raw += basis * p.per;
        a.verified &&= p.verified;
      } else {
        a.missingQty = line.missing_qty ?? "ไม่มีข้อมูลปริมาณ";
      }
      acc.set(line.item, a);
    }
  }

  const lines: Line[] = [];
  for (const [id, a] of acc) {
    const item = ITEMS[id];
    const price = item.code ? prices[item.code] : undefined;
    const qty = a.missingQty ? null : item.whole ? Math.ceil(a.raw - 1e-9) : round2(a.raw);
    if (qty === 0) continue;
    const unitPrice = price ? round2(price.price * item.factor) : null;
    const total = qty !== null && unitPrice !== null ? Math.round(qty * unitPrice) : null;
    lines.push({
      item: id,
      category: a.categories.size > 1 ? "common" : [...a.categories][0],
      name_th: item.name_th,
      unit_th: item.unit_th,
      qty,
      unit_price: unitPrice,
      total,
      month: price?.month ?? null,
      missing: a.missingQty ?? (price ? undefined : item.missing_price ?? "ไม่มีราคา"),
      verified: a.verified,
    });
  }

  const subtotal = lines.reduce((t, l) => t + (l.total ?? 0), 0);
  const vat = Math.round(subtotal * VAT_RATE);
  const months = lines.map((l) => l.month).filter((m): m is string => !!m).sort();
  return {
    lines,
    subtotal,
    vat,
    total: subtotal + vat,
    bases: b,
    months: { oldest: months[0] ?? null, newest: months[months.length - 1] ?? null },
  };
}

/** CSV with a UTF-8 BOM so Excel shows Thai. */
export function toCsv(e: Estimate): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["หมวด", "รายการ", "จำนวน", "หน่วย", "ราคาต่อหน่วย (ไม่รวม VAT)", "รวม", "เดือนราคา", "หมายเหตุ"],
    ...e.lines.map((l) => [l.category, l.name_th, l.qty, l.unit_th, l.unit_price, l.total, l.month, l.missing ?? (l.verified ? "" : "ค่าประมาณ")]),
    [],
    ["", "รวมก่อน VAT", "", "", "", e.subtotal],
    ["", `VAT ${Math.round(VAT_RATE * 100)}%`, "", "", "", e.vat],
    ["", "รวมทั้งสิ้น", "", "", "", e.total],
  ];
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
}
