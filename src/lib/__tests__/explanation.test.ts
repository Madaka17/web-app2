import { describe, it, expect } from "vitest";
import { barWidth, groupLabelKey, signedPct } from "../explanation";

describe("signedPct", () => {
  it("prefixes positive effects with a plus sign", () => {
    expect(signedPct(12.3)).toBe("+12.3%");
  });

  it("uses the U+2212 minus sign for negative effects", () => {
    expect(signedPct(-4)).toBe("\u22124.0%");
  });

  it("shows zero without a sign", () => {
    expect(signedPct(0)).toBe("0.0%");
    expect(signedPct(-0.04)).toBe("0.0%");
  });
});

describe("barWidth", () => {
  it("scales |pct| against the largest effect, as a share of half the track", () => {
    expect(barWidth(10, 20)).toBe(25);
    expect(barWidth(-5, 10)).toBe(25);
  });

  it("caps at half the track", () => {
    expect(barWidth(40, 20)).toBe(50);
  });

  it("is zero when there is nothing to scale against", () => {
    expect(barWidth(0, 0)).toBe(0);
    expect(barWidth(5, 0)).toBe(0);
  });
});

describe("groupLabelKey", () => {
  it("maps every explanation group to its i18n key", () => {
    expect(groupLabelKey("location")).toBe("groupLocation");
    expect(groupLabelKey("comparables")).toBe("groupComparables");
    expect(groupLabelKey("size")).toBe("groupSize");
    expect(groupLabelKey("unit")).toBe("groupUnit");
    expect(groupLabelKey("type_project")).toBe("groupType_project");
    expect(groupLabelKey("time")).toBe("groupTime");
  });

  it("returns null for an unknown group", () => {
    expect(groupLabelKey("nope")).toBeNull();
  });
});
