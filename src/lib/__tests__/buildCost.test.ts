import { describe, it, expect } from "vitest";
import spec from "../../data/buildCost.json";
import priceFile from "../../data/materialPrices.json";
import { bases, estimate, toCsv, CATEGORIES, DEFAULT_SETTINGS, PRESETS, PRICES, type Plan, type PriceTable } from "../buildCost";

// The 10 x 8 m test plan: 5 rooms, 5 doors, 5 windows, walls 36 m outside and 21 m inside.
const PLAN: Plan = {
  rooms: [
    { name: "ห้องนั่งเล่น", type: "living", width_m: 5, length_m: 5 },
    { name: "ห้องนอน 1", type: "bedroom", width_m: 5, length_m: 4 },
    { name: "ห้องนอน 2", type: "bedroom", width_m: 5, length_m: 4 },
    { name: "ครัว", type: "kitchen", width_m: 3, length_m: 3 },
    { name: "ห้องน้ำ", type: "bathroom", width_m: 2, length_m: 3 },
  ],
  doors: 5,
  windows: 5,
  exterior_wall_m: 36,
  interior_wall_m: 21,
};

// Fixed prices so the hand computations below do not move when the monthly file does.
const FIXED: Record<string, number> = {
  "0205010101300000": 168.22, // อิฐมอญ ถุง 100 ก้อน
  "1502040101400000": 2289.44, // ปูนซีเมนต์ผสม ต่อตัน
  "1004010301400000": 146.73, // กระเบื้อง 30x30 กล่อง
  "0906030100100000": 238, // ยิปซัม แผ่น
  "0807010104300000": 39.49, // ลอนคู่ แผ่น
  "1210040100400000": 2553.65, // รองพื้น ถัง
  "1210020103000000": 2160.97, // สีภายใน ถัง
  "1210010105300000": 2808.76, // สีภายนอก ถัง
  "0201020104700000": 175, // อิฐมวลเบา ตร.ม.
};
const PRICES_FIXED: PriceTable = Object.fromEntries(
  Object.entries(PRICES).map(([code, p]) => [code, { ...p, price: FIXED[code] ?? 100 }]),
);

// Economy with a brick wall, so one fixture exercises the RID brick, plaster and lime rules.
const BRICK = { ...PRESETS.economy, wall: "brick" };

const line = (e: ReturnType<typeof estimate>, item: string) => e.lines.find((l) => l.item === item);

describe("data", () => {
  it("prices every item that has a code, from the official source with a month", () => {
    expect(priceFile.source).toMatch(/^https:\/\/index\.tpso\.go\.th\//);
    for (const [id, item] of Object.entries(spec.items)) {
      if (!item.code) continue;
      const p = (priceFile.items as PriceTable)[item.code];
      expect(p, id).toBeDefined();
      expect(p.price, id).toBeGreaterThan(0);
      expect(p.month, id).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("gives every rule and default a known source", () => {
    const sources = Object.keys(spec.sources);
    for (const [id, r] of [...Object.entries(spec.rules), ...Object.entries(spec.defaults)]) {
      expect(sources, id).toContain(r.source);
    }
  });

  it("points every option line at a real item and rule", () => {
    for (const cat of CATEGORIES)
      for (const o of cat.options)
        for (const l of o.lines) {
          expect(spec.items, `${cat.id}/${o.id}`).toHaveProperty(l.item);
          if (l.rule === null) expect(l.missing_qty).toBeTruthy();
          else for (const shape of ["gable", "hip"]) expect(spec.rules).toHaveProperty(l.rule.replace("{shape}", shape));
        }
  });

  it("presets name an option in every category", () => {
    for (const preset of Object.values(PRESETS))
      for (const cat of CATEGORIES) expect(cat.options.map((o) => o.id)).toContain(preset[cat.id]);
  });
});

describe("bases", () => {
  it("measures the test plan", () => {
    const b = bases(PLAN, DEFAULT_SETTINGS);
    expect(b.floor).toBe(80);
    expect(b.floor_bath).toBe(6);
    expect(b.floor_dry).toBe(74);
    // (36 + 21) x 2.8 = 159.6, less 5 x 1.6 doors and 5 x 1.1 windows = 13.5
    expect(b.wall).toBeCloseTo(146.1, 6);
    expect(b.plaster).toBeCloseTo(292.2, 6);
    // 36 x 2.8 = 100.8, less 5.5 windows and one 1.6 door
    expect(b.paint_ext).toBeCloseTo(93.7, 6);
    // 2 x (2 + 3) x 2.0 = 20, less one door 1.6
    expect(b.bath_wall).toBeCloseTo(18.4, 6);
    expect(b.paint_int).toBeCloseTo(180.1, 6);
    // (80 + 36 x 1 + 4) / cos 25°
    expect(b.roof).toBeCloseTo(120 / Math.cos((25 * Math.PI) / 180), 6);
  });

  it("never goes negative or NaN on an empty or odd plan", () => {
    const b = bases({ rooms: [], doors: 0, windows: 0, exterior_wall_m: 0, interior_wall_m: 0 }, DEFAULT_SETTINGS);
    for (const v of Object.values(b)) expect(v).toBe(0);
    const odd = bases({ rooms: [{ name: "x", type: "other", width_m: -3, length_m: NaN }], doors: 40, windows: 60, exterior_wall_m: 2, interior_wall_m: 0 }, DEFAULT_SETTINGS);
    for (const v of Object.values(odd)) expect(Number.isFinite(v) && v >= 0).toBe(true);
  });
});

describe("estimate, economy preset with a brick wall", () => {
  const e = estimate(PLAN, DEFAULT_SETTINGS, BRICK, PRICES_FIXED);

  it("prices bricks from the RID rate", () => {
    // 146.1 sqm x 138 / 100 = 201.62 -> 202 bags x 168.22 = 33,980.44
    expect(line(e, "brick_red")).toMatchObject({ qty: 202, unit_price: 168.22, total: 33980 });
  });

  it("adds cement across wall, plaster and floor beds into one line", () => {
    // 146.1x16 + 292.2x8.42 + 74x20 + 6x20 = 6397.92 kg = 127.96 -> 128 bags x 114.47 = 14,652.16
    expect(line(e, "cement_mixed")).toMatchObject({ category: "common", qty: 128, unit_price: 114.47, total: 14652 });
  });

  it("rounds tiles, gypsum, roof and paint up to whole packs", () => {
    // (74 + 6) x 1.05 / 0.99 = 84.85 -> 85 boxes
    expect(line(e, "tile_floor_30")).toMatchObject({ qty: 85, total: Math.round(85 * 146.73) });
    // 80 / 2.88 = 27.8 -> 28 sheets
    expect(line(e, "gypsum_9")).toMatchObject({ qty: 28, total: 6664 });
    // 132.41 sqm x 2.37 = 313.8 -> 314 sheets
    expect(line(e, "roof_lonkhu")).toMatchObject({ qty: 314, total: Math.round(314 * 39.49) });
    // primer 273.8 / 150 = 1.83 -> 2; interior 180.1 x 2 / 150 = 2.4 -> 3; exterior 93.7 x 2 / 150 = 1.25 -> 2
    expect(line(e, "primer_std")?.qty).toBe(2);
    expect(line(e, "paint_int_std")?.qty).toBe(3);
    expect(line(e, "paint_ext_std")?.qty).toBe(2);
    expect(line(e, "paint_int_std")?.verified).toBe(false);
  });

  it("lists lime with its quantity but no price, outside the total", () => {
    // 146.1 x 10.29 + 292.2 x 7.70 = 1503.37 + 2249.94 = 3753.31 kg
    const lime = line(e, "lime");
    expect(lime).toMatchObject({ qty: 3753.31, unit_price: null, total: null });
    expect(lime?.missing).toBeTruthy();
  });

  it("adds VAT on the priced subtotal", () => {
    const sum = e.lines.reduce((t, l) => t + (l.total ?? 0), 0);
    expect(e.subtotal).toBe(sum);
    expect(e.vat).toBe(Math.round(sum * 0.07));
    expect(e.total).toBe(e.subtotal + e.vat);
  });

  it("writes a CSV Excel can read as Thai", () => {
    const csv = toCsv(e);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("อิฐมอญ");
  });
});

describe("changing one choice", () => {
  it("switching the wall to AAC changes only wall items", () => {
    const brick = estimate(PLAN, DEFAULT_SETTINGS, BRICK, PRICES_FIXED);
    const aac = estimate(PLAN, DEFAULT_SETTINGS, { ...BRICK, wall: "aac" }, PRICES_FIXED);
    expect(line(aac, "brick_red")).toBeUndefined();
    // 146.1 sqm priced per sqm
    expect(line(aac, "aac_75")).toMatchObject({ qty: 146.1, total: Math.round(146.1 * 175) });
    // 292.2 / 2.16 = 135.3 -> 136 bags
    expect(line(aac, "aac_plaster")?.qty).toBe(136);
    expect(line(aac, "aac_mortar")).toMatchObject({ qty: null, total: null });
    expect(line(aac, "lime")).toBeUndefined();
    expect(line(aac, "gypsum_9")).toEqual(line(brick, "gypsum_9"));
    expect(line(aac, "roof_lonkhu")).toEqual(line(brick, "roof_lonkhu"));
  });

  it("a hip roof uses the RID hip rate", () => {
    const hip = estimate(PLAN, { ...DEFAULT_SETTINGS, roof_shape: "hip" }, PRESETS.economy, PRICES_FIXED);
    // 132.41 x 2.41 = 319.1 -> 320
    expect(line(hip, "roof_lonkhu")?.qty).toBe(320);
  });

  it("no bathroom means no sanitary ware or bathroom tiles", () => {
    const plan = { ...PLAN, rooms: PLAN.rooms.filter((r) => r.type !== "bathroom") };
    const e = estimate(plan, DEFAULT_SETTINGS, PRESETS.economy, PRICES_FIXED);
    expect(line(e, "toilet_std")).toBeUndefined();
    expect(line(e, "tile_wall")).toBeUndefined();
  });
});
