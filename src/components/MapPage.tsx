import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { UsedHomeListing, loadUsedHomes } from "@/lib/usedHomes";
import { NearbyMap } from "./NearbyMap";

interface MapPageProps {
  point: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
  /** Opens the valuation form priced from the picked point. */
  onPrice: () => void;
}

export function MapPage({ point, onPick, onPrice }: MapPageProps) {
  const [buildingAge, setBuildingAge] = useState<number | undefined>();
  const [homes, setHomes] = useState<UsedHomeListing[]>([]);

  // The map works without them; a failed load just leaves the layer empty.
  useEffect(() => {
    const controller = new AbortController();
    loadUsedHomes(controller.signal).then(setHomes).catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-6">
      <div className="max-w-xl">
        <h2 className="font-display text-[28px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[32px]">
          คลิกจุดบนแผนที่
          <br />
          ดูว่าประกาศรอบ ๆ ตั้งราคาไว้เท่าไหร่
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          จุดที่เลือกใช้ต่อในหน้าประเมินราคาได้ — แม่นกว่าเลือกแขวงอย่างเดียวมาก
        </p>
      </div>

      <div className="card flex flex-wrap items-end gap-x-6 gap-y-4 p-5 sm:p-6">
        <div className="w-40">
          <label htmlFor="map-building-age" className="label block">
            อายุอาคาร
          </label>
          <div className="relative mt-2.5">
            <input
              id="map-building-age"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              placeholder="ไม่ระบุ"
              value={buildingAge ?? ""}
              onChange={(e) => {
                const parsed = parseFloat(e.target.value);
                setBuildingAge(
                  e.target.value.trim() === "" || !Number.isFinite(parsed)
                    ? undefined
                    : Math.min(100, Math.max(0, parsed)),
                );
              }}
              className="field num pr-10 text-[14px]"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">
              ปี
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onPrice}
          disabled={!point}
          className="btn-primary group ml-auto px-5 py-2.5 text-[14px]"
        >
          ประเมินราคาที่จุดนี้
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>

      <NearbyMap
        point={point}
        onPick={onPick}
        buildingAge={buildingAge}
        homes={homes}
        mapHeight="h-[520px] sm:h-[640px]"
      />
    </div>
  );
}
