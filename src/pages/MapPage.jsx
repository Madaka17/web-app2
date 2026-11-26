import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Banknote, ChevronDown, ChevronUp, CircleHelp, Coins, Filter, Layers, ListChecks, LocateFixed,
  LogOut, MapPin, Minus, Plus, Search, TrendingUp, X,
} from 'lucide-react';
import { BRAND, useLang, usePageMeta } from '../i18n.jsx';
import Header from '../components/Header.jsx';
import { SeoBlock } from '../components/Footer.jsx';
import { useAlerts } from '../components/Alerts.jsx';
import MapCanvas from '../components/MapCanvas.jsx';
import { FilterPanel, LayerPanel, legendLabelKey } from '../components/MapPanels.jsx';
import PricePanel from '../components/PricePanel.jsx';
import { PLACE_LABELS } from '../data.js';
import { DECISION_LEGEND, EMPTY_FILTER, LISTING_LEGEND, UNSCORED_COLOR, applyFilter, findPoint, loadListings, summarize } from '../lib/mapData';

const DECISION_LABEL_KEY = { accept: 'decisionAccept', defer: 'decisionDefer', reject: 'decisionReject' };
const COLOR_BY_OPTIONS = [['type', 'colorByType'], ['decision', 'colorByDecision']];

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
  const { setAlert } = useAlerts();
  const [params] = useSearchParams();
  const canvas = useRef(null);
  const seenNotice = useRef(false);
  const seenTour = useRef(false);

  // Keyed on the param strings so a re-render with the same link keeps one object; a non-numeric link is ignored.
  const latParam = params.get('lat');
  const lngParam = params.get('lng');
  const linked = useMemo(() => {
    if (!latParam || !lngParam) return null;
    const lat = Number(latParam);
    const lng = Number(lngParam);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }, [latParam, lngParam]);
  const [statsOpen, setStatsOpen] = useState(true);
  const [legendOpen, setLegendOpen] = useState(true);
  const [colorBy, setColorBy] = useState('type');
  const [panel, setPanel] = useState(null);
  const [baseMap, setBaseMap] = useState('hybrid');
  const [measuring, setMeasuring] = useState(false);
  const [cityPlan, setCityPlan] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [query, setQuery] = useState('');
  const [tourStep, setTourStep] = useState(null);
  const [listings, setListings] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [target, setTarget] = useState(null);
  // The price panel docks beside the map on desktop and opens as a bottom sheet below lg.
  const [panelOpen, setPanelOpen] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(min-width:1024px)').matches,
  );

  usePageMeta(BRAND, 'สำรวจประกาศซื้อขายและขายฝากที่ดินบนแผนที่ (ตัวอย่าง)');

  // The listing data loads once. The map keeps working without it; it just shows no pins.
  useEffect(() => {
    const controller = new AbortController();
    loadListings(controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setListings(data);
      },
      () => {
        if (controller.signal.aborted) return;
        setLoadError(true);
      },
    );
    return () => controller.abort();
  }, []);

  const openTour = () => {
    seenTour.current = true;
    setTourStep(0);
  };

  useEffect(() => {
    // Deep links (?lat=&lng=) open on a listing and skip the first-visit notice.
    if (seenNotice.current || linked) return;
    seenNotice.current = true;
    setAlert({ type: 'edu', after: !seenTour.current ? openTour : null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listing pins after filtering.
  const points = useMemo(() => applyFilter(listings ?? [], filter), [listings, filter]);
  const summary = useMemo(() => summarize(points), [points]);

  const onPick = (lat, lng) => {
    setTarget({ lat, lng, source: 'map' });
    setPanelOpen(true);
  };
  const onSelectPoint = (p) => {
    setTarget({ lat: p.lat, lng: p.lng, source: p.kind, point: p });
    setPanelOpen(true);
  };

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

  const ready = listings !== null;
  const fmtCount = (n) => (ready ? n.toLocaleString('en-US') : '—');
  const fmtMillions = (baht) => (ready ? (baht / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 }) : '—');

  const stats = [
    { icon: ListChecks, bigIcon: MapPin, title: t('totalListings'), value: fmtCount(summary.count), unit: t('listings'), tint: '#df201c14', iconBg: '#df201c1a', iconColor: '#df201c', minW: 'xl:min-w-[160px]' },
    { icon: Banknote, bigIcon: Coins, title: t('totalValue'), value: fmtMillions(summary.totalPrice), unit: t('mthb'), tint: '#ef6c0014', iconBg: 'transparent', iconColor: '#e65100', minW: 'xl:min-w-[190px]' },
    { icon: TrendingUp, bigIcon: Coins, title: t('medianPrice'), value: fmtMillions(summary.medianPrice), unit: t('mthb'), tint: '#2e7d3214', iconBg: 'transparent', iconColor: '#2e7d32', minW: 'xl:min-w-[160px]' },
  ];

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden overscroll-none bg-surface-soft">
      <Header tone="map" />
      <div className="h-[var(--nav-h)] shrink-0" aria-hidden="true" />
      <main className="relative flex min-h-0 flex-1 overflow-hidden overscroll-none">
        {panelOpen && (
          <aside aria-label={t('priceEstimate')} className="flex min-h-0 flex-col bg-white max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-[1500] max-lg:max-h-[62dvh] max-lg:rounded-t-xl max-lg:shadow-lg lg:relative lg:w-[440px] xl:w-[500px] lg:shrink-0 lg:border-r lg:border-line">
            <PricePanel target={target} onClearTarget={() => setTarget(null)} onClose={() => setPanelOpen(false)} />
          </aside>
        )}
        <div className="relative h-full min-w-0 flex-1">
          <SeoBlock
            title={BRAND}
            lead="สำรวจประกาศขายบ้านและที่ดินมือสอง พร้อมราคาประกาศขายโดยประมาณ บนแผนที่กรุงเทพฯ และปริมณฑล"
            heading={(
              <>
                <div><h2>บ้านและที่ดินมือสองบนแผนที่</h2><p>ค้นหาประกาศขายตามตำแหน่ง พื้นที่ และประเภททรัพย์</p></div>
                <div><h2>ราคาประกาศขายโดยประมาณ</h2><p>คลิกหมุดหรือจุดบนแผนที่เพื่อดูราคาประมาณและส่วนต่างจากราคาประกาศ</p></div>
              </>
            )}
          />
          <div className="relative h-full w-full" data-tour="listing-map-stage">
            <MapCanvas ref={canvas} points={points} baseMap={baseMap} cityPlan={cityPlan} measuring={measuring} focus={linked} target={target} onPick={onPick} onSelectPoint={onSelectPoint} colorBy={colorBy} />

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
                  <button type="button" onClick={openTour} data-tour="listing-tour-help" aria-label={t('usageGuide')} title={t('usageGuide')} className="flex h-auto min-h-10 shrink-0 items-center justify-center rounded-full border border-[#e6d200]/80 bg-[#FFEA00] px-3 py-2 text-[11px] font-bold leading-tight text-neutral-900 shadow-md transition-colors hover:bg-[#f5dc00] max-sm:h-10 max-sm:w-10 max-sm:px-0 xl:min-h-10 xl:px-3.5 xl:text-xs">
                    <CircleHelp size={20} className="sm:hidden" />
                    <span className="hidden sm:inline">{t('usageGuide')}</span>
                  </button>
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

            <div className="pointer-events-auto absolute right-3 top-[4.25rem] flex flex-col items-end gap-2 sm:right-4 2xl:top-4" style={{ zIndex: 1000 }}>
              <div className="relative" style={{ zIndex: 1000 }}>
                <div className="flex flex-col gap-2">
                  <RoundButton label={t('layer')} dot active={panel === 'layer'} onClick={() => setPanel(panel === 'layer' ? null : 'layer')}><Layers size={16} /></RoundButton>
                  <RoundButton label={t('filters')} active={panel === 'filters'} onClick={() => setPanel(panel === 'filters' ? null : 'filters')}><Filter size={16} /></RoundButton>
                  <RoundButton label={t('priceEstimate')} active={panelOpen} onClick={() => setPanelOpen((v) => !v)}><TrendingUp size={16} /></RoundButton>
                </div>
                {panel === 'layer' && (
                  <LayerPanel baseMap={baseMap} setBaseMap={setBaseMap} measuring={measuring} setMeasuring={setMeasuring} cityPlan={cityPlan} setCityPlan={setCityPlan} onClose={() => setPanel(null)} />
                )}
                {panel === 'filters' && <FilterPanel value={filter} onClose={() => setPanel(null)} onApply={(next) => { setFilter(next); setPanel(null); }} />}
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
                    <div role="group" aria-label={t('legend')} className="mb-1.5 flex flex-wrap gap-1">
                      {COLOR_BY_OPTIONS.map(([mode, labelKey]) => {
                        const active = colorBy === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setColorBy(mode)}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${active ? 'bg-[#DC2626] text-white' : 'bg-surface-soft text-ink-secondary'}`}
                          >
                            {t(labelKey)}
                          </button>
                        );
                      })}
                    </div>
                    <ul className="space-y-0">
                      {colorBy === 'decision'
                        ? [
                          ...DECISION_LEGEND.map(([key, color]) => [key, color, DECISION_LABEL_KEY[key]]),
                          ['unscored', UNSCORED_COLOR, 'decisionUnscored'],
                        ].map(([key, color, labelKey]) => (
                          <li key={key} className="flex items-center gap-1.5 py-0.5">
                            <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-white shadow" style={{ background: color }} aria-hidden="true" />
                            <span className="text-[11px] leading-snug text-gray-800">{t(labelKey)}</span>
                          </li>
                        ))
                        : LISTING_LEGEND.map(([key, color]) => (
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
          </div>
        </div>
      </main>
      {tourStep !== null && <Tour step={tourStep} setStep={setTourStep} onClose={() => setTourStep(null)} />}
    </div>
  );
}
