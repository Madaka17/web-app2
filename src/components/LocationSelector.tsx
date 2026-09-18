import { useState, useEffect, useRef, useMemo } from "react";
import { MapPin, ChevronDown, Check, Building2, Landmark, Search, X } from "lucide-react";
import { LOCATIONS, findDistrict, findRegion, findLocationPath } from "@/lib/locations";

interface LocationSelectorProps {
  subdistrictId: string;
  onChange: (subdistrictId: string) => void;
}

export function LocationSelector({ subdistrictId, onChange }: LocationSelectorProps) {
  const [open, setOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [districtQuery, setDistrictQuery] = useState("");
  const [subdistrictQuery, setSubdistrictQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = findLocationPath(subdistrictId);

  useEffect(() => {
    const path = findLocationPath(subdistrictId);
    if (path) {
      setSelectedRegion(path.region.id);
      setSelectedDistrict(path.district.id);
    }
  }, [subdistrictId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const allDistricts = useMemo(
    () => (selectedRegion ? findRegion(selectedRegion)?.districts ?? [] : []),
    [selectedRegion],
  );
  const allSubdistricts = useMemo(
    () => (selectedDistrict ? findDistrict(selectedDistrict)?.subdistricts ?? [] : []),
    [selectedDistrict],
  );

  const filteredDistricts = useMemo(() => {
    if (!districtQuery.trim()) return allDistricts;
    const q = districtQuery.trim();
    return allDistricts.filter((d) => d.name.includes(q));
  }, [allDistricts, districtQuery]);

  const filteredSubdistricts = useMemo(() => {
    if (!subdistrictQuery.trim()) return allSubdistricts;
    const q = subdistrictQuery.trim();
    return allSubdistricts.filter((s) => s.name.includes(q));
  }, [allSubdistricts, subdistrictQuery]);

  const handleSubdistrictSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setSubdistrictQuery("");
    setDistrictQuery("");
    triggerRef.current?.focus();
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="label">ทำเล</span>
        <span className="text-[11px] text-faint">จังหวัด › เขต › แขวง</span>
      </div>

      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="location-listbox"
        onClick={() => setOpen((v) => !v)}
        className={`field flex items-center justify-between text-left ${
          open ? "border-accent/50 bg-surface ring-4 ring-accent/10" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="h-4 w-4 flex-shrink-0 text-accent" strokeWidth={1.75} />
          <div className="min-w-0">
            {selected ? (
              <>
                <p className="truncate text-[15px] font-medium text-ink">{selected.subdistrict.name}</p>
                <p className="truncate text-[11px] text-faint">
                  {selected.region.name} › {selected.district.name}
                </p>
              </>
            ) : (
              <p className="text-sm text-faint">เลือกทำเล</p>
            )}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          id="location-listbox"
          role="listbox"
          aria-label="เลือกทำเล"
          className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-pop animate-fade-in"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 max-h-[70vh] overflow-y-auto sm:max-h-[28rem] sm:overflow-hidden">
            {/* Region Column */}
            <div className="border-r border-line/80 min-h-0 sm:max-h-[28rem] overflow-y-auto scrollbar-thin">
              <div className="label sticky top-0 z-10 border-b border-line/80 bg-surface px-3 py-2">
                ภาค/จังหวัด
              </div>
              {LOCATIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedRegion(r.id);
                    setSelectedDistrict("");
                    setDistrictQuery("");
                    setSubdistrictQuery("");
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                    selectedRegion === r.id
                      ? "bg-accent-soft text-accent-ink"
                      : "text-muted hover:bg-raised hover:text-ink"
                  }`}
                >
                  {r.id === "bangkok" ? (
                    <Building2 className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.75} />
                  ) : (
                    <Landmark className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.75} />
                  )}
                  <span className="truncate text-[13px] font-medium">{r.name}</span>
                  {selectedRegion === r.id && <Check className="ml-auto h-3 w-3 flex-shrink-0 text-accent" />}
                </button>
              ))}
            </div>

            {/* District Column */}
            <div className="border-r border-line/80 flex flex-col min-h-0 sm:max-h-[28rem] overflow-hidden">
              <div className="label sticky top-0 z-10 border-b border-line/80 bg-surface px-3 py-2">
                อำเภอ/เขต
              </div>
              {allDistricts.length > 0 && (
                <div className="relative border-b border-line/80 px-2 py-1.5">
                  <Search className="absolute left-3.5 top-1/2 h-3 w-3 -translate-y-1/2 text-faint" />
                  <input
                    type="text"
                    value={districtQuery}
                    onChange={(e) => setDistrictQuery(e.target.value)}
                    placeholder="ค้นหา..."
                    className="w-full rounded-lg border border-line bg-raised py-1.5 pl-6 pr-6 text-xs text-ink placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/10"
                  />
                  {districtQuery && (
                    <button
                      type="button"
                      aria-label="ล้างคำค้นหาอำเภอ"
                      onClick={() => setDistrictQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="h-3 w-3 text-faint" />
                    </button>
                  )}
                </div>
              )}
              <div className="overflow-y-auto scrollbar-thin flex-1 min-h-0">
                {allDistricts.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-faint">
                    เลือกภาคก่อน
                  </div>
                ) : filteredDistricts.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-faint">
                    ไม่พบผลลัพธ์
                  </div>
                ) : (
                  filteredDistricts.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setSelectedDistrict(d.id);
                        setSubdistrictQuery("");
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                        selectedDistrict === d.id
                          ? "bg-accent-soft text-accent-ink"
                          : "text-muted hover:bg-raised hover:text-ink"
                      }`}
                    >
                      <span className="truncate text-[13px] font-medium">{d.name}</span>
                      {selectedDistrict === d.id && <Check className="ml-auto h-3 w-3 flex-shrink-0 text-accent" />}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Subdistrict Column */}
            <div className="flex flex-col min-h-0 sm:max-h-[28rem] overflow-hidden">
              <div className="label sticky top-0 z-10 border-b border-line/80 bg-surface px-3 py-2">
                ตำบล/แขวง
              </div>
              {allSubdistricts.length > 0 && (
                <div className="relative border-b border-line/80 px-2 py-1.5">
                  <Search className="absolute left-3.5 top-1/2 h-3 w-3 -translate-y-1/2 text-faint" />
                  <input
                    type="text"
                    value={subdistrictQuery}
                    onChange={(e) => setSubdistrictQuery(e.target.value)}
                    placeholder="ค้นหา..."
                    className="w-full rounded-lg border border-line bg-raised py-1.5 pl-6 pr-6 text-xs text-ink placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/10"
                  />
                  {subdistrictQuery && (
                    <button
                      type="button"
                      aria-label="ล้างคำค้นหาตำบล"
                      onClick={() => setSubdistrictQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="h-3 w-3 text-faint" />
                    </button>
                  )}
                </div>
              )}
              <div className="overflow-y-auto scrollbar-thin flex-1 min-h-0">
                {allSubdistricts.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-faint">
                    เลือกอำเภอก่อน
                  </div>
                ) : filteredSubdistricts.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-faint">
                    ไม่พบผลลัพธ์
                  </div>
                ) : (
                  filteredSubdistricts.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      role="option"
                      aria-selected={subdistrictId === s.id}
                      onClick={() => handleSubdistrictSelect(s.id)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${
                        subdistrictId === s.id
                          ? "bg-accent-soft text-accent-ink"
                          : "text-muted hover:bg-raised hover:text-ink"
                      }`}
                    >
                      <span className="truncate text-[13px] font-medium">{s.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="num text-[10px] text-faint">
                          ฿{(s.pricePerSqm / 1000).toFixed(0)}K/㎡
                        </span>
                        {subdistrictId === s.id && <Check className="h-3 w-3 text-accent" />}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
