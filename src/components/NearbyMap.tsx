import { useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Circle, CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { NearbyResult, getNearby } from "@/lib/api";
import { PropertyType } from "@/lib/types";

const BANGKOK: [number, number] = [13.7563, 100.5018];
const RADII = [1000, 2000] as const;

interface NearbyMapProps {
  point: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
  propertyType: PropertyType;
  buildingAge?: number;
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
 * what listings inside it ask per sqm (GET /api/nearby). With a building age
 * set, the figure is also given after the measured ค่าเสื่อม adjustment.
 */
export function NearbyMap({ point, onPick, propertyType, buildingAge }: NearbyMapProps) {
  const [radius, setRadius] = useState<(typeof RADII)[number]>(1000);
  const [onlyType, setOnlyType] = useState(true);
  const [data, setData] = useState<NearbyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!point) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getNearby(
      { ...point, radius, type: onlyType ? propertyType : undefined, buildingAge },
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
  }, [point, radius, onlyType, propertyType, buildingAge]);

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

      <div className="mt-4 h-[300px] border-y border-line/80">
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
        <label className="flex items-center gap-2 text-[12.5px] text-muted">
          <input type="checkbox" checked={onlyType} onChange={(e) => setOnlyType(e.target.checked)} />
          เฉพาะประเภทที่เลือก
        </label>

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
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="text-left text-faint">
                    <tr>
                      <th className="py-1 pr-3 font-medium">ประเภท</th>
                      <th className="py-1 pr-3 text-right font-medium">ประกาศ</th>
                      <th className="py-1 pr-3 text-right font-medium">บาท/ตร.ม. (กลาง)</th>
                      <th className="py-1 pr-3 text-right font-medium">ช่วง 25–75%</th>
                      {data.buildingAge !== null && (
                        <th className="py-1 text-right font-medium">หลังค่าเสื่อม {data.buildingAge} ปี</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="num text-ink">
                    {data.groups.map((g) => (
                      <tr key={g.label} className="border-t border-line/60">
                        <td className="py-1.5 pr-3">{g.label}</td>
                        <td className="py-1.5 pr-3 text-right">{g.n.toLocaleString()}</td>
                        <td className="py-1.5 pr-3 text-right">{baht(g.median_ppsqm)}</td>
                        <td className="py-1.5 pr-3 text-right text-muted">
                          {baht(g.p25_ppsqm)}–{baht(g.p75_ppsqm)}
                        </td>
                        {data.buildingAge !== null && (
                          <td className="py-1.5 text-right">
                            {g.adjusted_ppsqm !== undefined ? baht(g.adjusted_ppsqm) : "–"}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.buildingAge === null && (
              <p className="mt-2 text-[11.5px] text-faint">ใส่อายุอาคารในฟอร์มเพื่อดูราคาหลังหักค่าเสื่อม</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
