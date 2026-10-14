import { useEffect, useState } from "react";
import { Building, Home, Loader2, MapPin, ShieldCheck, Users } from "lucide-react";
import { GradeRow, getGrades } from "@/lib/api";
import { gradeTone } from "@/lib/grades";
import { formatBaht } from "@/lib/prediction";

type Kind = "village" | "condo";

const KIND_TABS: { id: Kind; label: string; icon: typeof Home }[] = [
  { id: "village", label: "หมู่บ้าน", icon: Home },
  { id: "condo", label: "คอนโด", icon: Building },
];

// What makes a good village, and what the listings let us measure of it.
const CRITERIA: { title: string; measured: string | null; icon: typeof Home }[] = [
  { title: "ทำเลเดินทางสะดวก", measured: "ระยะถึงรถไฟฟ้า (ค่ากลาง)", icon: MapPin },
  { title: "ระบบรักษาความปลอดภัยรัดกุม", measured: "ประกาศที่พูดถึง รปภ. / CCTV / คีย์การ์ด / 24 ชม.", icon: ShieldCheck },
  { title: "นิติบุคคลบริหารส่วนกลางอย่างมืออาชีพ", measured: "ประกาศที่พูดถึงนิติบุคคล / ค่าส่วนกลาง / คลับเฮ้าส์", icon: Users },
  { title: "วัสดุก่อสร้างได้มาตรฐาน", measured: null, icon: Building },
];

function money(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : `${Math.round(n / 1e3)}K`;
}

function range(row: GradeRow, kind: Kind): string {
  const unit = kind === "village" ? "" : "/ตร.ม.";
  if (row.high === null) return `${money(row.low)}${unit} ขึ้นไป`;
  if (row.low === 0) return `ต่ำกว่า ${money(row.high)}${unit}`;
  return `${money(row.low)}–${money(row.high)}${unit}`;
}

function pct(share: number | undefined): string {
  return share === undefined ? "–" : `${Math.round(share * 100)}%`;
}

/** Villages graded by median asking price, condos by baht/sqm, compared side by side. */
export function ProjectGrades() {
  const [kind, setKind] = useState<Kind>("village");
  const [data, setData] = useState<{ min_listings: number; village: GradeRow[]; condo: GradeRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getGrades(controller.signal)
      .then(setData)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, []);

  const rows = data?.[kind] ?? [];
  const maxPrice = Math.max(1, ...rows.map((r) => r.price_median ?? 0));
  const maxPpsqm = Math.max(1, ...rows.map((r) => r.ppsqm_median ?? 0));

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h2 className="font-display text-[28px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[32px]">
          เกรดหมู่บ้านและคอนโด
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          หมู่บ้านจัดเกรดจากราคาประกาศกลางของหมู่บ้าน คอนโดจัดจากราคาต่อ ตร.ม. กลางของโครงการ
          ตัวเลขแต่ละเกรดใช้โครงการที่มีประกาศอย่างน้อย {data?.min_listings ?? 3} รายการ
        </p>
      </div>

      <div className="flex gap-1 self-start rounded-xl bg-raised p-1 sm:inline-flex">
        {KIND_TABS.map((t) => {
          const Icon = t.icon;
          const active = kind === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setKind(t.id)}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${
                active ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="card p-6 text-[13px] text-bad">{error}</div>
      ) : !data ? (
        <div className="card flex items-center gap-2 p-6 text-[13px] text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลดเกรด
        </div>
      ) : (
        <>
          {/* Price ladder */}
          <section className="card p-5 sm:p-6">
            <h3 className="label">{kind === "village" ? "ราคากลางต่อหลัง และต่อ ตร.ม." : "ราคาต่อ ตร.ม. และราคากลางต่อห้อง"}</h3>
            <ul className="mt-4 space-y-4">
              {rows.map((r) => (
                <li key={r.grade} className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                  <div>
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11.5px] font-semibold ${gradeTone(r.grade)}`}>
                      {r.label}
                    </span>
                    <p className="mt-1 text-[11px] text-faint">
                      {range(r, kind)} · {r.graded_projects.toLocaleString()} โครงการ
                    </p>
                  </div>
                  {r.price_median === undefined ? (
                    <p className="text-[12px] text-faint">ไม่มีโครงการในเกรดนี้ที่มีประกาศพอ</p>
                  ) : (
                    <div className="space-y-1.5">
                      <Bar
                        value={kind === "village" ? r.price_median : r.ppsqm_median ?? 0}
                        max={kind === "village" ? maxPrice : maxPpsqm}
                        text={kind === "village" ? formatBaht(r.price_median) : `฿${(r.ppsqm_median ?? 0).toLocaleString()}/ตร.ม.`}
                      />
                      <p className="num text-[11.5px] text-muted">
                        {kind === "village"
                          ? `฿${(r.ppsqm_median ?? 0).toLocaleString()}/ตร.ม. · พื้นที่ ${r.area_median} ตร.ม. · ช่วง 25–75% ${money(r.price_p25 ?? 0)}–${money(r.price_p75 ?? 0)}`
                          : `ห้องละ ${formatBaht(r.price_median)} · ${r.area_median} ตร.ม.`}
                        {r.ppsqm_vs_next_pct !== undefined && (
                          <span className="text-accent"> · แพงกว่าเกรดถัดลงไป {r.ppsqm_vs_next_pct.toFixed(0)}% ต่อ ตร.ม.</span>
                        )}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* Quality signals per grade */}
          <section className="card overflow-hidden">
            <div className="p-5 pb-0 sm:p-6 sm:pb-0">
              <h3 className="label">เปรียบเทียบตามเกณฑ์เลือกหมู่บ้านที่ดี</h3>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CRITERIA.map((c) => {
                  const Icon = c.icon;
                  return (
                    <div key={c.title} className="flex gap-2.5 rounded-xl bg-raised p-3">
                      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                      <div>
                        <p className="text-[13px] font-medium text-ink">{c.title}</p>
                        <p className="text-[11.5px] text-faint">
                          {c.measured ? `วัดจาก: ${c.measured}` : "ประกาศไม่มีข้อมูลนี้ จึงไม่ได้ให้คะแนน"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[560px] text-[12.5px]">
                <thead className="text-left text-faint">
                  <tr className="border-y border-line/60">
                    <th className="px-5 py-2 font-medium sm:px-6">เกรด</th>
                    <th className="px-3 py-2 text-right font-medium">ประกาศ</th>
                    <th className="px-3 py-2 text-right font-medium">ถึงรถไฟฟ้า</th>
                    <th className="px-3 py-2 text-right font-medium">พูดถึงความปลอดภัย</th>
                    <th className="px-5 py-2 text-right font-medium sm:px-6">พูดถึงนิติบุคคล</th>
                  </tr>
                </thead>
                <tbody className="num text-ink">
                  {rows.map((r) => (
                    <tr key={r.grade} className="border-b border-line/40 last:border-0">
                      <td className="px-5 py-2 font-sans sm:px-6">{r.label}</td>
                      <td className="px-3 py-2 text-right">{r.listings.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">
                        {r.transit_m_median ? `${(r.transit_m_median / 1000).toFixed(1)} กม.` : "–"}
                      </td>
                      <td className="px-3 py-2 text-right">{pct(r.security_share)}</td>
                      <td className="px-5 py-2 text-right sm:px-6">{pct(r.juristic_share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-5 pb-5 pt-3 text-[11.5px] leading-relaxed text-faint sm:px-6">
              สัดส่วนนับจากข้อความในประกาศ ประกาศที่ไม่พูดถึงไม่ได้แปลว่าไม่มี
              ใช้เทียบระหว่างเกรดได้ แต่ไม่ใช่คะแนนของหมู่บ้านใดหมู่บ้านหนึ่ง
            </p>
          </section>

          {/* Examples */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {rows
              .filter((r) => r.examples?.length)
              .map((r) => (
                <div key={r.grade} className="card p-5">
                  <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11.5px] font-semibold ${gradeTone(r.grade)}`}>
                    {r.label}
                  </span>
                  <ul className="mt-3 space-y-1.5">
                    {r.examples!.map((e) => (
                      <li key={e.key} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                        <span className="min-w-0 truncate text-ink">
                          {e.name} <span className="text-faint">· {e.district}</span>
                        </span>
                        <span className="num flex-shrink-0 text-muted">
                          {kind === "village" ? money(e.price) : `${money(e.ppsqm)}/ตร.ม.`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </section>
        </>
      )}
    </div>
  );
}

function Bar({ value, max, text }: { value: number; max: number; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-raised">
        <div
          className="h-full origin-left animate-grow-x rounded-full bg-gradient-to-r from-accent-2 to-accent"
          style={{ width: `${Math.max(2, (value / max) * 100)}%` }}
        />
      </div>
      <span className="num w-32 flex-shrink-0 text-right text-[13px] font-semibold text-ink">{text}</span>
    </div>
  );
}
