import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, MapPin, Search } from 'lucide-react';
import { BRAND, useLang, usePageMeta } from '../i18n.jsx';
import Header from '../components/Header.jsx';
import Footer, { SeoBlock } from '../components/Footer.jsx';
import { listingArt } from '../art.js';
import { LISTINGS, PROVINCES } from '../data.js';

const PAGE_SIZE = 24;

function Dropdown({ label, value, options, onChange, boxClass, buttonClass = '' }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (box.current && !box.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const current = options.find((o) => o.value === value);
  return (
    <div className={`relative ${boxClass}`} ref={box}>
      <button type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`flex h-10 w-full items-center gap-2 rounded-pill border border-line bg-surface pl-4 pr-3 text-sm text-ink-primary outline-none transition-colors hover:border-primary/60 ${buttonClass}`}>
        <span className="truncate">{current?.label}</span>
        <ChevronDown size={16} className="ml-auto shrink-0 text-ink-muted" />
      </button>
      {open && (
        <ul role="listbox" aria-label={label} className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-lg">
          {options.map((option) => (
            <li key={option.value}>
              <button type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }} className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm ${option.value === value ? 'bg-primary/10 text-primary' : 'text-ink-primary hover:bg-surface-2'}`}>
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Pill({ children, className, style }) {
  return <span className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-bold ${className}`} style={style}>{children}</span>;
}

function ListingCard({ item }) {
  const { t } = useLang();
  const href = `/map?marker=${item.id}&kind=parcel&lat=${item.lat.toFixed(6)}&lng=${item.lng.toFixed(6)}`;
  return (
    <Link className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-soft transition-all hover:-translate-y-1 hover:shadow-md" to={href}>
      <div className="relative">
        <img src={listingArt(item.seed, item.wash)} alt={item.code} loading="lazy" className="aspect-[4/3] w-full object-cover" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Pill className="bg-primary text-white shadow-sm ring-1 ring-black/5">{t('isNew')}</Pill>
        </div>
        {item.mode === 'land' && (
          <div className="absolute right-3 top-3">
            <Pill className="bg-primary text-white shadow-sm ring-1 ring-black/5">{t('land')}</Pill>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-base font-extrabold text-ink-primary">{item.code}</h3>
        <div className="mt-1 flex items-center gap-1 text-xs text-ink-muted"><MapPin size={12} /> {item.province} · {item.district}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.status === 'pending' ? (
            <>
              <Pill className="ring-1 ring-black/5" style={{ backgroundColor: 'rgba(255, 234, 0, 0.15)', color: 'rgb(140, 129, 0)' }}>{t('agent')}</Pill>
              <Pill className="bg-amber-50 text-amber-700 ring-1 ring-amber-600/20">{t('pendingReview')}</Pill>
            </>
          ) : (
            <>
              <Pill className="bg-[#f0f9ff] text-sky-700 ring-1 ring-sky-600/20">{item.type}</Pill>
              <Pill className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20">{t('approved')}</Pill>
            </>
          )}
        </div>
        <div className="mt-auto pt-3">
          {item.price !== null && <div className="text-xl font-extrabold text-primary sm:text-2xl">฿{item.price.toLocaleString('en-US')}</div>}
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-ink-secondary">
            <span>{item.size ?? ''}</span>
            <span className="text-ink-muted">{item.days} {t('daysAgo')}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function pageList(page, total) {
  const list = new Set([1, total, page, page - 1, page + 1].filter((n) => n >= 1 && n <= total));
  if (page <= 2 && total >= 2) list.add(2);
  const sorted = [...list].sort((a, b) => a - b);
  const output = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) output.push(`gap-${n}`);
    output.push(n);
  });
  return output;
}

export default function NewLandPage() {
  const { t } = useLang();
  usePageMeta(`New Listings | ${BRAND}`, t('newLead'));
  const [query, setQuery] = useState('');
  const [province, setProvince] = useState('all');
  const [mode, setMode] = useState('all');
  const [type, setType] = useState('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [page, setPage] = useState(1);
  const [goTo, setGoTo] = useState('');
  const topRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = Number(minPrice) || 0;
    const max = Number(maxPrice) || Infinity;
    return LISTINGS.filter((item) => {
      if (q && !item.code.toLowerCase().includes(q) && !item.district.includes(query.trim())) return false;
      if (province !== 'all' && item.province !== province) return false;
      if (mode !== 'all' && item.mode !== mode) return false;
      if (type !== 'all' && item.type !== type) return false;
      if (minPrice || maxPrice) {
        if (item.price === null || item.price < min || item.price > max) return false;
      }
      return true;
    });
  }, [query, province, mode, type, minPrice, maxPrice]);

  useEffect(() => setPage(1), [query, province, mode, type, minPrice, maxPrice]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const shown = filtered.slice(start, start + PAGE_SIZE);
  const change = (next) => {
    setPage(Math.min(pages, Math.max(1, next)));
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const goToNumber = Number(goTo);
  const canGo = goTo !== '' && Number.isInteger(goToNumber) && goToNumber >= 1 && goToNumber <= pages;

  return (
    <div className="min-h-full bg-surface-soft">
      <Header tone="red" />
      <main className="min-h-[calc(100vh-var(--nav-h))] pt-[var(--nav-h)]">
        <SeoBlock title={`New Listings | ${BRAND}`} lead={t('newLead')} heading={<div><h2>สำรวจประกาศที่ดิน</h2></div>} />
        <div className="mx-auto w-full max-w-container px-4 py-8 sm:px-6 sm:py-10">
          <header className="mb-6">
            <h1 className="font-display text-2xl font-bold text-primary sm:text-3xl">{t('newTitle')}</h1>
            <p className="mt-1 text-sm text-ink-secondary sm:text-base">{t('newLead')}</p>
          </header>
          <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-soft sm:p-4 md:flex-row md:flex-wrap md:items-center">
            <div className="relative w-full flex-1 md:min-w-[200px]">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input placeholder={t('searchProject')} value={query} onChange={(e) => setQuery(e.target.value)} className="h-10 w-full rounded-pill border border-line bg-surface pl-9 pr-3 text-sm outline-none focus:border-primary" />
            </div>
            <Dropdown label={t('allProvinces')} value={province} onChange={setProvince} boxClass="w-full md:w-auto md:min-w-[10rem]" options={[{ value: 'all', label: t('allProvinces') }, ...PROVINCES.map((p) => ({ value: p, label: p }))]} />
            <Dropdown label="Filter by mode" value={mode} onChange={setMode} boxClass="w-full shrink-0 sm:w-auto sm:min-w-[12.5rem] md:min-w-[14rem]" buttonClass="font-semibold" options={[{ value: 'all', label: t('allModes') }, { value: 'land', label: t('land') }, { value: 'future', label: t('future') }]} />
            <Dropdown label={t('allTypes')} value={type} onChange={setType} boxClass="w-full md:w-auto md:min-w-[10rem]" options={[{ value: 'all', label: t('allTypes') }, { value: 'Agent', label: t('agent') }, { value: 'Condo', label: 'Condo' }, { value: 'Hotel', label: 'Hotel' }]} />
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
              <input inputMode="numeric" placeholder={t('minPrice')} value={minPrice} onChange={(e) => setMinPrice(e.target.value.replace(/\D/g, ''))} className="h-10 w-full rounded-pill border border-line bg-surface px-3 text-sm outline-none focus:border-primary sm:w-28" />
              <input inputMode="numeric" placeholder={t('maxPrice')} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ''))} className="h-10 w-full rounded-pill border border-line bg-surface px-3 text-sm outline-none focus:border-primary sm:w-28" />
            </div>
          </div>
          <div className="scroll-mt-24" ref={topRef}>
            <p className="mb-4 text-sm text-ink-secondary">
              {filtered.length === 0 ? `0 ${t('listings')}` : `${start + 1}–${start + shown.length} ${t('ofListings')} ${filtered.length.toLocaleString('en-US')} ${t('listings')}`}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((item) => <ListingCard key={item.id} item={item} />)}
          </div>
          <nav aria-label="pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <button type="button" disabled={page === 1} onClick={() => change(page - 1)} className="inline-flex h-10 min-w-10 items-center justify-center rounded-pill px-3 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-2 disabled:opacity-40" aria-label="previous"><ChevronLeft size={16} /></button>
            {pageList(page, pages).map((entry) => (typeof entry === 'string'
              ? <span key={entry} className="px-1 text-ink-muted">…</span>
              : (
                <button key={entry} type="button" aria-current={entry === page ? 'page' : undefined} onClick={() => change(entry)} className={`inline-flex h-10 min-w-10 items-center justify-center rounded-pill px-3 text-sm font-semibold transition-colors ${entry === page ? 'bg-primary text-white' : 'text-ink-secondary hover:bg-surface-2'}`}>{entry}</button>
              )))}
            <button type="button" disabled={page === pages} onClick={() => change(page + 1)} className="inline-flex h-10 min-w-10 items-center justify-center rounded-pill px-3 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-2 disabled:opacity-40" aria-label="next"><ChevronRight size={16} /></button>
            <div className="ml-2 flex items-center gap-1.5">
              <span className="text-sm text-ink-muted">{t('goToPage')}</span>
              <input inputMode="numeric" placeholder="1" aria-label={t('goToPage')} value={goTo} onChange={(e) => setGoTo(e.target.value.replace(/\D/g, ''))} className="h-10 w-16 rounded-pill border border-line bg-surface px-3 text-center text-sm outline-none focus:border-primary" />
              <button type="button" disabled={!canGo} onClick={() => { change(goToNumber); setGoTo(''); }} className="inline-flex h-10 min-w-10 items-center justify-center rounded-pill bg-surface-2 px-3 text-sm font-semibold text-ink-secondary transition-colors hover:bg-line disabled:opacity-40">{t('ok')}</button>
            </div>
          </nav>
        </div>
        <Footer />
      </main>
    </div>
  );
}
