// Pure data layer for the OpenPlot map: loads, normalises, filters, clusters
// and summarises the listing and project pins. No React, no DOM.

export type TypeGroup = "condo" | "house" | "townhome" | "land" | "other";
export type ProjectKind = "village" | "condo";

/** One row of public/listings.json, as written by Data/build_map_listings.py. */
export interface RawListing {
  listing_id: string;
  url: string;
  title: string;
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqm: number | null;
  land_sqwa: number | null;
  price_thb: number;
  sub_district: string | null;
  district: string;
  province: string;
  latitude: number;
  longitude: number;
  date_posted: string;
  image_url: string;
}

/** One row of public/projects.json, as written by Data/build_map_projects.py. */
export interface RawProject {
  key: string;
  name: string;
  kind: ProjectKind;
  grade: string;
  n: number;
  ppsqm: number;
  price: number;
  area: number;
  province: string;
  district: string;
  sub_district: string | null;
  lat: number;
  lng: number;
}

export interface MapListing {
  kind: "listing";
  id: string;
  url: string;
  title: string;
  rawType: string;
  group: TypeGroup;
  price: number;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  subdistrict: string;
  district: string;
  province: string;
  lat: number;
  lng: number;
  image: string;
}

export interface MapProject {
  kind: "project";
  id: string;
  name: string;
  projectKind: ProjectKind;
  grade: string;
  n: number;
  ppsqm: number;
  price: number;
  area: number;
  subdistrict: string;
  district: string;
  province: string;
  lat: number;
  lng: number;
}

export type MapPoint = MapListing | MapProject;

export interface MapFilter {
  group: string;
  sizeMin: string;
  sizeMax: string;
  priceMin: string;
  priceMax: string;
}

export const EMPTY_FILTER: MapFilter = { group: "all", sizeMin: "", sizeMax: "", priceMin: "", priceMax: "" };

export const LISTING_LEGEND: [TypeGroup, string][] = [
  ["condo", "#22d3ee"],
  ["house", "#f97316"],
  ["townhome", "#facc15"],
  ["land", "#16a34a"],
  ["other", "#a21caf"],
];

export const PROJECT_LEGEND: [ProjectKind, string][] = [
  ["village", "#f97316"],
  ["condo", "#22d3ee"],
];

/** 1 square wa (ตารางวา) is 4 square metres. */
const SQM_PER_SQWA = 4;

const GROUP_BY_RAW_TYPE: Record<string, TypeGroup> = {
  คอนโด: "condo",
  บ้าน: "house",
  บ้านแฝด: "house",
  ทาวน์โฮม: "townhome",
  ที่ดิน: "land",
};

function groupOf(rawType: string): TypeGroup {
  return GROUP_BY_RAW_TYPE[rawType] ?? "other";
}

export function normalizeListing(raw: RawListing): MapListing {
  const area = raw.area_sqm ?? (raw.land_sqwa != null ? raw.land_sqwa * SQM_PER_SQWA : null);
  return {
    kind: "listing",
    id: raw.listing_id,
    url: raw.url,
    title: raw.title,
    rawType: raw.property_type,
    group: groupOf(raw.property_type),
    price: raw.price_thb,
    area,
    bedrooms: raw.bedrooms,
    bathrooms: raw.bathrooms,
    subdistrict: raw.sub_district ?? "",
    district: raw.district,
    province: raw.province,
    lat: raw.latitude,
    lng: raw.longitude,
    image: raw.image_url,
  };
}

export function normalizeProject(raw: RawProject): MapProject {
  return {
    kind: "project",
    id: raw.key,
    name: raw.name,
    projectKind: raw.kind,
    grade: raw.grade,
    n: raw.n,
    ppsqm: raw.ppsqm,
    price: raw.price,
    area: raw.area,
    subdistrict: raw.sub_district ?? "",
    district: raw.district,
    province: raw.province,
    lat: raw.lat,
    lng: raw.lng,
  };
}

async function loadJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function loadListings(signal?: AbortSignal): Promise<MapListing[]> {
  const rows = await loadJson<RawListing[]>("/listings.json", signal);
  return rows.map(normalizeListing);
}

export async function loadProjects(signal?: AbortSignal): Promise<MapProject[]> {
  const rows = await loadJson<RawProject[]>("/projects.json", signal);
  return rows.map(normalizeProject);
}

export function pinColor(p: MapPoint): string {
  if (p.kind === "listing") {
    return LISTING_LEGEND.find(([g]) => g === p.group)?.[1] ?? LISTING_LEGEND[LISTING_LEGEND.length - 1][1];
  }
  return PROJECT_LEGEND.find(([k]) => k === p.projectKind)?.[1] ?? PROJECT_LEGEND[0][1];
}

/** Parses a filter bound. Blank or non-numeric text means "no bound". */
function parseBound(text: string): number | null {
  const t = text.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function applyFilter<T extends MapPoint>(points: T[], f: MapFilter): T[] {
  const priceMin = parseBound(f.priceMin);
  const priceMax = parseBound(f.priceMax);
  const sizeMin = parseBound(f.sizeMin);
  const sizeMax = parseBound(f.sizeMax);
  const hasSizeBound = sizeMin !== null || sizeMax !== null;

  return points.filter((p) => {
    if (f.group !== "all") {
      const matches = p.kind === "listing" ? p.group === f.group : p.projectKind === f.group;
      if (!matches) return false;
    }
    if (priceMin !== null && p.price < priceMin) return false;
    if (priceMax !== null && p.price > priceMax) return false;
    if (hasSizeBound) {
      if (p.area === null) return false;
      if (sizeMin !== null && p.area < sizeMin) return false;
      if (sizeMax !== null && p.area > sizeMax) return false;
    }
    return true;
  });
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function summarize(points: MapPoint[]): {
  count: number;
  totalPrice: number;
  medianPrice: number;
  villages: number;
  condos: number;
} {
  let totalPrice = 0;
  let villages = 0;
  let condos = 0;
  for (const p of points) {
    totalPrice += p.price;
    if (p.kind === "project") {
      if (p.projectKind === "village") villages++;
      else condos++;
    }
  }
  return {
    count: points.length,
    totalPrice,
    medianPrice: median(points.map((p) => p.price)),
    villages,
    condos,
  };
}

/** Finds the first point whose title, project name, district or sub-district contains the query. */
export function findPoint(points: MapPoint[], query: string): MapPoint | undefined {
  const q = query.trim().toLowerCase();
  if (q === "") return undefined;
  return points.find((p) => {
    const fields = p.kind === "listing" ? [p.title, p.district, p.subdistrict] : [p.name, p.district, p.subdistrict];
    return fields.some((f) => f.toLowerCase().includes(q));
  });
}

export interface Cluster<T> {
  lat: number;
  lng: number;
  items: T[];
}

/**
 * Groups items into square screen cells of `cellPx` pixels and places each
 * cluster at the mean lat/lng of its items. Linear in the number of items.
 */
export function clusterByCell<T extends { lat: number; lng: number }>(
  items: T[],
  toPixel: (p: T) => { x: number; y: number },
  cellPx: number,
): Cluster<T>[] {
  const cells = new Map<string, Cluster<T>>();
  for (const item of items) {
    const { x, y } = toPixel(item);
    const key = `${Math.floor(x / cellPx)}:${Math.floor(y / cellPx)}`;
    let cluster = cells.get(key);
    if (!cluster) {
      cluster = { lat: 0, lng: 0, items: [] };
      cells.set(key, cluster);
    }
    cluster.items.push(item);
  }
  const out: Cluster<T>[] = [];
  for (const cluster of cells.values()) {
    const n = cluster.items.length;
    cluster.lat = cluster.items.reduce((s, it) => s + it.lat, 0) / n;
    cluster.lng = cluster.items.reduce((s, it) => s + it.lng, 0) / n;
    out.push(cluster);
  }
  return out;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Returns the URL if it parses and uses http or https, otherwise null. */
export function safeHttpUrl(s: string): string | null {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
