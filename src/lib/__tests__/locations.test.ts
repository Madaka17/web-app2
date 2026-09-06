import { describe, it, expect } from "vitest";
import { LOCATIONS, findSubdistrict, findLocationPath } from "../locations";
import { DEFAULT_SUBDISTRICT_ID } from "../defaults";

describe("locations", () => {
  it("resolves the app's default subdistrict id", () => {
    // Regression: the default used to be a slug that no longer existed in the
    // dataset, so every prediction silently fell back to a generic price.
    expect(findSubdistrict(DEFAULT_SUBDISTRICT_ID)).toBeDefined();
  });

  it("returns the full region › district › subdistrict path", () => {
    const path = findLocationPath(DEFAULT_SUBDISTRICT_ID);
    expect(path?.region.name).toBe("กรุงเทพมหานคร");
    expect(path?.district.name).toBe("คลองเตย");
    expect(path?.subdistrict.name).toBe("คลองเตย");
  });

  it("returns undefined for an unknown id", () => {
    expect(findSubdistrict("does-not-exist")).toBeUndefined();
    expect(findLocationPath("does-not-exist")).toBeUndefined();
  });

  it("has a positive price for every subdistrict", () => {
    const subdistricts = LOCATIONS.flatMap((r) =>
      r.districts.flatMap((d) => d.subdistricts),
    );
    expect(subdistricts.length).toBeGreaterThan(0);
    expect(subdistricts.every((s) => s.pricePerSqm > 0)).toBe(true);
  });

  it("has no duplicate subdistrict ids", () => {
    const ids = LOCATIONS.flatMap((r) => r.districts.flatMap((d) => d.subdistricts.map((s) => s.id)));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
