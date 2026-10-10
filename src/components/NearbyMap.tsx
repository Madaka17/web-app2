import { useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Circle, CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { NearbyResult, getNearby } from "@/lib/api";
import { formatBaht } from "@/lib/prediction";

const BANGKOK: [number, number] = [13.7563, 100.5018];
const RADII = [1000, 2000] as const;

interface NearbyMapProps {
  point: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
  buildingAge?: number;
  /** Tailwind height class for the map itself. */
  mapHeight?: string;
}

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
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
export function NearbyMap({ point, onPick, buildingAge, mapHeight = "h-[300px]" }: NearbyMapProps) {
  const [radius, setRadius] = useState<(typeof RADII)[number]>(1000);
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

      <div className={`mt-4 ${mapHeight} border-y border-line/80`}>
        <MapContainer center={point ?? BANGKOK} zoom={12} className="h-full w-full" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPick onPick={onPick} />
          {point && (
            <>
              <Circle
                center={point}
                radius={radius}
                pathOptions={{ color: "#b4531f", weight: 1.5, fillOpacity: 0.08 }}
              />
              <CircleMarker
                center={point}
                radius={6}
                pathOptions={{ color: "#fff", weight: 2, fillColor: "#b4531f", fillOpacity: 1 }}
              />
            </>
          )}
        </MapContainer>
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
      </div>
    </div>
  );
}
