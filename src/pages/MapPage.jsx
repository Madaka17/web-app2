import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Banknote, Building2, Calculator, ChevronDown, ChevronUp, CircleHelp, Coins, Filter, House, Layers, ListChecks, Lock, LocateFixed,
  LogOut, MapPin, Minus, Plus, ReceiptText, Search, Tag, TrendingUp, X,
} from 'lucide-react';
import { BRAND, useLang, usePageMeta } from '../i18n.jsx';
import Header from '../components/Header.jsx';
import { SeoBlock } from '../components/Footer.jsx';
import { useAlerts } from '../components/Alerts.jsx';
import MapCanvas from '../components/MapCanvas.jsx';
import { FilterPanel, LayerPanel, legendLabelKey } from '../components/MapPanels.jsx';
import PricePanel from '../components/PricePanel.jsx';
import { areaArt, modeArt, modeArtWide } from '../art.js';
import { AREAS, PLACE_LABELS } from '../data.js';
import { EMPTY_FILTER, LISTING_LEGEND, PROJECT_LEGEND, applyFilter, findPoint, loadListings, loadProjects, summarize } from '../lib/mapData';

const CARD_BASE = 'group relative flex min-h-[9.5rem] flex-1 flex-col overflow-hidden rounded-2xl bg-cover bg-center text-center shadow-[0_24px_64px_rgba(0,0,0,0.45)] transition-transform duration-300 active:scale-[0.995] anim-up sm:min-h-0 sm:rounded-3xl';

function ModeCard({ kind, icon: Icon, title, count, unit, locked, delay, onClick, comingSoon }) {
  return (
    <button
      type="button"
      aria-disabled={!!locked}
      onClick={onClick}
      className={`${CARD_BASE} [background-image:var(--bg-wide)] md:[background-image:var(--bg-tall)] ${locked ? 'cursor-not-allowed' : 'hover:brightness-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white'}`}
      style={{ animationDelay: `${delay}ms`, '--bg-tall': `url("${modeArt(kind)}")`, '--bg-wide': `url("${modeArtWide(kind)}")` }}
    >
      <div className={`absolute inset-0 bg-gradient-to-t ${locked ? 'from-black via-black/70 to-black/20' : 'from-black via-black/55 to-transparent group-hover:via-black/45'}`} aria-hidden="true" />
      {locked && (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm sm:text-xs">
          <Lock size={12} />
          {comingSoon}
        </div>
      )}
      <div className="relative z-10 flex h-full w-full flex-col items-center px-4 py-5 sm:px-5 sm:py-6 md:px-6 md:py-7 lg:px-7">
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className={`mb-3 inline-flex size-11 items-center justify-center rounded-xl text-white shadow-lg backdrop-blur-md sm:mb-4 sm:size-14 sm:rounded-2xl ${locked ? 'bg-white/15' : 'bg-black/40 group-hover:bg-black/50'}`}>
            <Icon size={22} strokeWidth={2.25} className="sm:h-7 sm:w-7" />
          </div>
          <h3 className="font-display text-xl font-extrabold leading-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] sm:text-2xl md:text-[1.75rem] lg:text-3xl">{title}</h3>
        </div>
        {count && (
          <div className="mt-auto flex w-full justify-center px-2 pb-3 pt-3 sm:px-3 sm:pb-5 sm:pt-6 md:pb-8 md:pt-10">
            <span className="inline-flex min-h-8 max-w-[90%] items-baseline justify-center gap-1.5 rounded-full border border-white/70 bg-black/50 px-3.5 py-1.5 text-white shadow-[0_6px_20px_rgba(0,0,0,0.35)] backdrop-blur-md sm:min-h-10 sm:gap-2 sm:border-2 sm:px-5 sm:py-2 md:min-h-14 md:gap-2.5 md:px-8 md:py-3">
              <span className="font-display text-lg font-extrabold leading-none tabular-nums tracking-tight drop-shadow-md sm:text-2xl md:text-3xl lg:text-4xl">{count}</span>
              <span className="pb-px text-[11px] font-bold sm:pb-0.5 sm:text-sm md:text-base lg:text-lg">{unit}</span>
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

function StatCard({ icon: Icon, bigIcon: BigIcon, title, value, unit, tint, iconBg, iconColor, minW }) {
  return (
    <div className={`relative flex min-h-[4.5rem] min-w-0 flex-1 basis-0 overflow-hidden rounded-lg border border-[#e9e9e9] bg-white px-1.5 py-1.5 text-[#090909] shadow-sm md:min-h-[4.75rem] md:flex-[1_1_0] md:rounded-lg md:px-2 md:py-2 xl:min-h-[108px] xl:rounded-xl xl:px-3.5 xl:py-3.5 xl:shadow-md ${minW}`}>
      <div className="pointer-events-none absolute -bottom-1 -right-1 hidden xl:block" style={{ color: tint }}>
        <BigIcon className="h-28 w-28" strokeWidth={1.1} />
      </div>
      <div className="relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-0 text-center md:flex-row md:items-center md:justify-start md:gap-1.5 md:text-left xl:items-stretch xl:gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md md:h-8 md:w-8 xl:h-11 xl:w-11 xl:rounded-lg" style={{ background: iconBg, color: iconColor }}>
          <Icon className="h-3 w-3 md:h-3.5 md:w-3.5 xl:h-5 xl:w-5" />
        </div>
        <div className="mt-0.5 flex w-full min-w-0 flex-col items-center gap-0 pr-0.5 leading-none md:mt-0 md:flex-1 md:items-start md:justify-center">
          <p className="w-full truncate text-[10px] font-medium leading-tight text-[#777] md:text-[13px] xl:line-clamp-2 xl:text-[16px]">{title}</p>
          <p className="w-full truncate font-display text-[15px] font-bold leading-none tracking-tight text-[#090909] md:text-lg xl:text-[26px]">{value}</p>
          <p className="w-full truncate text-[10px] font-medium leading-tight text-[#777] md:text-[13px] xl:text-[16px]">{unit}</p>
        </div>
      </div>
    </div>
  );
}

function RoundButton({ label, onClick, children, active, dot }) {
  return (
    <div className="group relative">
      <button type="button" aria-label={label} aria-pressed={!!active} onClick={onClick} className={`relative flex h-10 w-10 items-center justify-center rounded-full shadow-md ring-1 transition-all ${active ? 'bg-[#DC2626] text-white ring-[#DC2626]' : 'bg-white text-ink-secondary ring-black/[0.06] hover:text-ink-primary hover:shadow-lg'}`}>
        {children}
        {dot && <span className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : 'bg-primary'}`} />}
      </button>
      <span role="tooltip" className="pointer-events-none absolute right-full top-1/2 z-[1001] mr-2.5 flex -translate-y-1/2 translate-x-1 items-center opacity-0 transition-all duration-200 ease-out [@media(hover:hover)]:group-hover:translate-x-0 [@media(hover:hover)]:group-hover:opacity-100">
        <span className="relative whitespace-nowrap rounded-lg border border-[#E0E0E0] bg-white px-3 py-1.5 text-[11px] font-bold tracking-wide text-ink-primary shadow-[0_8px_24px_rgba(26,26,26,0.12)] ring-1 ring-black/[0.03]">{label}</span>
      </span>
    </div>
  );
}

const ROUND_PLAIN = 'flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink-secondary shadow-md ring-1 ring-black/[0.06] transition-all duration-200 hover:text-blue-600 hover:shadow-lg active:scale-90 active:bg-blue-50';

const TOUR_STEPS = ['t1', 't2', 't3', 't4'];

function Tour({ step, setStep, onClose }) {
  const { t } = useLang();
  const descriptions = { t2: 'd2' };
  const description = descriptions[TOUR_STEPS[step]];
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/30 p-4">
      <div role="dialog" aria-label={t(TOUR_STEPS[step])} className="relative w-[420px] max-w-[calc(100vw-2rem)] rounded-[10px] bg-white p-6 shadow-[0_1px_10px_#0006]" style={{ fontFamily: '"Helvetica Neue", Arial, Helvetica, sans-serif', color: '#2d2d2d' }}>
        <button type="button" aria-label="Close" onClick={onClose} className="absolute right-4 top-4 text-[#2d2d2d]"><X size={14} /></button>
        <h3 className="text-center text-[28px] font-extrabold leading-tight tracking-tight" style={{ color: '#2d2d2d' }}>{t(TOUR_STEPS[step])}</h3>
        {description && <p className="mt-2 text-center text-xl leading-snug">{t(description)}</p>}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-base text-[#555]">{step + 1} / {TOUR_STEPS.length}</span>
          <div className="flex gap-1">
            <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className="min-h-11 rounded border border-[#ccc] bg-white px-4 text-base disabled:opacity-40">{t('back')}</button>
            <button type="button" onClick={() => (step === TOUR_STEPS.length - 1 ? onClose() : setStep(step + 1))} className="min-h-11 rounded border border-[#ccc] bg-white px-4 text-base">{step === TOUR_STEPS.length - 1 ? t('gotIt') : t('next')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MapPage() {
  const { t } = useLang();
  const { alert, setAlert, signIn } = useAlerts();
  const [params] = useSearchParams();
  const canvas = useRef(null);
  const seenNotice = useRef(false);
  const seenTour = useRef(false);

  const linked = params.get('lat') && params.get('lng') ? { lat: Number(params.get('lat')), lng: Number(params.get('lng')) } : null;
  const [mode, setMode] = useState(linked ? 'land' : null);
  const [area, setArea] = useState(null);
  const [areaOpen, setAreaOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(true);
  const [legendOpen, setLegendOpen] = useState(true);
  const [panel, setPanel] = useState(null);
  const [baseMap, setBaseMap] = useState('hybrid');
  const [measuring, setMeasuring] = useState(false);
  const [cityPlan, setCityPlan] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [query, setQuery] = useState('');
  const [tourStep, setTourStep] = useState(null);
  const [listings, setListings] = useState(null);
  const [projects, setProjects] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [target, setTarget] = useState(null);
  // The price panel docks beside the map on desktop and opens as a bottom sheet below lg.
  const [panelOpen, setPanelOpen] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(min-width:1024px)').matches,
  );

  usePageMeta(BRAND, 'สำรวจประกาศซื้อขายและขายฝากที่ดินบนแผนที่ (ตัวอย่าง)');

  // Both data files load once. The map keeps working without them; it just shows no pins.
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([loadListings(controller.signal), loadProjects(controller.signal)])
      .then(([listingRows, projectRows]) => {
        setListings(listingRows);
        setProjects(projectRows);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  const openTour = () => {
    seenTour.current = true;
    setTourStep(0);
  };

  const pickMode = (next) => {
    if (next === 'lease') {
      setAlert({ type: 'dev' });
      return;
    }
    setMode(next);
    setArea(null);
    setAreaOpen(next === 'future');
    setPanel(null);
    setFilter(EMPTY_FILTER);
    setTarget(null);
    if (!seenNotice.current) {
      seenNotice.current = true;
      if (!alert) {
        setAlert({ type: 'edu', after: next === 'land' && !seenTour.current ? openTour : null });
      }
    }
  };

  const dataset = mode === 'future' ? projects : listings;
  // Pins for the current mode after filtering. Empty until a mode is chosen, so none show behind the picker.
  const points = useMemo(() => (mode ? applyFilter(dataset ?? [], filter) : []), [mode, dataset, filter]);
  const summary = useMemo(() => summarize(points), [points]);

  const onPick = (lat, lng) => {
    setTarget({ lat, lng, source: 'map' });
    setPanelOpen(true);
  };
  const onSelectPoint = (p) => {
    setTarget({ lat: p.lat, lng: p.lng, source: p.kind, point: p });
    setPanelOpen(true);
  };

  const chooseArea = (item) => {
    setArea(item.key);
    setAreaOpen(false);
    canvas.current?.flyTo(item.center, item.zoom);
  };

  const closeArea = () => setAreaOpen(false);

  // Close the choose-area layer with Esc. Alerts on top are left alone.
  useEffect(() => {
    if (!areaOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && !alert) closeArea();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [areaOpen, alert]);

  const runSearch = (event) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    const place = PLACE_LABELS.find((p) => p.text.toLowerCase().includes(q.toLowerCase()) || p.sub.includes(q));
    if (place) {
      canvas.current?.flyTo([place.lat, place.lng], 13);
      return;
    }
    const found = findPoint(points, q);
    if (found) canvas.current?.flyTo([found.lat, found.lng], 15);
  };

  const legendItems = mode === 'future' ? PROJECT_LEGEND : LISTING_LEGEND;
  const chosen = mode === 'future' || mode === 'land';
  const ready = chosen && dataset !== null;
  const countOf = (rows) => (rows ? rows.length.toLocaleString('en-US') : '—');
  const fmtCount = (n) => (ready ? n.toLocaleString('en-US') : '—');
  const fmtMillions = (baht) => (ready ? (baht / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 }) : '—');
  const showModePicker = !chosen;
  const showAreaPicker = mode === 'future' && areaOpen;

  const stats = mode === 'future'
    ? [
      { icon: ReceiptText, bigIcon: MapPin, title: t('totalProjects'), value: fmtCount(summary.count), unit: t('projects'), tint: '#df201c14', iconBg: '#df201c1a', iconColor: '#df201c', minW: 'xl:min-w-[160px]' },
      { icon: House, bigIcon: House, title: t('villages'), value: fmtCount(summary.villages), unit: t('projects'), tint: '#ef6c0014', iconBg: 'transparent', iconColor: '#e65100', minW: 'xl:min-w-[190px]' },
      { icon: Building2, bigIcon: Building2, title: t('condos'), value: fmtCount(summary.condos), unit: t('projects'), tint: '#2e7d3214', iconBg: 'transparent', iconColor: '#2e7d32', minW: 'xl:min-w-[160px]' },
    ]
    : [
      { icon: ListChecks, bigIcon: MapPin, title: t('totalListings'), value: fmtCount(summary.count), unit: t('listings'), tint: '#df201c14', iconBg: '#df201c1a', iconColor: '#df201c', minW: 'xl:min-w-[160px]' },
      { icon: Banknote, bigIcon: Coins, title: t('totalValue'), value: fmtMillions(summary.totalPrice), unit: t('mthb'), tint: '#ef6c0014', iconBg: 'transparent', iconColor: '#e65100', minW: 'xl:min-w-[190px]' },
      { icon: TrendingUp, bigIcon: Coins, title: t('medianPrice'), value: fmtMillions(summary.medianPrice), unit: t('mthb'), tint: '#2e7d3214', iconBg: 'transparent', iconColor: '#2e7d32', minW: 'xl:min-w-[160px]' },
    ];

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden overscroll-none bg-surface-soft">
      <Header tone="map" mode={mode} onSelectMode={pickMode} />
      <div className="h-[var(--nav-h)] shrink-0" aria-hidden="true" />
      <main className="relative flex min-h-0 flex-1 overflow-hidden overscroll-none">
        {chosen && panelOpen && (
          <aside aria-label={t('priceEstimate')} className="flex min-h-0 flex-col bg-white max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-[1500] max-lg:max-h-[62dvh] max-lg:rounded-t-xl max-lg:shadow-lg lg:relative lg:w-[380px] lg:shrink-0 lg:border-r lg:border-line">
            <PricePanel target={target} onClearTarget={() => setTarget(null)} onClose={() => setPanelOpen(false)} />
          </aside>
        )}
        <div className="relative h-full min-w-0 flex-1">
          <SeoBlock
            title={BRAND}
            lead="สำรวจประกาศซื้อขาย ที่ดินขายฝาก และโครงการอนาคต บนแผนที่เชิงโต้ตอบทั่วประเทศไทย"
            heading={(
              <>
                <div><h2>ซื้อขายที่ดินบนแผนที่</h2><p>ค้นหาประกาศซื้อขายที่ดินตามตำแหน่ง พื้นที่ และประเภททรัพย์</p></div>
                <div><h2>ขายฝากและโครงการอนาคต</h2><p>ดูประกาศขายฝากและโครงการ ที่เกี่ยวข้องกับพื้นที่ที่สนใจ</p></div>
              </>
            )}
          />
          <div className="relative h-full w-full" data-tour="listing-map-stage">
            <MapCanvas ref={canvas} mode={mode} points={points} baseMap={baseMap} cityPlan={cityPlan} measuring={measuring} focus={linked} target={target} onPick={onPick} onSelectPoint={onSelectPoint} />

            <div className="pointer-events-none absolute inset-x-0 top-3 z-[1200] flex flex-col items-center gap-2 px-3 max-lg:top-2 sm:top-4 md:max-lg:top-3">
              <div className="pointer-events-auto flex w-full max-w-[min(96vw,640px)] items-center justify-center gap-2 md:max-lg:max-w-[min(calc(100vw-1.5rem),34rem)] md:max-lg:gap-1.5 lg:max-w-[min(calc(100vw-12rem),36rem)] lg:gap-1.5 xl:max-w-[min(96vw,640px)] xl:gap-2">
                <div className="min-w-0 flex-1">
                  <form onSubmit={runSearch} className="pointer-events-auto relative flex w-full items-center gap-2 rounded-full border border-line bg-white/95 px-3 py-1.5 shadow-md backdrop-blur">
                    <Search size={18} className="shrink-0 text-ink-muted" />
                    <input type="search" placeholder={t('searchMap')} value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 min-w-0 flex-1 bg-transparent text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none" />
                    <button type="submit" disabled={!query.trim()} aria-label={t('search')} className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-primary px-3 text-xs font-bold text-white transition-colors hover:bg-primary-dark disabled:opacity-50 sm:px-4 sm:text-sm">
                      <Search size={18} className="sm:hidden" />
                      <span className="hidden sm:inline">{t('search')}</span>
                    </button>
                  </form>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 lg:gap-1">
                  <div className="relative shrink-0">
                    <button type="button" aria-label={t('createAsset')} aria-pressed={selecting} onClick={() => setSelecting((v) => !v)} className="relative flex h-12 w-[190px] shrink-0 items-center justify-center gap-1.5 rounded-full border-4 border-transparent bg-red-600 px-2.5 text-white shadow-md backdrop-blur transition-all max-md:h-12 max-md:w-[10.5rem] max-md:gap-1 max-md:border-[3px] max-md:px-2 sm:gap-2 sm:px-3 md:max-lg:h-12 md:max-lg:w-[10.75rem] md:max-lg:gap-1 md:max-lg:border-[3px] md:max-lg:px-2 lg:h-12 lg:w-[11.25rem] lg:gap-1 lg:border-[3px] lg:px-2 xl:h-12 xl:w-[190px] xl:gap-1.5 xl:border-4 xl:px-2.5">
                      <Plus strokeWidth={2.75} className="shrink-0 max-md:h-6 max-md:w-6 md:max-lg:h-6 md:max-lg:w-6 lg:h-5 lg:w-5 xl:h-[26px] xl:w-[26px]" aria-hidden="true" />
                      <span className="whitespace-normal text-center text-[14px] font-bold leading-tight max-md:text-[14px] sm:whitespace-nowrap sm:text-[15px] md:max-lg:text-[14px] lg:text-[14px] xl:text-[15px]">{t('createAsset')}</span>
                    </button>
                  </div>
                  {chosen && (
                    <button type="button" onClick={openTour} data-tour="listing-tour-help" aria-label={t('usageGuide')} title={t('usageGuide')} className="flex h-auto min-h-10 shrink-0 items-center justify-center rounded-full border border-[#e6d200]/80 bg-[#FFEA00] px-3 py-2 text-[11px] font-bold leading-tight text-neutral-900 shadow-md transition-colors hover:bg-[#f5dc00] max-sm:h-10 max-sm:w-10 max-sm:px-0 xl:min-h-10 xl:px-3.5 xl:text-xs">
                      <CircleHelp size={20} className="sm:hidden" />
                      <span className="hidden sm:inline">{t('usageGuide')}</span>
                    </button>
                  )}
                </div>
              </div>
              {loadError && (
                <p role="alert" className="pointer-events-auto rounded-lg border border-[#DC2626]/30 bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#DC2626] shadow-md">{t('dataLoadError')}</p>
              )}
              {(selecting || tourStep !== null) && (
                <div className="pointer-events-auto flex w-full max-w-[520px] items-center gap-2 rounded-xl border border-line bg-white/95 p-3 shadow-md">
                  <button type="button" onClick={() => setSelecting(false)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink-primary hover:bg-surface-2">
                    <LogOut size={14} /> {t('exitSelect')}
                  </button>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-lg border border-line px-3 py-2 text-xs text-ink-muted"><Layers size={14} className="shrink-0" /> <span className="truncate">{t('selectHint')}</span></span>
                </div>
              )}
            </div>

            <div className="pointer-events-auto absolute right-3 top-[4.25rem] flex flex-col items-end gap-2 sm:right-4 sm:top-4" style={{ zIndex: 1000 }}>
              <div className="relative" style={{ zIndex: 1000 }}>
                <div className="flex flex-col gap-2">
                  <RoundButton label={t('layer')} dot active={panel === 'layer'} onClick={() => setPanel(panel === 'layer' ? null : 'layer')}><Layers size={16} /></RoundButton>
                  {mode === 'future' && <RoundButton label={t('chooseArea')} active={areaOpen} onClick={() => setAreaOpen(true)}><MapPin size={18} /></RoundButton>}
                  {chosen && <RoundButton label={t('filters')} active={panel === 'filters'} onClick={() => setPanel(panel === 'filters' ? null : 'filters')}><Filter size={16} /></RoundButton>}
                  {chosen && <RoundButton label={t('priceEstimate')} active={panelOpen} onClick={() => setPanelOpen((v) => !v)}><TrendingUp size={16} /></RoundButton>}
                  {chosen && <RoundButton label={t('sumPrices')} onClick={signIn}><Calculator size={16} /></RoundButton>}
                </div>
                {panel === 'layer' && (
                  <LayerPanel baseMap={baseMap} setBaseMap={setBaseMap} measuring={measuring} setMeasuring={setMeasuring} cityPlan={cityPlan} setCityPlan={setCityPlan} onClose={() => setPanel(null)} />
                )}
                {panel === 'filters' && <FilterPanel mode={mode} value={filter} onClose={() => setPanel(null)} onApply={(next) => { setFilter(next); setPanel(null); }} />}
              </div>
            </div>

            <div id="map-stats-bar" className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:bottom-4 sm:pb-0 lg:pr-[11.25rem]" style={{ zIndex: 1000 }}>
              <div className="pointer-events-auto flex w-full min-w-0 max-w-[calc(100vw-0.75rem)] flex-col items-stretch md:max-w-full md:items-stretch xl:max-w-[min(100vw-0.5rem,960px)] xl:items-end" style={{ zIndex: 1000 }}>
                <button type="button" aria-expanded={statsOpen} aria-label={statsOpen ? 'Hide stats' : 'Show stats'} onClick={() => setStatsOpen((v) => !v)} className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center self-center rounded-full border border-[#e9e9e9] bg-white p-0 text-[11px] font-medium text-[#090909] shadow-sm transition-colors duration-200 hover:bg-[#fafafa] md:mb-0.5 md:h-8 md:w-8 xl:mb-0 xl:h-9 xl:w-9 xl:self-end">
                  {statsOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronUp size={16} aria-hidden="true" />}
                </button>
                <div className={`w-full min-w-0 overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out ${statsOpen ? 'max-h-[12rem] opacity-100 md:max-h-[10rem] xl:max-h-[14rem]' : 'max-h-0 opacity-0'}`} aria-hidden={!statsOpen}>
                  <div className="flex w-full min-w-0 flex-nowrap items-stretch gap-1.5 md:gap-1.5 md:overflow-x-auto md:overscroll-x-contain md:pb-0.5 xl:gap-2.5">
                    {stats.map((item) => <StatCard key={item.title} {...item} />)}
                  </div>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-[calc(8.75rem+env(safe-area-inset-bottom,0px))] right-3 flex flex-col items-end gap-2 transition-[bottom] duration-300 ease-out sm:right-4 md:bottom-[calc(7.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-6" style={{ zIndex: 1000 }}>
              <div className="pointer-events-auto flex flex-col items-end gap-2">
                <button type="button" aria-label="My location" onClick={() => canvas.current?.locate()} className={ROUND_PLAIN}><LocateFixed size={18} className="text-blue-600" /></button>
                <div role="button" tabIndex={0} onClick={() => setAlert({ type: 'dev' })} onKeyDown={(e) => { if (e.key === 'Enter') setAlert({ type: 'dev' }); }} className="group relative flex h-10 w-10 cursor-grab select-none items-center justify-center rounded-full bg-white shadow-md ring-1 ring-black/[0.06] transition-all hover:scale-105 hover:bg-surface-soft" title="Street view" aria-label="Street view">
                  <svg width="20" height="20" viewBox="0 0 28 28" className="pointer-events-none"><circle cx="14" cy="7" r="3" fill="#FBBC04" /><path d="M14 11v8m0 0-4 6m4-6 4 6M8 14h12" stroke="#FBBC04" strokeWidth="2.5" strokeLinecap="round" fill="none" /></svg>
                </div>
                <button type="button" aria-label="Zoom in" onClick={() => canvas.current?.zoomIn()} className={ROUND_PLAIN}><Plus size={17} /></button>
                <button type="button" aria-label="Zoom out" onClick={() => canvas.current?.zoomOut()} className={ROUND_PLAIN}><Minus size={17} /></button>
              </div>
              <div role="note" aria-label={t('legend')} className="pointer-events-auto w-[148px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg max-md:hidden xl:w-[160px]">
                <button type="button" aria-expanded={legendOpen} aria-label="Collapse map legend" onClick={() => setLegendOpen((v) => !v)} className="flex w-full items-center justify-between gap-1 bg-[#DC2626] px-3 py-1.5 text-left transition-colors hover:bg-[#c81e1e] xl:px-4 xl:py-2">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/90 xl:text-[10px]">{t('legend')}</p>
                  {legendOpen ? <ChevronUp size={14} className="text-white" /> : <ChevronDown size={14} className="text-white" />}
                </button>
                {legendOpen && (
                  <div className="max-h-[min(52vh,20rem)] overflow-y-auto overscroll-contain px-3 pb-2 pt-2 xl:px-4 xl:pb-3 xl:pt-3">
                    <ul className="space-y-0">
                      {legendItems.map(([key, color]) => (
                        <li key={key} className="flex items-center gap-1.5 py-0.5">
                          <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-white shadow" style={{ background: color }} aria-hidden="true" />
                          <span className="text-[11px] leading-snug text-gray-800">{t(legendLabelKey(key))}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {showModePicker && (
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5 md:p-8" style={{ zIndex: 1200 }}>
                <div className="absolute inset-0 bg-black/45 backdrop-blur-md" />
                <div className="anim-fade relative z-10 flex w-full max-w-[min(100%,72rem)] flex-col gap-3 sm:gap-4">
                  <div className="px-1 text-center sm:px-2">
                    <h2 className="font-display text-lg font-bold text-white drop-shadow-md sm:text-2xl md:text-3xl">{t('selectMode')}</h2>
                  </div>
                  <div className="flex max-h-[min(calc(100dvh-var(--nav-h)-5.5rem),640px)] min-h-[min(68dvh,520px)] flex-col gap-2 sm:min-h-[min(62dvh,560px)] md:flex-row md:gap-2.5">
                    <ModeCard kind="future" icon={Building2} title={t('future')} count={countOf(projects)} unit={t('projects')} delay={0} onClick={() => pickMode('future')} />
                    <ModeCard kind="land" icon={House} title={t('land')} count={countOf(listings)} unit={t('listings')} delay={90} onClick={() => pickMode('land')} />
                    <ModeCard kind="lease" icon={Tag} title={t('lease')} locked delay={180} comingSoon={t('comingSoon')} onClick={() => pickMode('lease')} />
                  </div>
                </div>
              </div>
            )}

            {showAreaPicker && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5 md:p-8">
                <div className="absolute inset-0 bg-black/55 backdrop-blur-md" aria-hidden="true" />
                <div className="anim-fade relative z-10 flex w-full max-w-[min(100%,72rem)] flex-col gap-3 sm:gap-4">
                  <div className="relative px-1 text-center sm:px-2">
                    <button type="button" aria-label="Close" onClick={closeArea} className="absolute -top-0.5 right-0 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/55 sm:right-1 sm:h-9 sm:w-9"><X size={16} /></button>
                    <h2 className="mx-auto max-w-[min(100%,48rem)] whitespace-nowrap px-9 text-center font-display text-base font-bold leading-snug tracking-tight text-white drop-shadow-md sm:px-14 sm:text-xl md:text-2xl">{t('chooseAreaTitle')}</h2>
                  </div>
                  <div className="grid max-h-[min(calc(100dvh-var(--nav-h)-5.5rem),640px)] min-h-[min(62dvh,480px)] grid-cols-2 gap-2 sm:min-h-[min(58dvh,520px)] md:grid-cols-4 md:gap-2.5">
                    {AREAS.map((item, index) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => chooseArea(item)}
                        aria-pressed={area === item.key}
                        className="anim-up group relative flex min-h-[11rem] flex-col overflow-hidden rounded-2xl bg-cover bg-center text-center shadow-[0_24px_64px_rgba(0,0,0,0.45)] transition-transform duration-300 hover:brightness-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white active:scale-[0.995] sm:min-h-0 sm:rounded-3xl"
                        style={{ animationDelay: `${index * 80}ms`, backgroundImage: `url("${areaArt(item.art)}")` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent transition-opacity duration-300 group-hover:via-black/45" aria-hidden="true" />
                        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-3 py-5 sm:px-4 sm:py-6 md:px-5 md:py-7">
                          <div className="mb-3 inline-flex size-11 items-center justify-center rounded-xl bg-black/40 text-white shadow-lg backdrop-blur-md group-hover:bg-black/50 sm:mb-4 sm:size-14 sm:rounded-2xl"><MapPin size={22} /></div>
                          <h3 className="font-display text-lg font-extrabold leading-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] sm:text-xl md:text-2xl lg:text-[1.65rem]">{item.name}</h3>
                          <p className="mt-1.5 font-display text-[12px] font-semibold leading-snug text-white/95 drop-shadow-sm sm:mt-2 sm:text-sm md:text-[15px]">{item.th}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      {tourStep !== null && <Tour step={tourStep} setStep={setTourStep} onClose={() => setTourStep(null)} />}
    </div>
  );
}
