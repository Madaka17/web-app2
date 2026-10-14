import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, MapPin } from "lucide-react";
import { NearbyResult, getNearby } from "@/lib/api";
import { formatBaht } from "@/lib/prediction";
import { UsedHomeListing } from "@/lib/usedHomes";
import { Map3D } from "./Map3D";

const RADII = [1000, 2000] as const;

interface NearbyMapProps {
  point: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
  buildingAge?: number;
  /** Used-home listings drawn on the map and listed when inside the radius. */
  homes?: UsedHomeListing[];
  /** Tailwind height class for the map itself. */
  mapHeight?: string;
  focus?: { lat: number; lng: number; key: string } | null;
}

const NEARBY_HOMES_SHOWN = 6;
const NO_HOMES: UsedHomeListing[] = [];

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function baht(n: number): string {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

/**
 * Click anywhere: the circle shows the 1 or 2 km radius and the panel shows
 * the average asking price of listings inside it, one card per property type
 * (GET /api/nearby). With a building age set, the price per sqm is also given
 * after the measured ค่าเสื่อม adjustment.
 */
export function NearbyMap({ point, onPick, buildingAge, homes = NO_HOMES, mapHeight = "h-[300px]", focus }: NearbyMapProps) {
  const [radius, setRadius] = useState<(typeof RADII)[number]>(1000);

  const homesInRadius = useMemo(() => {
    if (!point) return [];
    return homes
      .map((home) => ({ home, d: distanceM(point, home) }))
      .filter((x) => x.d <= radius)
      .sort((a, b) => a.d - b.d);
  }, [homes, point, radius]);
  const [data, setData] = useState<NearbyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!point) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getNearby(
      { ...point, radius, buildingAge },
      controller.signal,
    )
      .then(setData)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [point, radius, buildingAge]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-6">
        <div>
          <p className="label">ราคาในระแวก</p>
          <p className="mt-1 text-[12px] text-faint">คลิกบนแผนที่เพื่อดูราคาประกาศในรัศมีที่เลือก</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-raised p-1">
          {RADII.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRadius(r)}
              aria-pressed={radius === r}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-all ${
                radius === r ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
              }`}
            >
              {r / 1000} กม.
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 border-y border-line/80">
        <Map3D point={point} radius={radius} homes={homes} onPick={onPick} height={mapHeight} focus={focus} />
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        {!point ? (
          <p className="flex items-center gap-2 text-[13px] text-faint">
            <MapPin className="h-4 w-4" /> ยังไม่ได้เลือกจุด
          </p>
        ) : loading && !data ? (
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> กำลังนับประกาศในรัศมี
          </p>
        ) : error ? (
          <p className="text-[13px] text-bad">{error}</p>
        ) : data ? (
          <div className={loading ? "opacity-60" : ""}>
            {data.location && (
              <p className="text-[12.5px] text-muted">
                แขวง{data.location.subdistrict} · เขต{data.location.district} · {data.location.province}
              </p>
            )}
            {data.total === 0 ? (
              <p className="mt-2 text-[13px] text-faint">ไม่มีประกาศที่มีพิกัดในรัศมี {data.radius_m / 1000} กม.</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.groups.map((g) => (
                  <div key={g.label} className="rounded-xl bg-raised p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[13px] font-semibold text-ink">{g.label}</p>
                      <p className="num text-[11.5px] text-faint">{g.n.toLocaleString()} ประกาศ</p>
                    </div>
                    <p className="mt-2 text-[11px] text-faint">ราคาเฉลี่ย</p>
                    <p className="num font-display text-[22px] font-semibold leading-tight text-ink">
                      {formatBaht(g.mean_price)}
                    </p>
                    <p className="num mt-1.5 text-[12px] text-muted">
                      {baht(g.mean_ppsqm)} บาท/ตร.ม. · พื้นที่ {g.mean_area.toLocaleString()} ตร.ม.
                    </p>
                    {g.mean_adjusted_ppsqm !== undefined && (
                      <p className="num mt-1 text-[12px] text-accent">
                        หลังค่าเสื่อม {data.buildingAge} ปี: {baht(g.mean_adjusted_ppsqm)} บาท/ตร.ม.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-[11.5px] text-faint">
              เฉลี่ยหลังตัดประกาศแพงสุดและถูกสุดออกฝั่งละ {Math.round(data.trim * 100)}%
              {data.buildingAge === null && " · ใส่อายุอาคารเพื่อดูราคาหลังหักค่าเสื่อม"}
            </p>
          </div>
        ) : null}

        {point && homes.length > 0 && (
          <div className="border-t border-line/60 pt-4">
            <p className="label">บ้านมือสองในรัศมี ({homesInRadius.length.toLocaleString()})</p>
            {homesInRadius.length === 0 ? (
              <p className="mt-2 text-[13px] text-faint">ไม่มีบ้านมือสองในรัศมี {radius / 1000} กม.</p>
            ) : (
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {homesInRadius.slice(0, NEARBY_HOMES_SHOWN).map(({ home, d }) => (
                  <li key={home.id}>
                    <a
                      href={home.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex gap-3 rounded-xl bg-raised p-2 transition-colors hover:bg-raised/60 hover:ring-1 hover:ring-accent/40"
                    >
                      {home.image && (
                        <img
                          src={home.image}
                          alt=""
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="h-14 w-20 flex-shrink-0 rounded-lg object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="num text-[13px] font-semibold text-ink">{formatBaht(home.price)}</p>
                        <p className="truncate text-[12px] text-muted">{home.title}</p>
                        <p className="flex items-center gap-1 text-[11px] text-faint">
                          {home.type} · ห่าง {Math.round(d).toLocaleString()} ม.
                          <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                        </p>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
