import { describe, it, expect } from "vitest";
import {
  EMPTY_FILTER,
  applyFilter,
  clusterByCell,
  escapeHtml,
  findPoint,
  normalizeListing,
  normalizeProject,
  safeHttpUrl,
  summarize,
  type MapFilter,
  type MapListing,
  type MapProject,
  type RawListing,
  type RawProject,
} from "../mapData";

const rawListing = (over: Partial<RawListing> = {}): RawListing => ({
  listing_id: "L1",
  url: "https://www.baania.com/listing/x",
  title: "บ้านสวย ทำเลดี",
  property_type: "บ้าน",
  bedrooms: 3,
  bathrooms: 2,
  area_sqm: 120,
  land_sqwa: 50,
  price_thb: 5_000_000,
  sub_district: "บางจาก",
  district: "พระโขนง",
  province: "กรุงเทพมหานคร",
  latitude: 13.7,
  longitude: 100.6,
  date_posted: "2026-11-01T00:00:00.000Z",
  image_url: "https://cdn.example.com/a.jpg",
  ...over,
});

const rawProject = (over: Partial<RawProject> = {}): RawProject => ({
  key: "P1",
  name: "หมู่บ้านตัวอย่าง",
  kind: "village",
  grade: "mid",
  n: 40,
  ppsqm: 60000,
  price: 6_000_000,
  area: 100,
  province: "กรุงเทพมหานคร",
  district: "ลาดกระบัง",
  sub_district: "ขุมทอง",
  lat: 13.72,
  lng: 100.75,
  ...over,
});

const listing = (over: Partial<MapListing> = {}): MapListing => ({
  kind: "listing",
  id: "L",
  url: "https://x.co/l",
  title: "Listing",
  rawType: "บ้าน",
  group: "house",
  price: 1_000_000,
  area: 100,
  bedrooms: 2,
  bathrooms: 1,
  subdistrict: "ก",
  district: "ข",
  province: "ค",
  lat: 13.7,
  lng: 100.6,
  image: "",
  ...over,
});

const project = (over: Partial<MapProject> = {}): MapProject => ({
  kind: "project",
  id: "P",
  name: "Project",
  projectKind: "village",
  grade: "mid",
  n: 10,
  ppsqm: 50000,
  price: 5_000_000,
  area: 100,
  subdistrict: "ก",
  district: "ข",
  province: "ค",
  lat: 13.7,
  lng: 100.6,
  ...over,
});

const filter = (over: Partial<MapFilter>): MapFilter => ({ ...EMPTY_FILTER, ...over });

describe("normalizeListing", () => {
  it.each([
    ["คอนโด", "condo"],
    ["บ้าน", "house"],
    ["บ้านแฝด", "house"],
    ["ทาวน์โฮม", "townhome"],
    ["ที่ดิน", "land"],
    ["อาคารพาณิชย์", "other"],
  ])("maps raw type %s to group %s", (rawType, group) => {
    expect(normalizeListing(rawListing({ property_type: rawType })).group).toBe(group);
  });

  it("derives area from land_sqwa (1 sq wa = 4 sqm) when area_sqm is null", () => {
    expect(normalizeListing(rawListing({ area_sqm: null, land_sqwa: 100 })).area).toBe(400);
  });

  it("gives null area when both area fields are null", () => {
    expect(normalizeListing(rawListing({ area_sqm: null, land_sqwa: null })).area).toBeNull();
  });

  it("maps a null sub_district to an empty string", () => {
    expect(normalizeListing(rawListing({ sub_district: null })).subdistrict).toBe("");
  });

  it("maps the raw fields onto the listing shape", () => {
    const m = normalizeListing(rawListing());
    expect(m).toMatchObject({
      kind: "listing",
      id: "L1",
      rawType: "บ้าน",
      price: 5_000_000,
      area: 120,
      bedrooms: 3,
      lat: 13.7,
      lng: 100.6,
      image: "https://cdn.example.com/a.jpg",
    });
  });
});

describe("normalizeProject", () => {
  it("uses key as id, kind as projectKind and a null sub_district as empty string", () => {
    const p = normalizeProject(rawProject({ sub_district: null }));
    expect(p).toMatchObject({ kind: "project", id: "P1", projectKind: "village", subdistrict: "" });
  });
});

describe("applyFilter", () => {
  const listings = [
    listing({ id: "land", group: "land", price: 1_000_000, area: 400 }),
    listing({ id: "house", group: "house", price: 6_000_000, area: 120 }),
    listing({ id: "nullArea", group: "house", price: 7_000_000, area: null }),
  ];

  it("keeps everything for group 'all' and empty bounds", () => {
    expect(applyFilter(listings, EMPTY_FILTER)).toHaveLength(3);
  });

  it("keeps only the matching listing group", () => {
    expect(applyFilter(listings, filter({ group: "land" })).map((p) => p.id)).toEqual(["land"]);
  });

  it("matches project mode by projectKind", () => {
    const projects = [project({ id: "v", projectKind: "village" }), project({ id: "c", projectKind: "condo" })];
    expect(applyFilter(projects, filter({ group: "village" })).map((p) => p.id)).toEqual(["v"]);
  });

  it("drops points cheaper than priceMin", () => {
    expect(applyFilter(listings, filter({ priceMin: "5000000" })).map((p) => p.id)).toEqual(["house", "nullArea"]);
  });

  it("drops a null-area listing when a size bound is set", () => {
    expect(applyFilter(listings, filter({ sizeMin: "10" })).map((p) => p.id)).toEqual(["land", "house"]);
  });

  it("returns nothing when min is above max", () => {
    expect(applyFilter(listings, filter({ priceMin: "9000000", priceMax: "1000000" }))).toEqual([]);
  });

  it("ignores blank and non-numeric bounds", () => {
    expect(applyFilter(listings, filter({ priceMin: "  ", sizeMax: "abc" }))).toHaveLength(3);
  });
});

describe("summarize", () => {
  it("returns zeros for no points", () => {
    expect(summarize([])).toEqual({ count: 0, totalPrice: 0, medianPrice: 0, villages: 0, condos: 0 });
  });

  it("takes the median of the prices", () => {
    expect(summarize([listing({ price: 9 }), listing({ price: 1 }), listing({ price: 2 })]).medianPrice).toBe(2);
  });

  it("counts projects as villages or condos", () => {
    const s = summarize([project({ projectKind: "village" }), project({ projectKind: "condo" }), listing()]);
    expect(s).toMatchObject({ count: 3, villages: 1, condos: 1 });
  });
});

describe("findPoint", () => {
  const points = [
    listing({ id: "a", title: "Sukhumvit Condo", district: "วัฒนา", subdistrict: "คลองตัน" }),
    project({ id: "b", name: "The Village Park" }),
  ];

  it("matches a listing title case-insensitively", () => {
    expect(findPoint(points, "sukhumvit")?.id).toBe("a");
  });

  it("matches a project name", () => {
    expect(findPoint(points, "village park")?.id).toBe("b");
  });

  it("matches a district or sub-district", () => {
    expect(findPoint(points, "วัฒนา")?.id).toBe("a");
    expect(findPoint(points, "คลองตัน")?.id).toBe("a");
  });

  it("returns undefined for a blank query", () => {
    expect(findPoint(points, "   ")).toBeUndefined();
  });
});

describe("clusterByCell", () => {
  type P = { lat: number; lng: number; x: number; y: number };
  const toPixel = (p: P) => ({ x: p.x, y: p.y });

  it("groups two points in one cell into a single cluster at their mean position", () => {
    const items: P[] = [
      { lat: 1, lng: 10, x: 5, y: 5 },
      { lat: 3, lng: 20, x: 30, y: 35 },
    ];
    const clusters = clusterByCell(items, toPixel, 40);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].items).toHaveLength(2);
    expect(clusters[0].lat).toBe(2);
    expect(clusters[0].lng).toBe(15);
  });

  it("keeps points in different cells as separate clusters", () => {
    const items: P[] = [
      { lat: 1, lng: 1, x: 5, y: 5 },
      { lat: 2, lng: 2, x: 45, y: 5 },
    ];
    expect(clusterByCell(items, toPixel, 40)).toHaveLength(2);
  });
});

describe("escapeHtml", () => {
  it("escapes markup and quotes", () => {
    const out = escapeHtml('<img src=x onerror="a">&\'');
    expect(out).not.toMatch(/[<>"']/);
    expect(out).toContain("&amp;");
  });
});

describe("safeHttpUrl", () => {
  it("passes an https URL", () => {
    expect(safeHttpUrl("https://x.co/a")).toBe("https://x.co/a");
  });

  it("rejects a javascript: URL", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects a non-URL", () => {
    expect(safeHttpUrl("not a url")).toBeNull();
  });
});
