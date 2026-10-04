import { describe, it, expect } from "vitest";
import { AREA_SPECS, formatPerUnit, groupOf, perUnit, verdict } from "../market";

describe("verdict (Three-Way Decisions)", () => {
  // predicted 3.0M with a P10–P90 interval of 2.4M–3.6M
  const judge = (asking: number) => verdict(asking, 3_000_000, 2_400_000, 3_600_000);

  it("calls a price under the interval cheap", () => {
    expect(judge(2_300_000).kind).toBe("below");
  });

  it("defers to fair inside the interval, edges included", () => {
    expect(judge(2_400_000).kind).toBe("fair");
    expect(judge(3_000_000).kind).toBe("fair");
    expect(judge(3_600_000).kind).toBe("fair");
  });

  it("calls a price over the interval expensive", () => {
    expect(judge(3_700_000).kind).toBe("above");
  });

  it("reports the gap against the prediction", () => {
    expect(judge(3_300_000).gapPct).toBeCloseTo(10);
  });
});

describe("units", () => {
  it("prices land per ตร.ว. (4 sqm)", () => {
    expect(perUnit(25_000, "land")).toBe(100_000);
    expect(formatPerUnit(25_000, "land")).toBe("฿100,000/ตร.ว.");
  });

  it("prices buildings and condos per ตร.ม.", () => {
    expect(formatPerUnit(80_000, "condo")).toBe("฿80,000/ตร.ม.");
    expect(perUnit(4_000_000, "house", 160)).toBe(25_000);
  });

  it("keeps every type's area range inside the API's 10–20,000 sqm", () => {
    for (const a of Object.values(AREA_SPECS)) {
      expect(a.min * a.sqmPerUnit).toBeGreaterThanOrEqual(10);
      expect(a.max * a.sqmPerUnit).toBeLessThanOrEqual(20_000);
      expect(a.initial).toBeGreaterThanOrEqual(a.min);
      expect(a.initial).toBeLessThanOrEqual(a.max);
    }
  });

  it("groups house and townhome as land with building", () => {
    expect(groupOf("house")).toBe("land-building");
    expect(groupOf("townhome")).toBe("land-building");
    expect(groupOf("land")).toBe("land");
    expect(groupOf("condo")).toBe("condo");
  });
});
