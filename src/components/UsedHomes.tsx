import { useEffect, useMemo, useState } from "react";
import {
  Bath,
  BedDouble,
  ChevronDown,
  Clock3,
  ExternalLink,
  Heart,
  Loader2,
  MapPin,
  Maximize,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { CircleMarker, MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { UsedHomeListing, formatPosted, loadUsedHomes } from "@/lib/usedHomes";

const ALL = "ทั้งหมด";
const PRICE_OPTIONS = [
  { label: "ทุกราคา", value: 0 },
  { label: "ไม่เกิน 3 ล้าน", value: 3000000 },
  { label: "ไม่เกิน 5 ล้าน", value: 5000000 },
  { label: "ไม่เกิน 10 ล้าน", value: 10000000 },
  { label: "ไม่เกิน 30 ล้าน", value: 30000000 },
];
// Cards rendered at once; the map always shows every match.
const PAGE = 40;
const BANGKOK: [number, number] = [13.7563, 100.5018];

export function UsedHomes() {
  const [homes, setHomes] = useState<UsedHomeListing[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [province, setProvince] = useState(ALL);
  const [district, setDistrict] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [maxPrice, setMaxPrice] = useState(0);
  const [minBeds, setMinBeds] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    const controller = new AbortController();
    loadUsedHomes(controller.signal)
      .then(setHomes)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setLoadError(e.message);
      });
    return () => controller.abort();
  }, []);

  const provinces = useMemo(() => [ALL, ...new Set(homes.map((h) => h.province))], [homes]);
  const districts = useMemo(
    () => [ALL, ...new Set(homes.filter((h) => province === ALL || h.province === province).map((h) => h.district)).values()].sort(),
    [homes, province],
  );
  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of homes) counts.set(h.type, (counts.get(h.type) ?? 0) + 1);
    return [ALL, ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)];
  }, [homes]);

  const filteredHomes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return homes.filter((home) => {
      if (province !== ALL && home.province !== province) return false;
      if (district !== ALL && home.district !== district) return false;
      if (type !== ALL && home.type !== type) return false;
      if (maxPrice && home.price > maxPrice) return false;
      if (minBeds && (home.bedrooms ?? 0) < minBeds) return false;
      return q === "" || [home.title, home.subdistrict, home.district, home.type].some((f) => f.toLowerCase().includes(q));
    });
  }, [homes, province, district, type, maxPrice, minBeds, query]);

  // A new filter set starts the list over and drops a selection it hid.
  useEffect(() => setShown(PAGE), [province, district, type, maxPrice, minBeds, query]);
  const selectedHome = filteredHomes.find((home) => home.id === selectedId) ?? null;

  const activeFilterCount =
    (province !== ALL ? 1 : 0) + (district !== ALL ? 1 : 0) + (type !== ALL ? 1 : 0) + (maxPrice ? 1 : 0) + (minBeds ? 1 : 0);

  const toggleFavorite = (id: string) => {
    setFavorites((current) => (current.includes(id) ? current.filter((f) => f !== id) : [...current, id]));
  };

  const resetFilters = () => {
    setProvince(ALL);
    setDistrict(ALL);
    setType(ALL);
    setMaxPrice(0);
    setMinBeds(0);
    setQuery("");
  };

  const select = (id: string) => {
    setSelectedId(id);
    document.getElementById(`home-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-[28px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[32px]">
            บ้านมือสองในระบบ
          </h2>
          <p className="mt-2 text-[14px] text-muted">
            <span className="num text-ink">{filteredHomes.length.toLocaleString("en-US")}</span> จาก{" "}
            <span className="num">{homes.length.toLocaleString("en-US")}</span> ประกาศ · กรุงเทพฯ และปริมณฑล · จาก baania.com
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
              placeholder="ค้นจากชื่อประกาศ แขวง หรือเขต"
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
          <FilterSelect
            label="จังหวัด"
            value={province}
            options={provinces}
            onChange={(p) => {
              setProvince(p);
              setDistrict(ALL);
            }}
          />
          <FilterSelect label="เขต" value={district} options={districts} onChange={setDistrict} />
          <FilterSelect label="ประเภท" value={type} options={types} onChange={setType} />
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
                  {beds === 0 ? ALL : `${beds}+`}
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
        <div className="space-y-3">
          {loadError ? (
            <EmptyResults
              title="โหลดรายการไม่สำเร็จ"
              hint={`${loadError} — สร้างไฟล์ด้วย cd Data && python build_map_listings.py`}
            />
          ) : homes.length === 0 ? (
            <div className="flex min-h-[360px] items-center justify-center text-muted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังโหลดประกาศ
            </div>
          ) : filteredHomes.length === 0 ? (
            <EmptyResults title="ไม่มีรายการตรงเงื่อนไข" hint="ลองขยายช่วงราคา หรือเลือกทำเลอื่น" onReset={resetFilters} />
          ) : (
            <>
              {filteredHomes.slice(0, shown).map((home) => (
                <ListingCard
                  key={home.id}
                  home={home}
                  selected={selectedHome?.id === home.id}
                  favorite={favorites.includes(home.id)}
                  onSelect={() => setSelectedId(home.id)}
                  onToggleFavorite={() => toggleFavorite(home.id)}
                />
              ))}
              {shown < filteredHomes.length && (
                <button onClick={() => setShown((n) => n + PAGE)} className="btn-ghost w-full justify-center py-3">
                  แสดงอีก {Math.min(PAGE, filteredHomes.length - shown)} รายการ
                  <span className="num text-faint">
                    ({shown}/{filteredHomes.length})
                  </span>
                </button>
              )}
            </>
          )}
        </div>

        <div className="xl:sticky xl:top-20 xl:self-start">
          <PropertyMap listings={filteredHomes} selected={selectedHome} onSelect={select} onClose={() => setSelectedId(null)} />
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative flex items-center rounded-xl border border-line bg-surface transition-colors hover:border-faint/60">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full max-w-[180px] cursor-pointer appearance-none bg-transparent py-2 pl-3 pr-8 text-sm font-medium text-ink outline-none"
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

function sizeLabel(home: UsedHomeListing): string | null {
  if (home.area) return `${home.area.toLocaleString("en-US")} ตร.ม.`;
  if (home.landSqwa) return `${home.landSqwa.toLocaleString("en-US")} ตร.วา`;
  return null;
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
  const size = sizeLabel(home);
  return (
    <article
      id={`home-${home.id}`}
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
        <div className="relative overflow-hidden bg-raised">
          <img
            src={home.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
          <button
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite();
            }}
            className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border backdrop-blur transition-all duration-200 active:scale-90 ${
              favorite ? "border-accent/40 bg-accent text-white" : "border-white/30 bg-ink/40 text-white hover:bg-ink/70"
            }`}
            aria-label={favorite ? "เอาออกจากรายการโปรด" : "บันทึกเป็นรายการโปรด"}
            aria-pressed={favorite}
          >
            <Heart className={`h-3.5 w-3.5 ${favorite ? "fill-current" : ""}`} />
          </button>
        </div>

        <div className="min-w-0 p-4 sm:p-5">
          <p className="label">{home.type}</p>
          <h3 className="mt-1 line-clamp-2 font-display text-[15px] font-semibold leading-snug text-ink sm:text-[16px]">
            {home.title}
          </h3>
          <p className="mt-1 flex items-start gap-1 text-[12px] leading-5 text-muted">
            <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-faint" strokeWidth={1.75} />
            <span className="truncate">
              {home.subdistrict && `${home.subdistrict} · `}
              {home.district} · {home.province}
            </span>
          </p>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <p className="num font-display text-[22px] font-semibold text-accent sm:text-[24px]">
              ฿{home.price.toLocaleString("en-US")}
            </p>
            {home.area && (
              <p className="num text-[12px] text-faint">฿{Math.round(home.price / home.area).toLocaleString("en-US")}/ตร.ม.</p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
            {size && <ListingStat icon={Maximize} value={size} />}
            {home.bedrooms != null && <ListingStat icon={BedDouble} value={`${home.bedrooms} นอน`} />}
            {home.bathrooms != null && <ListingStat icon={Bath} value={`${home.bathrooms} น้ำ`} />}
            <ListingStat icon={Clock3} value={formatPosted(home.postedAt)} muted />
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

/** Pans to the selected listing whenever it changes. */
function FlyToSelected({ selected }: { selected: UsedHomeListing | null }) {
  const map = useMap();
  useEffect(() => {
    if (!selected) return;
    const zoom = Math.max(map.getZoom(), 14);
    // Aim a little below the pin so the detail card at the bottom does not cover it.
    const target = map.unproject(map.project([selected.lat, selected.lng], zoom).add([0, 130]), zoom);
    map.flyTo(target, zoom, { duration: 0.6 });
  }, [map, selected]);
  return null;
}

function PropertyMap({
  listings,
  selected,
  onSelect,
  onClose,
}: {
  listings: UsedHomeListing[];
  selected: UsedHomeListing | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="relative h-[560px] overflow-hidden rounded-2xl border border-line/80 bg-raised shadow-card xl:h-[calc(100vh-7rem)]">
      <MapContainer center={BANGKOK} zoom={11} preferCanvas className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {listings.map((home) => {
          const active = home.id === selected?.id;
          return (
            <CircleMarker
              key={home.id}
              center={[home.lat, home.lng]}
              radius={active ? 9 : 4.5}
              pathOptions={{
                color: "#fff",
                weight: active ? 2.5 : 1.5,
                fillColor: active ? "#1c1917" : "#c2410c",
                fillOpacity: active ? 1 : 0.7,
              }}
              eventHandlers={{ click: () => onSelect(home.id) }}
            />
          );
        })}
        <FlyToSelected selected={selected} />
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-3 z-[1000] rounded-lg border border-line bg-surface/95 px-3 py-2 backdrop-blur">
        <p className="text-[13px] font-semibold text-ink">แผนที่</p>
        <p className="num text-[11px] text-muted">{listings.length.toLocaleString("en-US")} ตำแหน่ง · กดหมุดเพื่อดูรายละเอียด</p>
      </div>

      {selected && <ListingDetail home={selected} onClose={onClose} />}
    </div>
  );
}

function ListingDetail({ home, onClose }: { home: UsedHomeListing; onClose: () => void }) {
  const size = sizeLabel(home);
  return (
    <div className="absolute inset-x-3 bottom-3 z-[1000] overflow-hidden rounded-xl border border-line bg-surface/97 shadow-pop backdrop-blur animate-slide-up">
      <div className="relative h-40 bg-raised sm:h-48">
        <img src={home.image} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดรายละเอียด"
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-white/30 bg-ink/50 text-white backdrop-blur transition-colors hover:bg-ink/80"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="absolute left-2 top-2 rounded-md bg-surface/95 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-label text-ink">
          {home.type}
        </span>
      </div>
      <div className="p-3.5">
        <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink">{home.title}</p>
        <p className="mt-1 truncate text-[11.5px] text-muted">
          {home.subdistrict && `${home.subdistrict} · `}
          {home.district} · {home.province}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
          <p className="num font-display text-[20px] font-semibold text-accent">฿{home.price.toLocaleString("en-US")}</p>
          {home.area && (
            <p className="num text-[11.5px] text-faint">฿{Math.round(home.price / home.area).toLocaleString("en-US")}/ตร.ม.</p>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
          {size && <ListingStat icon={Maximize} value={size} />}
          {home.bedrooms != null && <ListingStat icon={BedDouble} value={`${home.bedrooms} นอน`} />}
          {home.bathrooms != null && <ListingStat icon={Bath} value={`${home.bathrooms} น้ำ`} />}
          <ListingStat icon={Clock3} value={formatPosted(home.postedAt)} muted />
          <a
            href={home.url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-ink underline-offset-2 hover:underline"
          >
            ดูประกาศต้นทาง <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

function EmptyResults({ title, hint, onReset }: { title: string; hint: string; onReset?: () => void }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/60 p-8 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-raised text-faint">
        <Search className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <h3 className="mt-4 font-display text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] text-muted">{hint}</p>
      {onReset && (
        <button onClick={onReset} className="btn-ghost mt-4">
          ล้างตัวกรองทั้งหมด
        </button>
      )}
    </div>
  );
}
