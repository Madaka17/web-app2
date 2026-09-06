import { useMemo, useState } from "react";
import {
  Bath,
  BedDouble,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Heart,
  Home,
  Map,
  MapPin,
  Maximize,
  Navigation,
  Search,
  SlidersHorizontal,
  Sparkles,
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
  { label: "ทั้งหมด", value: 0 },
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

  const toggleFavorite = (id: string) => {
    setFavorites((current) =>
      current.includes(id) ? current.filter((favoriteId) => favoriteId !== id) : [...current, id],
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span>บ้านมือสอง</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 dark:text-white font-medium">ค้นหาบ้านจาก Data</span>
      </div>

      <section className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 sm:p-8 shadow-xl shadow-slate-900/10">
        <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Data-powered property search
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            บ้านมือสองที่น่าสนใจในกรุงเทพฯ และปริมณฑล
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
            ค้นหาทำเลที่ใช่จากรายการบ้านมือสองที่มีในระบบ พร้อมดูราคา พื้นที่ และตำแหน่งบนแผนที่ในหน้าเดียว
          </p>
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-800/60">
            <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาจากทำเล ชื่อโครงการ หรือประเภทบ้าน"
              aria-label="ค้นหาบ้านมือสอง"
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="ล้างคำค้นหา"
                className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <FilterSelect label="ทำเล" value={district} options={USED_HOME_DISTRICTS} onChange={setDistrict} />
          <FilterSelect label="ประเภท" value={type} options={USED_HOME_TYPES} onChange={setType} />
          <FilterSelect
            label="ราคา"
            value={PRICE_OPTIONS.find((option) => option.value === maxPrice)?.label ?? "ทั้งหมด"}
            options={PRICE_OPTIONS.map((option) => option.label)}
            onChange={(label) => setMaxPrice(PRICE_OPTIONS.find((option) => option.label === label)?.value ?? 0)}
          />
          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
              showFilters
                ? "border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300"
                : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            ตัวกรองเพิ่ม
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">ห้องนอนอย่างน้อย</span>
            {[0, 1, 2, 3, 4].map((beds) => (
              <button
                key={beds}
                onClick={() => setMinBeds(beds)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  minBeds === beds
                    ? "bg-brand-500 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                }`}
              >
                {beds === 0 ? "ทั้งหมด" : `${beds}+ ห้อง`}
              </button>
            ))}
            <button
              onClick={() => {
                setDistrict("ทั้งหมด");
                setType("ทั้งหมด");
                setMaxPrice(0);
                setMinBeds(0);
                setQuery("");
              }}
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600"
            >
              <X className="h-3.5 w-3.5" />
              ล้างตัวกรอง
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">บ้านมือสองที่พบ</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            แสดง {filteredHomes.length} จาก {USED_HOME_LISTINGS.length} รายการในฐานข้อมูล
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 dark:bg-green-500/10 dark:text-green-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          Data อัปเดตล่าสุดวันนี้
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <div className="space-y-4">
          {filteredHomes.length === 0 ? (
            <EmptyResults />
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

        <PropertyMap listings={filteredHomes} selectedId={selectedHome?.id} onSelect={setSelectedId} />
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
    <label className="relative flex min-w-[125px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full appearance-none bg-transparent pr-4 text-sm font-semibold text-slate-700 outline-none dark:text-slate-200"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400" />
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
  return (
    <article
      onClick={onSelect}
      className={`group cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-900 ${
        selected
          ? "border-brand-400 ring-2 ring-brand-500/15 dark:border-brand-500/50"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <div className="grid grid-cols-[136px_minmax(0,1fr)] sm:grid-cols-[190px_minmax(0,1fr)]">
        <div className="relative min-h-[185px] overflow-hidden sm:min-h-[210px]">
          <img
            src={home.image}
            alt={home.imageAlt}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
            {home.featured ? (
              <span className="rounded-md bg-amber-400 px-2 py-1 text-[10px] font-bold text-slate-900 shadow-sm">
                FEATURED
              </span>
            ) : (
              <span />
            )}
            <button
              onClick={(event) => {
                event.stopPropagation();
                onToggleFavorite();
              }}
              className={`rounded-full p-2 backdrop-blur-sm transition-colors ${
                favorite ? "bg-red-500 text-white" : "bg-slate-900/55 text-white hover:bg-slate-900/80"
              }`}
              aria-label="บันทึกรายการโปรด"
            >
              <Heart className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />
            </button>
          </div>
          <span className="absolute bottom-2.5 left-2.5 rounded-md bg-slate-950/75 px-2 py-1 text-[10px] font-semibold text-white">
            {home.type}
          </span>
        </div>

        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-slate-900 dark:text-white sm:text-lg">{home.title}</h3>
              <div className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-500" />
                <span>{home.location}</span>
              </div>
            </div>
            {home.verified && (
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500" aria-label="ยืนยันข้อมูลแล้ว" />
            )}
          </div>

          <p className="mt-3 text-xl font-bold text-brand-600 dark:text-brand-400 sm:text-2xl">
            ฿{home.price.toLocaleString("en-US")}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2 border-y border-slate-100 py-3 dark:border-slate-800">
            <ListingStat icon={Maximize} value={`${home.area} ตร.ม.`} label="พื้นที่" />
            <ListingStat icon={BedDouble} value={`${home.bedrooms}`} label="ห้องนอน" />
            <ListingStat icon={Bath} value={`${home.bathrooms}`} label="ห้องน้ำ" />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {home.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <Clock3 className="h-3 w-3" />
              {home.listedAt}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400">
              ดูรายละเอียด
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function ListingStat({ icon: Icon, value, label }: { icon: typeof Maximize; value: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      <div>
        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{value}</p>
        <p className="text-[9px] text-slate-400">{label}</p>
      </div>
    </div>
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
  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-[#dfe8df] shadow-sm dark:border-slate-800 dark:bg-slate-800">
      <div className="absolute inset-0 opacity-80" style={{ backgroundImage: "linear-gradient(18deg, transparent 0 47%, rgba(255,255,255,.7) 48% 50%, transparent 51%), linear-gradient(103deg, transparent 0 43%, rgba(255,255,255,.65) 44% 46%, transparent 47%), linear-gradient(67deg, transparent 0 70%, rgba(196,211,199,.8) 71% 74%, transparent 75%)", backgroundSize: "220px 170px, 280px 210px, 190px 260px" }} />
      <div className="absolute -bottom-20 -right-12 h-64 w-72 rotate-12 rounded-[45%] bg-cyan-200/80 dark:bg-cyan-900/40" />
      <div className="absolute left-[9%] top-[14%] h-28 w-40 rounded-[45%] bg-green-200/70 dark:bg-green-900/30" />
      <div className="absolute left-[53%] top-[34%] h-20 w-24 rounded-full bg-green-200/70 dark:bg-green-900/30" />

      <div className="relative z-10 flex items-start justify-between p-4">
        <div className="rounded-xl border border-white/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/85">
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <span className="text-sm font-bold text-slate-800 dark:text-white">แผนที่รายการบ้าน</span>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{listings.length} ตำแหน่งจากข้อมูลในระบบ</p>
        </div>
        <button className="rounded-xl border border-white/80 bg-white/90 p-2.5 text-slate-600 shadow-sm backdrop-blur transition-colors hover:text-brand-600 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-300">
          <Navigation className="h-4 w-4" />
        </button>
      </div>

      <div className="absolute left-[8%] top-[54%] z-10 -rotate-[18deg] text-[10px] font-bold tracking-widest text-slate-500/70">BANGKOK</div>
      <div className="absolute left-[62%] top-[78%] z-10 rotate-12 text-[10px] font-bold tracking-widest text-slate-500/70">SAMUT PRAKAN</div>
      <div className="absolute left-[12%] top-[26%] z-10 -rotate-12 text-[10px] font-bold tracking-widest text-slate-500/70">NONTHABURI</div>

      {listings.map((home) => {
        const isSelected = home.id === selectedId;
        return (
          <button
            key={home.id}
            onClick={() => onSelect(home.id)}
            className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${isSelected ? "scale-125" : "hover:scale-110"}`}
            style={{ top: home.position.top, left: home.position.left }}
            aria-label={`เลือก ${home.title}`}
          >
            <span className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow-lg ${isSelected ? "bg-brand-600" : "bg-red-500"}`}>
              <Home className="h-4 w-4 text-white" />
              {isSelected && <span className="absolute -inset-1.5 -z-10 animate-ping rounded-full bg-brand-400/40" />}
            </span>
            {isSelected && (
              <span className="absolute bottom-11 left-1/2 w-44 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-2 text-left text-white shadow-xl">
                <span className="block truncate text-[10px] font-bold">{home.title}</span>
                <span className="mt-0.5 block text-xs font-bold text-brand-300">฿{home.price.toLocaleString("en-US")}</span>
              </span>
            )}
          </button>
        );
      })}

      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-lg border border-white/80 bg-white/90 px-2.5 py-2 text-[10px] font-semibold text-slate-600 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-300">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        บ้านมือสองใน Data
      </div>
    </div>
  );
}

function EmptyResults() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
        <Search className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">ไม่พบรายการที่ตรงกับตัวกรอง</h3>
      <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">ลองเลือกทำเล ประเภทบ้าน หรือช่วงราคาใหม่อีกครั้ง</p>
    </div>
  );
}
