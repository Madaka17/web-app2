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
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
        <MapPin className="w-3.5 h-3.5" />
        ทำเล / จังหวัด / อำเภอ / ตำบล
      </label>

      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="location-listbox"
        onClick={() => setOpen((v) => !v)}
        className={`
          w-full flex items-center justify-between px-3 py-2.5 rounded-xl
          bg-slate-50 dark:bg-slate-800/50 border transition-all text-left
          ${
            open
              ? "border-brand-400 ring-2 ring-brand-500/30"
              : "border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-500/30"
          }
        `}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex-shrink-0">
            <MapPin className="w-3.5 h-3.5 text-brand-500" />
          </div>
          <div className="min-w-0">
            {selected ? (
              <>
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {selected.subdistrict.name}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {selected.region.name} › {selected.district.name}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400">เลือกทำเล...</p>
            )}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          id="location-listbox"
          role="listbox"
          aria-label="เลือกทำเล"
          className="absolute z-30 mt-1 w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-fade-in"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 max-h-[70vh] overflow-y-auto sm:max-h-[28rem] sm:overflow-hidden">
            {/* Region Column */}
            <div className="border-r border-slate-100 dark:border-slate-700 min-h-0 sm:max-h-[28rem] overflow-y-auto scrollbar-thin">
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 z-10">
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
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                    selectedRegion === r.id
                      ? "bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  }`}
                >
                  {r.id === "bangkok" ? (
                    <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                  ) : (
                    <Landmark className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                  <span className="text-xs font-semibold truncate">{r.name}</span>
                  {selectedRegion === r.id && <Check className="w-3 h-3 ml-auto flex-shrink-0" />}
                </button>
              ))}
            </div>

            {/* District Column */}
            <div className="border-r border-slate-100 dark:border-slate-700 flex flex-col min-h-0 sm:max-h-[28rem] overflow-hidden">
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 z-10">
                อำเภอ/เขต
              </div>
              {allDistricts.length > 0 && (
                <div className="relative px-2 py-1.5 border-b border-slate-100 dark:border-slate-700">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <input
                    type="text"
                    value={districtQuery}
                    onChange={(e) => setDistrictQuery(e.target.value)}
                    placeholder="ค้นหา..."
                    className="w-full pl-6 pr-6 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                  />
                  {districtQuery && (
                    <button
                      type="button"
                      aria-label="ล้างคำค้นหาอำเภอ"
                      onClick={() => setDistrictQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                </div>
              )}
              <div className="overflow-y-auto scrollbar-thin flex-1 min-h-0">
                {allDistricts.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-slate-300 dark:text-slate-600 text-center">
                    เลือกภาคก่อน
                  </div>
                ) : filteredDistricts.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-slate-300 dark:text-slate-600 text-center">
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
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                        selectedDistrict === d.id
                          ? "bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      }`}
                    >
                      <span className="text-xs font-semibold truncate">{d.name}</span>
                      {selectedDistrict === d.id && <Check className="w-3 h-3 ml-auto flex-shrink-0" />}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Subdistrict Column */}
            <div className="flex flex-col min-h-0 sm:max-h-[28rem] overflow-hidden">
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 z-10">
                ตำบล/แขวง
              </div>
              {allSubdistricts.length > 0 && (
                <div className="relative px-2 py-1.5 border-b border-slate-100 dark:border-slate-700">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <input
                    type="text"
                    value={subdistrictQuery}
                    onChange={(e) => setSubdistrictQuery(e.target.value)}
                    placeholder="ค้นหา..."
                    className="w-full pl-6 pr-6 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                  />
                  {subdistrictQuery && (
                    <button
                      type="button"
                      aria-label="ล้างคำค้นหาตำบล"
                      onClick={() => setSubdistrictQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                </div>
              )}
              <div className="overflow-y-auto scrollbar-thin flex-1 min-h-0">
                {allSubdistricts.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-slate-300 dark:text-slate-600 text-center">
                    เลือกอำเภอก่อน
                  </div>
                ) : filteredSubdistricts.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-slate-300 dark:text-slate-600 text-center">
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
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors ${
                        subdistrictId === s.id
                          ? "bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      }`}
                    >
                      <span className="text-xs font-semibold truncate">{s.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[9px] text-slate-400">
                          ฿{(s.pricePerSqm / 1000).toFixed(0)}K/㎡
                        </span>
                        {subdistrictId === s.id && <Check className="w-3 h-3 text-brand-500" />}
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
