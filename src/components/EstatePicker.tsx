import { useEffect, useState } from "react";
import { EstatePremium, EstateProject, getEstatePremium } from "@/lib/api";
import { EstateStatus, PropertyType } from "@/lib/types";
import { VillageSearch } from "./VillageSearch";

// The model's names for the two house types an estate applies to.
const TYPE_NAMES: Partial<Record<PropertyType, string>> = { house: "บ้านเดี่ยว", townhome: "ทาวน์เฮ้าส์" };

const OPTIONS: { id: EstateStatus | undefined; label: string }[] = [
  { id: undefined, label: "ไม่ระบุ" },
  { id: "in", label: "ในหมู่บ้านจัดสรร" },
  { id: "out", label: "นอกหมู่บ้านจัดสรร" },
];

interface EstatePickerProps {
  propertyType: PropertyType;
  estate: EstateStatus | undefined;
  village: EstateProject | null;
  onEstate: (estate: EstateStatus | undefined) => void;
  onVillage: (village: EstateProject | null) => void;
}

function fmt(pct: number): string {
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/** หมู่บ้านจัดสรร or not, plus the village search, for houses and townhouses. */
export function EstatePicker({ propertyType, estate, village, onEstate, onVillage }: EstatePickerProps) {
  const [premium, setPremium] = useState<Record<string, EstatePremium> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getEstatePremium(controller.signal)
      .then((r) => setPremium(r.premium))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const typeName = TYPE_NAMES[propertyType];
  if (!typeName) return null;
  const p = premium?.[typeName];

  return (
    // z-20: the village list must paint over the cards below this one.
    <div className="card z-20 p-5 sm:p-6">
      <p className="label">หมู่บ้านจัดสรร</p>
      <div className="mt-2.5 grid grid-cols-1 gap-1 rounded-xl bg-raised p-1 min-[420px]:grid-cols-3">
        {OPTIONS.map((o) => {
          const active = estate === o.id;
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => onEstate(o.id)}
              aria-pressed={active}
              className={`rounded-lg px-2 py-2 text-[12.5px] font-medium transition-all duration-200 active:scale-[0.97] ${
                active ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {estate !== "out" && (
        <div className="mt-4">
          <p className="mb-2 text-[12px] font-medium text-muted">ค้นหาโครงการหมู่บ้าน (ไม่บังคับ)</p>
          <VillageSearch selected={village} onSelect={onVillage} />
          {!village && (
            <p className="mt-1.5 text-[11.5px] text-faint">
              เลือกหมู่บ้านแล้วจะนับเป็น "ในหมู่บ้านจัดสรร" และเทียบกับประกาศในหมู่บ้านเดียวกันโดยตรง
            </p>
          )}
        </div>
      )}

      {p?.vs_unnamed && (
        <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
          {typeName}ในหมู่บ้านจัดสรรตั้งราคาต่อ ตร.ม. สูงกว่าประกาศที่ไม่ระบุหมู่บ้าน{" "}
          <span className="num font-semibold text-accent">{fmt(p.vs_unnamed.pct)}</span>
          {p.vs_out && (
            <>
              {" "}และสูงกว่าบ้านที่ระบุว่าอยู่นอกหมู่บ้าน{" "}
              <span className="num font-semibold text-accent">{fmt(p.vs_out.pct)}</span>
            </>
          )}{" "}
          — เทียบในแขวงและขนาดเดียวกัน
          {estate === "out" && p.vs_out && (
            <span className="mt-1 block text-accent">
              เลือก "นอก" แล้วราคาจะปรับลด {(100 - 100 / (1 + p.vs_out.pct / 100)).toFixed(1)}% ตามส่วนต่างนี้
            </span>
          )}
        </p>
      )}
    </div>
  );
}
