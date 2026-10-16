import { describe, it, expect } from "vitest";
import { projectSeries, toBandPath, toPath } from "../projection";

describe("projectSeries", () => {
  it("starts at today's values and has years + 1 points", () => {
    const s = projectSeries(3_000_000, 2_500_000, 3_600_000, 3, 2569, 10);
    expect(s).toHaveLength(11);
    expect(s[0]).toEqual({ year: 2569, low: 2_500_000, mid: 3_000_000, high: 3_600_000 });
    expect(s[10].year).toBe(2579);
    expect(s[10].mid).toBeCloseTo(3_000_000 * 1.03 ** 10, 0);
  });
  it("stays flat at 0% growth", () => {
    expect(projectSeries(1, 1, 1, 0, 2569, 5).every((p) => p.mid === 1)).toBe(true);
  });
  it("falls with a negative rate", () => {
    const s = projectSeries(100, 90, 110, -5, 2569, 2);
    expect(s[2].mid).toBeLessThan(s[0].mid);
  });
});

describe("toPath", () => {
  it("maps min to the bottom and max to the top", () => {
    expect(toPath([0, 10], 100, 50, 0, 10)).toBe("M0,50 L100,0");
  });
  it("draws a flat midline when max equals min", () => {
    expect(toPath([5, 5, 5], 100, 40, 5, 5)).toBe("M0,20 L50,20 L100,20");
  });
});

describe("toBandPath", () => {
  it("runs the high edge left to right, then the low edge back, and closes", () => {
    expect(toBandPath([0, 0], [10, 10], 100, 50, 0, 10)).toBe("M0,0 L100,0 L100,50 L0,50 Z");
  });
  it("collapses onto the midline when max equals min", () => {
    expect(toBandPath([5, 5, 5], [5, 5, 5], 100, 40, 5, 5)).toBe(
      "M0,20 L50,20 L100,20 L100,20 L50,20 L0,20 Z",
    );
  });
});
