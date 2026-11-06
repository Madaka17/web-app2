import { describe, it, expect } from "vitest";
import {
  AREA_MAX,
  AREA_MIN,
  DEFAULT_FORM,
  askingGap,
  gapApplies,
  isInCoverage,
  targetPatch,
  toPayload,
  type PriceTarget,
} from "../priceForm";
import { DEFAULT_SUBDISTRICT_ID, DEFAULT_YEAR, YEAR_MAX, YEAR_MIN } from "../defaults";
import type { MapListing, MapProject } from "../mapData";

const listing = (over: Partial<MapListing> = {}): MapListing => ({
  kind: "listing",
  id: "L1",
  url: "https://example.com/l1",
  title: "Listing",
  rawType: "ที่ดิน",
  group: "land",
  price: 3_000_000,
  area: 400,
  bedrooms: null,
  bathrooms: null,
  subdistrict: "Sub",
  district: "Dist",
  province: "Prov",
  lat: 13.75,
  lng: 100.5,
  image: "",
  ...over,
});

const project = (over: Partial<MapProject> = {}): MapProject => ({
  kind: "project",
  id: "P1",
  name: "Project",
  projectKind: "village",
  grade: "A",
  n: 10,
  ppsqm: 60000,
  price: 8_000_000,
  area: 150,
  subdistrict: "Sub",
  district: "Dist",
  province: "Prov",
  lat: 13.9,
  lng: 100.6,
  ...over,
});

const mapTarget: PriceTarget = { lat: 13.8, lng: 100.4, source: "map" };

describe("isInCoverage", () => {
  it("is true inside the served area and false outside it", () => {
    expect(isInCoverage(13.75, 100.5)).toBe(true);
    expect(isInCoverage(18.79, 98.98)).toBe(false);
  });
});

describe("targetPatch", () => {
  it("land listing sets type and area but no bedrooms key, and clears project and estate", () => {
    const patch = targetPatch({ lat: 13.75, lng: 100.5, source: "listing", point: listing() });
    expect(patch).toEqual({ propertyType: "land", area: 400 });
    expect(patch).not.toHaveProperty("bedrooms");
    expect(patch).not.toHaveProperty("bathrooms");
    expect(patch.project).toBeUndefined();
    expect(patch.estate).toBeUndefined();
  });

  it("listing sets bedrooms and bathrooms when non-null", () => {
    const patch = targetPatch({
      lat: 13.75,
      lng: 100.5,
      source: "listing",
      point: listing({ group: "house", rawType: "บ้าน", bedrooms: 3, bathrooms: 2, area: 120 }),
    });
    expect(patch.propertyType).toBe("house");
    expect(patch.bedrooms).toBe(3);
    expect(patch.bathrooms).toBe(2);
    expect(patch.area).toBe(120);
  });

  it("listing with null area does not set area", () => {
    const patch = targetPatch({ lat: 13.75, lng: 100.5, source: "listing", point: listing({ area: null }) });
    expect(patch).not.toHaveProperty("area");
  });

  it("other group listing sets no propertyType but still sets area", () => {
    const patch = targetPatch({
      lat: 13.75,
      lng: 100.5,
      source: "listing",
      point: listing({ group: "other", rawType: "อื่นๆ", area: 80 }),
    });
    expect(patch).not.toHaveProperty("propertyType");
    expect(patch.area).toBe(80);
  });

  it("village project sets house, area, estate in and project id", () => {
    const patch = targetPatch({ lat: 13.9, lng: 100.6, source: "project", point: project({ area: 150 }) });
    expect(patch.propertyType).toBe("house");
    expect(patch.area).toBe(150);
    expect(patch.estate).toBe("in");
    expect(patch.project).toBe("P1");
  });

  it("condo project sets condo and area but leaves project unset and no estate", () => {
    const patch = targetPatch({
      lat: 13.9,
      lng: 100.6,
      source: "project",
      point: project({ id: "C9", projectKind: "condo" }),
    });
    expect(patch.propertyType).toBe("condo");
    expect(patch.project).toBeUndefined();
    expect(patch.estate).toBeUndefined();
  });

  it("plain map target returns no fields but clears project and estate", () => {
    const patch = targetPatch(mapTarget);
    expect(patch).toEqual({});
    expect(patch.project).toBeUndefined();
    expect(patch.estate).toBeUndefined();
    expect(patch).toHaveProperty("project");
    expect(patch).toHaveProperty("estate");
  });
});

describe("toPayload", () => {
  it("takes lat and lng from the target", () => {
    const payload = toPayload(DEFAULT_FORM, mapTarget);
    expect(payload.lat).toBe(13.8);
    expect(payload.lng).toBe(100.4);
  });

  it("without a target clears lat, lng and project and keeps subdistrictId", () => {
    const payload = toPayload({ ...DEFAULT_FORM, project: "P1", lat: 1, lng: 2 }, null);
    expect(payload.lat).toBeUndefined();
    expect(payload.lng).toBeUndefined();
    expect(payload.project).toBeUndefined();
    expect(payload.subdistrictId).toBe(DEFAULT_SUBDISTRICT_ID);
  });

  it("clamps area below the minimum and above the maximum", () => {
    expect(toPayload({ ...DEFAULT_FORM, area: 5 }, null).area).toBe(10);
    expect(toPayload({ ...DEFAULT_FORM, area: 30000 }, null).area).toBe(20000);
    expect(AREA_MIN).toBe(10);
    expect(AREA_MAX).toBe(20000);
  });

  it("maps a non-finite area to the minimum", () => {
    expect(toPayload({ ...DEFAULT_FORM, area: NaN }, null).area).toBe(AREA_MIN);
    expect(toPayload({ ...DEFAULT_FORM, area: Infinity }, null).area).toBe(AREA_MIN);
  });

  it("clamps year to the served range", () => {
    expect(toPayload({ ...DEFAULT_FORM, year: 2 }, null).year).toBe(YEAR_MIN);
    expect(toPayload({ ...DEFAULT_FORM, year: 9999 }, null).year).toBe(YEAR_MAX);
  });

  it("clamps nUnits to 1-4", () => {
    expect(toPayload({ ...DEFAULT_FORM, nUnits: 0 }, null).nUnits).toBe(1);
    expect(toPayload({ ...DEFAULT_FORM, nUnits: 9 }, null).nUnits).toBe(4);
  });

  it("clamps bedrooms and bathrooms to 0-20", () => {
    expect(toPayload({ ...DEFAULT_FORM, bedrooms: 25 }, null).bedrooms).toBe(20);
    expect(toPayload({ ...DEFAULT_FORM, bedrooms: -1 }, null).bedrooms).toBe(0);
    expect(toPayload({ ...DEFAULT_FORM, bathrooms: 25 }, null).bathrooms).toBe(20);
  });

  it("clamps buildingAge to 0-100", () => {
    expect(toPayload({ ...DEFAULT_FORM, buildingAge: 500 }, null).buildingAge).toBe(100);
  });

  it("keeps an optional blank field undefined", () => {
    expect(toPayload({ ...DEFAULT_FORM, bedrooms: undefined }, null).bedrooms).toBeUndefined();
    expect(toPayload({ ...DEFAULT_FORM, buildingAge: undefined }, null).buildingAge).toBeUndefined();
  });

  it("falls back to the default for a non-finite required value", () => {
    expect(toPayload({ ...DEFAULT_FORM, year: NaN }, null).year).toBe(DEFAULT_FORM.year);
    expect(toPayload({ ...DEFAULT_FORM, nUnits: NaN }, null).nUnits).toBe(DEFAULT_FORM.nUnits);
  });
});

describe("DEFAULT_FORM", () => {
  it("is a 65 sqm condo with one unit at the default year and subdistrict", () => {
    expect(DEFAULT_FORM).toEqual({
      propertyType: "condo",
      area: 65,
      nUnits: 1,
      year: DEFAULT_YEAR,
      subdistrictId: DEFAULT_SUBDISTRICT_ID,
    });
  });
});

describe("askingGap", () => {
  it("is the percentage by which asking exceeds predicted", () => {
    expect(askingGap(110, 100)).toBe(10);
  });
});

describe("gapApplies", () => {
  const payload = { ...DEFAULT_FORM, propertyType: "land" as const, area: 400 };

  it("is true when the area and the property type match the listing", () => {
    expect(gapApplies(400, "land", payload)).toBe(true);
  });

  it("is false when the listing area is outside the clamped range", () => {
    expect(gapApplies(80000, "land", { ...payload, area: 20000 })).toBe(false);
  });

  it("is false when the area was edited after the pick", () => {
    expect(gapApplies(400, "land", { ...payload, area: 450 })).toBe(false);
  });

  it("is false when the property type was changed", () => {
    expect(gapApplies(400, "land", { ...payload, propertyType: "house" })).toBe(false);
  });

  it("is false when the listing area is null", () => {
    expect(gapApplies(null, "land", payload)).toBe(false);
  });

  it("is false when there is no result payload or no model type", () => {
    expect(gapApplies(400, "land", null)).toBe(false);
    expect(gapApplies(400, null, payload)).toBe(false);
  });
});
