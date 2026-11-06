import { useState } from 'react';
import { Car, ChevronDown, Filter, Map as MapIcon, Mountain, Ruler, Satellite, X } from 'lucide-react';
import { useLang } from '../i18n.jsx';
import { EMPTY_FILTER, LISTING_LEGEND, PROJECT_LEGEND } from '../lib/mapData';

// The land type shares its legend key with the mode name, so it gets its own label.
export function legendLabelKey(key) {
  return key === 'land' ? 'landType' : key;
}

function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

const BASES = [
  { key: 'hybrid', icon: MapIcon, tone: '#7a4a2a' },
  { key: 'satellite', icon: Satellite, tone: '#39432b' },
  { key: 'street', icon: Car, tone: '#6f8f7f' },
  { key: 'terrain', icon: Mountain, tone: '#8fa3a8' },
];

export function LayerPanel({ baseMap, setBaseMap, measuring, setMeasuring, cityPlan, setCityPlan, onClose }) {
  const { t } = useLang();
  return (
    <div role="dialog" aria-labelledby="layer-panel-title" className="anim-fade absolute right-full top-0 mr-1.5 flex w-[min(calc(100vw-4.75rem),300px)] flex-col gap-3 max-[380px]:mr-1 max-[380px]:w-[min(calc(100vw-3.75rem),280px)] sm:mr-3 sm:w-[min(calc(100vw-5.5rem),340px)] md:w-[min(calc(100vw-6rem),360px)] md:max-lg:top-12" style={{ zIndex: 1100 }}>
      <section className="max-h-[calc(100dvh-var(--nav-h)-19rem)] overflow-y-auto overscroll-contain rounded-xl border border-[#E0E0E0] bg-white shadow-lg sm:max-h-[calc(100dvh-var(--nav-h)-21rem)] lg:max-h-[calc(100dvh-var(--nav-h)-24rem)]">
        <header className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl bg-[#DC2626] px-3 py-2.5 sm:px-4">
          <div id="layer-panel-title" className="text-[13px] font-bold tracking-wide text-white sm:text-sm">{t('layer')}</div>
          <button type="button" aria-label="ปิด" onClick={onClose} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/10 hover:text-white"><X size={16} /></button>
        </header>
        <div className="flex flex-col gap-2.5 p-2.5 sm:gap-3 sm:p-3 md:p-3.5">
          <span className="text-[11px] font-medium text-[#9CA3AF] sm:text-xs">{t('baseMap')}</span>
          <div className="flex flex-col gap-1 sm:gap-1.5">
            {BASES.map(({ key, icon: Icon, tone }) => {
              const active = baseMap === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  aria-label={t(key)}
                  onClick={() => setBaseMap(key)}
                  className={`relative flex min-h-10 w-full items-center gap-2 overflow-hidden rounded-lg px-2.5 py-1.5 text-left outline-none sm:min-h-11 sm:rounded-xl sm:px-3 sm:py-2 md:px-3.5 ${active ? 'shadow-sm ring-2 ring-[#DC2626]' : 'ring-1 ring-black/5'}`}
                  style={{ background: `linear-gradient(90deg, ${active ? '#B91C1C' : '#1f1f1f'} 0%, ${active ? '#DC2626BF' : '#00000073'} 50%, ${tone} 100%)` }}
                >
                  <Icon size={16} className="relative z-[1] shrink-0 text-white" />
                  <span className="relative z-[1] min-w-0 flex-1 truncate text-[12px] font-semibold text-white sm:text-[13px]">{t(key)}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 py-2">
            <Ruler size={16} className="text-ink-secondary" />
            <span className="flex-1 text-[13px] text-ink-primary">{t('measure')}</span>
            <Toggle on={measuring} onChange={setMeasuring} label={t('measure')} />
          </div>
          <div className="border-t border-line pt-3">
            <span className="text-[11px] font-medium text-[#9CA3AF] sm:text-xs">{t('cityPlan')}</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[13px] text-ink-primary">BKK</span>
              <Toggle on={cityPlan} onChange={setCityPlan} label="BKK" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FakeSelect({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-primary">{label}</span>
      <span className="relative block">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full appearance-none rounded-lg border border-line bg-white pl-3 pr-8 text-sm text-ink-secondary outline-none focus:border-primary">
          {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      </span>
    </label>
  );
}

function RangeField({ label, value, onChange }) {
  const { t } = useLang();
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-ink-primary">{label}</span>
      <div className="flex items-center gap-2">
        <input inputMode="numeric" placeholder={t('min')} value={value[0]} onChange={(e) => onChange([e.target.value, value[1]])} className="h-10 min-w-0 flex-1 rounded-lg border border-line px-3 text-sm outline-none focus:border-primary" />
        <span className="text-ink-muted">-</span>
        <input inputMode="numeric" placeholder={t('max')} value={value[1]} onChange={(e) => onChange([value[0], e.target.value])} className="h-10 min-w-0 flex-1 rounded-lg border border-line px-3 text-sm outline-none focus:border-primary" />
      </div>
    </div>
  );
}

export function FilterPanel({ mode, value, onApply, onClose }) {
  const { t } = useLang();
  const [form, setForm] = useState(value);
  const legend = mode === 'future' ? PROJECT_LEGEND : LISTING_LEGEND;
  const typeOptions = [['all', t('all')], ...legend.map(([key]) => [key, t(legendLabelKey(key))])];
  const setField = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const setRange = (minKey, maxKey) => ([min, max]) => setForm((f) => ({ ...f, [minKey]: min, [maxKey]: max }));
  return (
    <div role="dialog" aria-label={t('filters')} className="anim-fade absolute right-full top-0 mr-1.5 w-[min(calc(100vw-4.75rem),300px)] sm:mr-3 sm:w-[320px]" style={{ zIndex: 1100 }}>
      <section className="flex max-h-[calc(100dvh-var(--nav-h)-8rem)] flex-col overflow-hidden rounded-xl border border-[#E0E0E0] bg-white shadow-lg">
        <header className="flex items-center justify-between bg-[#DC2626] px-4 py-2.5 text-white">
          <span className="flex items-center gap-2 text-sm font-bold"><Filter size={15} /> {t('filters')}</span>
          <button type="button" aria-label="ปิด" onClick={onClose} className="inline-flex h-6 w-6 items-center justify-center rounded text-white/85 hover:text-white"><X size={15} /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <FakeSelect label={t('propertyType')} value={form.group} options={typeOptions} onChange={setField('group')} />
          <RangeField label={t('sizeSqm')} value={[form.sizeMin, form.sizeMax]} onChange={setRange('sizeMin', 'sizeMax')} />
          <RangeField label={t('totalPrice')} value={[form.priceMin, form.priceMax]} onChange={setRange('priceMin', 'priceMax')} />
        </div>
        <div className="flex gap-2 border-t border-line p-3">
          <button type="button" onClick={() => onApply(form)} className="btn-primary btn-md flex-1">{t('applyFilters')}</button>
          <button type="button" onClick={() => { setForm(EMPTY_FILTER); onApply(EMPTY_FILTER); }} className="btn-outline btn-md flex-1">{t('clear')}</button>
        </div>
      </section>
    </div>
  );
}
