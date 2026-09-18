import { useMemo, useState } from "react";
import {
  Bath,
  BedDouble,
  BadgeCheck,
  ChevronDown,
  Clock3,
  Heart,
  Home,
  Locate,
  MapPin,
  Maximize,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  USED_HOME_DISTRICTS,
  USED_HOME_LISTINGS,
  USED_HOME_TYPES,
  UsedHomeListing,
  UsedHomeType,
} from "@/lib/usedHomes";

const PRICE_OPTIONS = [
  { label: "ทุกราคา", value: 0 },
  { label: "ไม่เกิน 3 ล้าน", value: 3000000 },
  { label: "ไม่เกิน 5 ล้าน", value: 5000000 },
  { label: "ไม่เกิน 10 ล้าน", value: 10000000 },
];

export function UsedHomes() {
  const [district, setDistrict] = useState("ทั้งหมด");
  const [type, setType] = useState<"ทั้งหมด" | UsedHomeType>("ทั้งหมด");
  const [maxPrice, setMaxPrice] = useState(0);
  const [minBeds, setMinBeds] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(USED_HOME_LISTINGS[0]?.id ?? "");
  const [showFilters, setShowFilters] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  const filteredHomes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return USED_HOME_LISTINGS.filter((home) => {
      const districtMatch = district === "ทั้งหมด" || home.district === district;
      const typeMatch = type === "ทั้งหมด" || home.type === type;
      const priceMatch = maxPrice === 0 || home.price <= maxPrice;
      const bedsMatch = minBeds === 0 || home.bedrooms >= minBeds;
      const queryMatch =
        q === "" ||
        [home.title, home.location, home.type, ...home.tags].some((field) =>
          field.toLowerCase().includes(q),
        );
      return districtMatch && typeMatch && priceMatch && bedsMatch && queryMatch;
    });
  }, [district, type, maxPrice, minBeds, query]);

  const selectedHome = filteredHomes.find((home) => home.id === selectedId) ?? filteredHomes[0];
  const activeFilterCount =
    (district !== "ทั้งหมด" ? 1 : 0) + (type !== "ทั้งหมด" ? 1 : 0) + (maxPrice ? 1 : 0) + (minBeds ? 1 : 0);

  const toggleFavorite = (id: string) => {
    setFavorites((current) =>
      current.includes(id) ? current.filter((favoriteId) => favoriteId !== id) : [...current, id],
    );
  };

  const resetFilters = () => {
    setDistrict("ทั้งหมด");
    setType("ทั้งหมด");
    setMaxPrice(0);
    setMinBeds(0);
    setQuery("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-[28px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[32px]">
            บ้านมือสองในระบบ
          </h2>
          <p className="mt-2 text-[14px] text-muted">
            <span className="num text-ink">{filteredHomes.length}</span> จาก{" "}
            <span className="num">{USED_HOME_LISTINGS.length}</span> รายการ · กรุงเทพฯ นนทบุรี สมุทรปราการ
          </p>
        </div>
        {favorites.length > 0 && (
          <span className="chip border-line bg-surface text-muted">
            <Heart className="h-3 w-3 fill-accent text-accent" />
            บันทึกไว้ {favorites.length}
          </span>
        )}
      </div>

      {/* Filter bar */}
      <div className="card p-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-transparent px-3 py-2 transition-colors focus-within:border-line focus-within:bg-raised">
            <Search className="h-4 w-4 flex-shrink-0 text-faint" />
            <span className="sr-only">ค้นหาบ้านมือสอง</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นจากทำเล ชื่อโครงการ หรือแท็ก"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="ล้างคำค้นหา"
                className="flex-shrink-0 rounded p-0.5 text-faint transition-colors hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          <span className="hidden h-6 w-px bg-line sm:block" />
          <FilterSelect label="ทำเล" value={district} options={USED_HOME_DISTRICTS} onChange={setDistrict} />
          <FilterSelect label="ประเภท" value={type} options={USED_HOME_TYPES} onChange={setType} />
          <FilterSelect
            label="ราคา"
            value={PRICE_OPTIONS.find((option) => option.value === maxPrice)?.label ?? "ทุกราคา"}
            options={PRICE_OPTIONS.map((option) => option.label)}
            onChange={(label) => setMaxPrice(PRICE_OPTIONS.find((option) => option.label === label)?.value ?? 0)}
          />
          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            aria-expanded={showFilters}
            className={`btn-ghost py-2 ${showFilters ? "border-ink/40 bg-raised" : ""}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            เพิ่มเติม
            {activeFilterCount > 0 && (
              <span className="num grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[10px] text-canvas">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line/70 px-2 pb-1 pt-3 animate-fade-in">
            <span className="label">ห้องนอน</span>
            <div className="flex gap-1 rounded-lg bg-raised p-0.5">
              {[0, 1, 2, 3, 4].map((beds) => (
                <button
                  key={beds}
                  onClick={() => setMinBeds(beds)}
                  aria-pressed={minBeds === beds}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all active:scale-95 ${
                    minBeds === beds ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
                  }`}
                >
                  {beds === 0 ? "ทั้งหมด" : `${beds}+`}
                </button>
              ))}
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-bad"
              >
                <X className="h-3.5 w-3.5" />
                ล้างตัวกรอง
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(400px,0.85fr)]">
        <div className="space-y-3">
          {filteredHomes.length === 0 ? (
            <EmptyResults onReset={resetFilters} />
          ) : (
            filteredHomes.map((home) => (
              <ListingCard
                key={home.id}
                home={home}
                selected={selectedHome?.id === home.id}
                favorite={favorites.includes(home.id)}
                onSelect={() => setSelectedId(home.id)}
                onToggleFavorite={() => toggleFavorite(home.id)}
              />
            ))
          )}
        </div>

        <div className="xl:sticky xl:top-20 xl:self-start">
          <PropertyMap listings={filteredHomes} selectedId={selectedHome?.id} onSelect={setSelectedId} />
        </div>
      </div>
    </div>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="relative flex items-center rounded-xl border border-line bg-surface transition-colors hover:border-faint/60">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full cursor-pointer appearance-none bg-transparent py-2 pl-3 pr-8 text-sm font-medium text-ink outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-faint" />
    </label>
  );
}

function ListingCard({
  home,
  selected,
  favorite,
  onSelect,
  onToggleFavorite,
}: {
  home: UsedHomeListing;
  selected: boolean;
  favorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  const perSqm = Math.round(home.price / home.area);
  return (
    <article
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      aria-pressed={selected}
      className={`group cursor-pointer overflow-hidden rounded-2xl border bg-surface transition-all duration-200 ease-out hover:shadow-lift ${
        selected ? "border-ink/50 shadow-lift" : "border-line/80 shadow-card hover:border-faint/60"
      }`}
    >
      <div className="grid grid-cols-[124px_minmax(0,1fr)] sm:grid-cols-[176px_minmax(0,1fr)]">
        <div className="relative overflow-hidden">
          <img
            src={home.image}
            alt={home.imageAlt}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
          <button
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite();
            }}
            className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border backdrop-blur transition-all duration-200 active:scale-90 ${
              favorite
                ? "border-accent/40 bg-accent text-white"
                : "border-white/30 bg-ink/40 text-white hover:bg-ink/70"
            }`}
            aria-label={favorite ? "เอาออกจากรายการโปรด" : "บันทึกเป็นรายการโปรด"}
            aria-pressed={favorite}
          >
            <Heart className={`h-3.5 w-3.5 ${favorite ? "fill-current" : ""}`} />
          </button>
          {home.featured && (
            <span className="absolute left-2 top-2 rounded-md bg-surface/95 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-label text-ink">
              แนะนำ
            </span>
          )}
        </div>

        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="label">{home.type}</p>
              <h3 className="mt-1 truncate font-display text-[16px] font-semibold text-ink sm:text-[17px]">
                {home.title}
              </h3>
              <p className="mt-1 flex items-start gap-1 text-[12px] leading-5 text-muted">
                <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-faint" strokeWidth={1.75} />
                <span className="truncate">{home.location}</span>
              </p>
            </div>
            {home.verified && (
              <BadgeCheck className="h-5 w-5 flex-shrink-0 text-ok" aria-label="ยืนยันข้อมูลแล้ว" strokeWidth={1.75} />
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <p className="num font-display text-[22px] font-semibold text-accent sm:text-[24px]">
              ฿{home.price.toLocaleString("en-US")}
            </p>
            <p className="num text-[12px] text-faint">฿{perSqm.toLocaleString("en-US")}/ตร.ม.</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
            <ListingStat icon={Maximize} value={`${home.area} ตร.ม.`} />
            <ListingStat icon={BedDouble} value={`${home.bedrooms} นอน`} />
            <ListingStat icon={Bath} value={`${home.bathrooms} น้ำ`} />
            <ListingStat icon={Clock3} value={home.listedAt} muted />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {home.tags.map((tag) => (
              <span key={tag} className="chip border-line bg-raised text-muted">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function ListingStat({ icon: Icon, value, muted }: { icon: typeof Maximize; value: string; muted?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${muted ? "text-faint" : ""}`}>
      <Icon className="h-3.5 w-3.5 text-faint" strokeWidth={1.75} />
      <span className="num">{value}</span>
    </span>
  );
}

function PropertyMap({
  listings,
  selectedId,
  onSelect,
}: {
  listings: UsedHomeListing[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const selected = listings.find((l) => l.id === selectedId);
  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-2xl border border-line/80 bg-raised shadow-card">
      {/* Schematic map: ruled grid with a few soft "park" and "river" shapes. */}
      <div className="bg-grid absolute inset-0" />
      <div className="absolute -bottom-20 -right-12 h-64 w-72 rotate-12 rounded-[45%] bg-sky-200/50 dark:bg-sky-900/25" />
      <div className="absolute left-[9%] top-[14%] h-28 w-40 rounded-[45%] bg-emerald-200/50 dark:bg-emerald-900/25" />
      <div className="absolute left-[53%] top-[34%] h-20 w-24 rounded-full bg-emerald-200/50 dark:bg-emerald-900/25" />

      <div className="relative z-10 flex items-start justify-between p-3">
        <div className="rounded-lg border border-line bg-surface/95 px-3 py-2 backdrop-blur">
          <p className="text-[13px] font-semibold text-ink">แผนที่</p>
          <p className="num text-[11px] text-muted">{listings.length} ตำแหน่ง</p>
        </div>
        <button
          className="btn-ghost h-9 w-9 p-0"
          aria-label="ไปตำแหน่งปัจจุบัน"
          type="button"
        >
          <Locate className="h-4 w-4" />
        </button>
      </div>

      {[
        { text: "BANGKOK", cls: "left-[8%] top-[54%] -rotate-[18deg]" },
        { text: "SAMUT PRAKAN", cls: "left-[62%] top-[78%] rotate-12" },
        { text: "NONTHABURI", cls: "left-[12%] top-[26%] -rotate-12" },
      ].map((l) => (
        <span
          key={l.text}
          className={`absolute z-10 select-none text-[10px] font-semibold tracking-[0.2em] text-faint/70 ${l.cls}`}
        >
          {l.text}
        </span>
      ))}

      {listings.map((home) => {
        const isSelected = home.id === selectedId;
        return (
          <button
            key={home.id}
            onClick={() => onSelect(home.id)}
            className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-transform duration-200 ease-out ${
              isSelected ? "scale-110" : "hover:scale-110"
            }`}
            style={{ top: home.position.top, left: home.position.left }}
            aria-label={`เลือก ${home.title}`}
            aria-pressed={isSelected}
          >
            <span
              className={`relative grid h-8 w-8 place-items-center rounded-full border-2 border-surface shadow-pop ${
                isSelected ? "bg-ink text-canvas" : "bg-accent text-white"
              }`}
            >
              <Home className="h-3.5 w-3.5" strokeWidth={2.25} />
              {isSelected && <span className="absolute -inset-1.5 -z-10 animate-ping rounded-full bg-ink/25" />}
            </span>
          </button>
        );
      })}

      {selected && (
        <div className="absolute inset-x-3 bottom-3 z-30 flex items-center gap-3 rounded-xl border border-line bg-surface/95 p-2.5 shadow-pop backdrop-blur animate-slide-up">
          <img src={selected.image} alt="" className="h-12 w-16 flex-shrink-0 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">{selected.title}</p>
            <p className="truncate text-[11px] text-muted">{selected.location}</p>
          </div>
          <p className="num flex-shrink-0 text-[14px] font-semibold text-accent">
            ฿{(selected.price / 1_000_000).toFixed(2)}M
          </p>
        </div>
      )}
    </div>
  );
}

function EmptyResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/60 p-8 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-raised text-faint">
        <Search className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 font-display text-[15px] font-semibold text-ink">ไม่มีรายการตรงเงื่อนไข</h3>
      <p className="mt-1.5 max-w-xs text-[13px] text-muted">ลองขยายช่วงราคา หรือเลือกทำเลอื่น</p>
      <button onClick={onReset} className="btn-ghost mt-4">
        ล้างตัวกรองทั้งหมด
      </button>
    </div>
  );
}
