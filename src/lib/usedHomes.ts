/**
 * Listings for the "บ้านมือสอง" page: current for-sale posts with a photo and
 * coordinates, pulled from baania.com by Data/build_map_listings.py into
 * public/listings.json.
 */

export interface UsedHomeListing {
  id: string;
  url: string;
  title: string;
  type: string;
  price: number;
  area: number | null;
  landSqwa: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  subdistrict: string;
  district: string;
  province: string;
  lat: number;
  lng: number;
  postedAt: string;
  /** Rendered with referrerPolicy="no-referrer": the CDN refuses hotlinks otherwise. */
  image: string;
}

interface RawListing {
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

export async function loadUsedHomes(signal?: AbortSignal): Promise<UsedHomeListing[]> {
  const res = await fetch("/listings.json", { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const raw = (await res.json()) as RawListing[];
  raw.sort((a, b) => b.date_posted.localeCompare(a.date_posted));
  return raw.map((r) => ({
    id: r.listing_id,
    url: r.url,
    title: r.title,
    type: r.property_type,
    price: r.price_thb,
    area: r.area_sqm,
    landSqwa: r.land_sqwa,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    subdistrict: r.sub_district ?? "",
    district: r.district,
    province: r.province,
    lat: r.latitude,
    lng: r.longitude,
    postedAt: r.date_posted,
    image: r.image_url,
  }));
}

export function formatPosted(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "ลงวันนี้";
  if (days < 30) return `ลง ${days} วันที่แล้ว`;
  if (days < 365) return `ลง ${Math.floor(days / 30)} เดือนที่แล้ว`;
  return `ลง ${Math.floor(days / 365)} ปีที่แล้ว`;
}
