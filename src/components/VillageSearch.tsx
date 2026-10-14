import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Home, Loader2, Search, X } from "lucide-react";
import { EstateProject, ProjectArea, getProjectAreas, searchProjects } from "@/lib/api";
import { gradeLabel, gradeTone } from "@/lib/grades";

const SEARCH_DELAY_MS = 250;
// Browsing a province or district with no name typed lists this many, largest first.
const BROWSE_LIMIT = 60;
const SEARCH_LIMIT = 20;

// One fetch of the province/district list per page load, shared by every search box.
let areasOnce: Promise<ProjectArea[]> | null = null;
function loadAreas(): Promise<ProjectArea[]> {
  areasOnce ??= getProjectAreas("village").catch((e) => {
    areasOnce = null;
    throw e;
  });
  return areasOnce;
}

interface VillageSearchProps {
  selected: EstateProject | null;
  onSelect: (project: EstateProject | null) => void;
  placeholder?: string;
}

function baht(n: number): string {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function GradeBadge({ grade }: { grade: string }) {
  return (
    <span className={`inline-flex flex-shrink-0 rounded border px-1.5 py-px text-[10px] font-semibold ${gradeTone(grade)}`}>
      {gradeLabel(grade)}
    </span>
  );
}

/**
 * หมู่บ้านจัดสรร picker: filter by จังหวัด and อำเภอ/เขต, then either type part
 * of a name or open the list and pick (GET /api/projects).
 */
export function VillageSearch({ selected, onSelect, placeholder = "พิมพ์ชื่อหมู่บ้าน หรือกดเพื่อเลือกจากรายการ" }: VillageSearchProps) {
  const [areas, setAreas] = useState<ProjectArea[]>([]);
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EstateProject[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    let live = true;
    loadAreas()
      .then((a) => live && setAreas(a))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const q = query.trim();
    const timer = window.setTimeout(
      () => {
        setLoading(true);
        setError(null);
        searchProjects({ q, province, district, limit: q ? SEARCH_LIMIT : BROWSE_LIMIT }, controller.signal)
          .then((r) => {
            setResults(r.results);
            setTotal(r.total);
            setActive(0);
          })
          .catch((e: Error) => {
            if (e.name !== "AbortError") setError(e.message);
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      q ? SEARCH_DELAY_MS : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, province, district]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (p: EstateProject) => {
    onSelect(p);
    setQuery("");
    setOpen(false);
  };

  if (selected) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 p-3">
        <Home className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 break-words text-[13.5px] font-semibold text-ink">{selected.name}</span>
            <GradeBadge grade={selected.grade} />
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted">
            {selected.sub_district} · {selected.district} · {selected.n.toLocaleString()} ประกาศ ·{" "}
            <span className="num">฿{baht(selected.ppsqm)}</span>/ตร.ม.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="flex-shrink-0 rounded-lg p-1 text-muted transition-colors hover:bg-raised hover:text-ink"
          aria-label="ยกเลิกหมู่บ้านที่เลือก"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const districts = areas.find((a) => a.province === province)?.districts ?? [];

  return (
    <div className="space-y-2" ref={boxRef}>
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        <label className="min-w-0">
          <span className="sr-only">จังหวัด</span>
          <select
            value={province}
            onChange={(e) => {
              setProvince(e.target.value);
              setDistrict("");
              setOpen(true);
            }}
            className="field min-w-0 truncate py-2 text-[13px]"
          >
            <option value="">ทุกจังหวัด</option>
            {areas.map((a) => (
              <option key={a.province} value={a.province}>
                {a.province} ({a.n.toLocaleString()})
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className="sr-only">อำเภอ / เขต</span>
          <select
            value={district}
            disabled={!province}
            onChange={(e) => {
              setDistrict(e.target.value);
              setOpen(true);
            }}
            className="field min-w-0 truncate py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">{province ? "ทุกอำเภอ / เขต" : "เลือกจังหวัดก่อน"}</option>
            {districts.map((d) => (
              <option key={d.district} value={d.district}>
                {d.district} ({d.n.toLocaleString()})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            value={query}
            placeholder={placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") return setOpen(false);
              if (!open || results.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => (i + 1) % results.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => (i - 1 + results.length) % results.length);
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(results[active]);
              }
            }}
            className="field truncate pl-9 pr-10 text-[13.5px]"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setOpen((o) => !o);
              inputRef.current?.focus();
            }}
            className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-faint hover:text-ink"
            aria-label="เปิดรายการหมู่บ้าน"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />}
          </button>
        </div>

        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-pop scrollbar-thin"
          >
            {error ? (
              <li className="px-3 py-2.5 text-[12.5px] text-bad">{error}</li>
            ) : results.length === 0 ? (
              <li className="px-3 py-2.5 text-[12.5px] text-faint">
                {loading ? "กำลังค้นหา" : query.trim() ? `ไม่พบหมู่บ้านที่ตรงกับ “${query.trim()}”` : "ไม่มีหมู่บ้านในพื้นที่นี้"}
              </li>
            ) : (
              results.map((p, i) => (
                <li key={p.key} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(p)}
                    className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                      i === active ? "bg-accent/10" : ""
                    }`}
                  >
                    <Home className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-ink">{p.name}</span>
                        <GradeBadge grade={p.grade} />
                      </span>
                      <span className="block truncate text-[11px] text-faint">
                        {p.sub_district} · {p.district} · {p.n.toLocaleString()} ประกาศ
                      </span>
                    </span>
                    <span className="num hidden flex-shrink-0 text-[11.5px] text-muted min-[420px]:inline">
                      ฿{baht(p.ppsqm)}/ตร.ม.
                    </span>
                  </button>
                </li>
              ))
            )}
            {total > results.length && (
              <li className="px-3 py-1.5 text-[11px] text-faint">
                แสดง {results.length} จาก {total.toLocaleString()} แห่ง — พิมพ์ชื่อหรือเลือกอำเภอเพื่อให้แคบลง
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
