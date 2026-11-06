import { useEffect, useId, useState } from 'react';
import { AlertTriangle, Loader2, MapPin, TrendingUp, X } from 'lucide-react';
import { useLang } from '../i18n.jsx';
import { LOCATIONS, findLocationPath } from '../lib/locations';
import { AREA_MAX, AREA_MIN, DEFAULT_FORM, askingGap, isInCoverage, targetPatch, toPayload } from '../lib/priceForm';
import { DEFAULT_GROWTH_PCT, GROWTH_MAX_PCT, GROWTH_MIN_PCT, GROWTH_STEP_PCT, HORIZONS_YEARS, compound } from '../lib/growth';
import { formatBaht } from '../lib/prediction';
import { getHealth } from '../lib/api';
import { usePrediction } from '../lib/usePrediction.js';
import { YEAR_MAX, YEAR_MIN } from '../lib/defaults';

const PROPERTY_TYPES = [
  ['condo', 'condo'],
  ['house', 'house'],
  ['townhome', 'townhome'],
  ['land', 'landType'],
];

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

// Model health, checked each time the panel mounts.
function useHealth() {
  const [status, setStatus] = useState('checking');
  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then((health) => setStatus(health?.status === 'ok' ? 'ok' : 'down'))
      .catch(() => {
        if (!controller.signal.aborted) setStatus('down');
      });
    return () => controller.abort();
  }, []);
  return status;
}

// A number field that keeps the raw text while typing. Blank means undefined
// for optional fields. The value is clamped to [min, max] on blur.
function NumberField({ label, value, min, max, integer = false, optional = false, hint, onChange }) {
  const id = useId();
  const [text, setText] = useState(value == null ? '' : String(value));

  // Follow outside changes, but never rewrite text the user is still typing ("5." stays "5.").
  useEffect(() => {
    setText((prev) => {
      if (value == null) return prev.trim() === '' ? prev : '';
      return Number(prev) === value ? prev : String(value);
    });
  }, [value]);

  const handleChange = (event) => {
    const next = event.target.value;
    setText(next);
    const trimmed = next.trim();
    if (trimmed === '') {
      if (optional) onChange(undefined);
      return;
    }
    const n = Number(trimmed);
    if (Number.isFinite(n)) onChange(n);
  };

  const handleBlur = () => {
    const trimmed = text.trim();
    const restore = () => setText(value == null ? '' : String(value));
    if (trimmed === '') {
      if (optional) {
        onChange(undefined);
        setText('');
      } else {
        restore();
      }
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      restore();
      return;
    }
    const c = clamp(integer ? Math.round(n) : n, min, max);
    onChange(c);
    setText(String(c));
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink-primary">{label}</label>
      <input
        id={id}
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink-primary outline-none focus:border-primary"
      />
      {hint && <span className="mt-1 block text-[11px] text-ink-muted">{hint}</span>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-xs font-bold tracking-wide text-ink-secondary">{title}</h3>
      {children}
    </section>
  );
}

function SelectField({ label, value, onChange, children }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink-primary">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full appearance-none rounded-lg border border-line bg-white px-3 text-sm text-ink-primary outline-none focus:border-primary">
        {children}
      </select>
    </div>
  );
}

export default function PricePanel({ target, onClearTarget, onClose }) {
  const { t } = useLang();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [growth, setGrowth] = useState(DEFAULT_GROWTH_PCT[DEFAULT_FORM.propertyType]);
  const health = useHealth();

  const patch = (fields) => setForm((f) => ({ ...f, ...fields }));

  // A new target (map click, listing or project pin) writes its fields into the form.
  useEffect(() => {
    if (target) setForm((f) => ({ ...f, ...targetPatch(target) }));
  }, [target]);

  // Each property type starts from its own assumed growth rate.
  useEffect(() => {
    setGrowth(DEFAULT_GROWTH_PCT[form.propertyType]);
  }, [form.propertyType]);

  const inCoverage = !target || isInCoverage(target.lat, target.lng);
  const payload = inCoverage ? toPayload(form, target) : null;
  const { result, running, error } = usePrediction(payload);

  const point = target?.point ?? null;
  const pointTitle = point ? (point.kind === 'listing' ? point.title : point.name) : null;
  const coords = target ? `${target.lat.toFixed(5)}, ${target.lng.toFixed(5)}` : '';
  const pointPlace = point ? `${point.district} · ${point.province}` : coords;

  const showResult = inCoverage && !error && result;
  const predicted = showResult ? result.predictedPrice : 0;
  const isListing = target?.source === 'listing' && point?.kind === 'listing';
  const priced = isListing && point.group !== 'other';
  const gap = priced && predicted > 0 ? askingGap(point.price, predicted) : null;
  const gapTone = gap == null ? '' : gap > 10 ? 'text-[#DC2626]' : gap < -10 ? 'text-[#16a34a]' : 'text-ink-secondary';
  const gapVerdict = gap == null ? '' : gap > 10 ? t('askingAbove') : gap < -10 ? t('askingBelow') : t('askingNear');

  // Cascading location picker, driven by the form's subdistrict.
  const path = findLocationPath(form.subdistrictId);
  const region = path?.region ?? LOCATIONS[0];
  const district = path?.district ?? region.districts[0];
  const pickRegion = (id) => {
    const next = LOCATIONS.find((r) => r.id === id) ?? LOCATIONS[0];
    patch({ subdistrictId: next.districts[0].subdistricts[0].id });
  };
  const pickDistrict = (id) => {
    const next = region.districts.find((d) => d.id === id) ?? region.districts[0];
    patch({ subdistrictId: next.subdistricts[0].id });
  };

  const c = showResult ? result.comparables : null;
  const compRows = c
    ? [
      { label: t('compDistrict'), ppsqm: c.district_ppsqm, n: c.district_n },
      { label: t('compSubdistrict'), ppsqm: c.subdistrict_ppsqm, n: c.subdistrict_n },
      { label: t('compSizeBand'), ppsqm: c.size_band_ppsqm, n: c.size_band_n },
      c.exact_size_n > 0
        ? { label: t('compExactSize'), ppsqm: c.exact_size_ppsqm, n: c.exact_size_n }
        : { label: t('compNearestSize'), ppsqm: c.nearest_size_ppsqm, n: null },
    ]
    : [];
  const weightSum = showResult ? result.contributions.reduce((s, m) => s + m.weight, 0) || 1 : 1;
  const healthLabel = health === 'ok' ? t('healthOk') : health === 'down' ? t('healthDown') : t('healthChecking');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between bg-[#DC2626] px-4 py-2.5 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <TrendingUp size={15} className="shrink-0" aria-hidden="true" />
          <h2 className="truncate text-sm font-bold tracking-wide">{t('priceEstimate')}</h2>
          <span
            role="status"
            aria-label={healthLabel}
            title={healthLabel}
            className={`h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white ${health === 'ok' ? 'bg-[#22c55e]' : health === 'down' ? 'bg-[#7f1d1d]' : 'bg-white/40'}`}
          />
        </div>
        <button type="button" aria-label={t('closePanel')} onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/85 transition-colors hover:bg-white/10 hover:text-white">
          <X size={16} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-4">
        <Section title={t('location')}>
          {target ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-line p-3">
              <MapPin size={16} className="mt-0.5 shrink-0 text-[#DC2626]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-primary">{pointTitle ?? t('selectedPoint')}</p>
                <p className="truncate text-xs text-ink-secondary">{pointPlace}</p>
              </div>
              <button type="button" aria-label={t('clearTarget')} onClick={onClearTarget} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-soft hover:text-ink-primary">
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs leading-relaxed text-ink-secondary">{t('clickMapHint')}</p>
              <div className="grid gap-2.5">
                <SelectField label={t('provinceLabel')} value={region.id} onChange={pickRegion}>
                  {LOCATIONS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </SelectField>
                <SelectField label={t('districtLabel')} value={district.id} onChange={pickDistrict}>
                  {region.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </SelectField>
                <SelectField label={t('subdistrictLabel')} value={form.subdistrictId} onChange={(id) => patch({ subdistrictId: id })}>
                  {district.subdistricts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </SelectField>
              </div>
            </>
          )}
        </Section>

        <Section title={t('propertyType')}>
          <div role="group" aria-label={t('propertyType')} className="grid grid-cols-4 gap-1.5">
            {PROPERTY_TYPES.map(([key, labelKey]) => {
              const active = form.propertyType === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => patch({ propertyType: key })}
                  className={`min-h-10 rounded-lg px-1 text-xs font-semibold transition-colors ${active ? 'bg-[#DC2626] text-white' : 'border border-line bg-white text-ink-secondary hover:bg-surface-soft'}`}
                >
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
          <NumberField
            label={t('sizeSqm')}
            value={form.area}
            min={AREA_MIN}
            max={AREA_MAX}
            hint={`${t('rangeLabel')} ${AREA_MIN}–${AREA_MAX} ${t('sqm')}`}
            onChange={(area) => patch({ area })}
          />
        </Section>

        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer select-none text-xs font-bold tracking-wide text-ink-secondary">{t('moreDetails')}</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <NumberField label={t('units')} value={form.nUnits} min={1} max={4} integer onChange={(nUnits) => patch({ nUnits })} />
            <NumberField label={t('yearLabel')} value={form.year} min={YEAR_MIN} max={YEAR_MAX} integer hint={`${YEAR_MIN}–${YEAR_MAX}`} onChange={(year) => patch({ year })} />
            <NumberField label={t('bedrooms')} value={form.bedrooms} min={0} max={20} optional onChange={(bedrooms) => patch({ bedrooms })} />
            <NumberField label={t('bathrooms')} value={form.bathrooms} min={0} max={20} optional onChange={(bathrooms) => patch({ bathrooms })} />
            <div className="col-span-2">
              <NumberField label={t('buildingAge')} value={form.buildingAge} min={0} max={100} integer optional onChange={(buildingAge) => patch({ buildingAge })} />
            </div>
            {(form.propertyType === 'house' || form.propertyType === 'townhome') && (
              <div className="col-span-2">
                <SelectField label={t('estate')} value={form.estate ?? ''} onChange={(v) => patch({ estate: v || undefined })}>
                  <option value="">{t('estateUnknown')}</option>
                  <option value="in">{t('estateIn')}</option>
                  <option value="out">{t('estateOut')}</option>
                </SelectField>
              </div>
            )}
          </div>
        </details>

        {!inCoverage && (
          <div role="status" className="rounded-lg border border-line bg-surface-soft p-3 text-sm leading-relaxed text-ink-secondary">{t('outOfCoverage')}</div>
        )}

        {inCoverage && error && (
          <div role="alert" className="rounded-lg border border-[#DC2626]/30 bg-red-50 p-3 text-sm text-[#DC2626]">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={15} className="shrink-0" aria-hidden="true" />{t('apiError')}</p>
            <p className="mt-1 break-words text-xs text-[#991b1b]">{error}</p>
          </div>
        )}

        {inCoverage && !error && !result && running && (
          <div role="status" className="flex items-center gap-2 text-sm text-ink-secondary">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            {t('calculating')}
          </div>
        )}

        {showResult && (
          <div aria-busy={running} className={`space-y-6 transition-opacity duration-200 ${running ? 'opacity-60' : 'opacity-100'}`}>
            <div className="space-y-2.5">
              <div className="rounded-xl border border-line bg-white p-4">
                <p className="font-display text-2xl font-extrabold leading-tight text-ink-primary">{formatBaht(result.predictedPrice)}</p>
                <p className="mt-2 text-xs text-ink-secondary">
                  <span className="font-semibold text-ink-primary">{t('estimateRange')}:</span>{' '}
                  {formatBaht(result.lowerBound)} – {formatBaht(result.upperBound)}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-surface-soft p-2">
                    <p className="text-ink-muted">{t('withinHit')}</p>
                    <p className="font-display text-base font-bold text-ink-primary">{result.meta.within_20pct.toLocaleString('en-US', { maximumFractionDigits: 1 })}%</p>
                  </div>
                  <div className="rounded-lg bg-surface-soft p-2">
                    <p className="text-ink-muted">{t('medianError')}</p>
                    <p className="font-display text-base font-bold text-ink-primary">{result.meta.median_abs_pct_error.toLocaleString('en-US', { maximumFractionDigits: 1 })}%</p>
                  </div>
                </div>
                <dl className="mt-3 space-y-1 text-xs">
                  <div className="flex gap-2"><dt className="shrink-0 text-ink-muted">{t('resolvedLocation')}</dt><dd className="min-w-0 text-ink-primary">{[result.meta.subdistrict, result.meta.district, result.meta.province].filter(Boolean).join(', ')}</dd></div>
                  {result.meta.project && (
                    <div className="flex gap-2"><dt className="shrink-0 text-ink-muted">{t('snappedProject')}</dt><dd className="min-w-0 text-ink-primary">{result.meta.project}</dd></div>
                  )}
                </dl>
              </div>

              {isListing && (
                <div className="rounded-xl border border-line p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-ink-secondary">{t('askingPrice')}</span>
                    <span className="font-display text-base font-bold text-ink-primary">{formatBaht(point.price)}</span>
                  </div>
                  {gap != null && (
                    <>
                      <div className="mt-2 flex items-baseline justify-between gap-2">
                        <span className="text-xs text-ink-secondary">{t('askingVsEstimate')}</span>
                        <span className={`font-display text-base font-bold ${gapTone}`}>{gap > 0 ? '+' : ''}{gap.toFixed(1)}%</span>
                      </div>
                      <p className={`mt-1 text-xs ${gapTone}`}>{gapVerdict}</p>
                    </>
                  )}
                  {!priced && <p className="mt-2 text-xs leading-relaxed text-ink-secondary">{t('typeUnsupported')}</p>}
                </div>
              )}
            </div>

            <Section title={t('comparables')}>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {compRows.map((row) => (
                  <li key={row.label} className="flex items-baseline justify-between gap-2 px-3 py-2 text-xs">
                    <span className="text-ink-secondary">{row.label}</span>
                    <span className="text-right">
                      <span className="font-display font-bold text-ink-primary">{Math.round(row.ppsqm).toLocaleString('en-US')}</span>{' '}
                      <span className="text-ink-muted">{t('ppsqmUnit')}</span>
                      {row.n != null && <span className="ml-2 text-ink-muted">{`${row.n.toLocaleString('en-US')} ${t('listings')}`}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {c.district_n < 30 && (
                <p className="flex items-start gap-1.5 text-xs leading-relaxed text-[#b45309]">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                  {t('thinSample')}
                </p>
              )}
            </Section>

            <Section title={t('models')}>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-soft" aria-hidden="true">
                {result.contributions.map((m) => (
                  <span key={m.name} style={{ width: `${(m.weight / weightSum) * 100}%`, background: m.color }} />
                ))}
              </div>
              <ul className="space-y-1.5 text-xs">
                {result.contributions.map((m) => (
                  <li key={m.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: m.color }} aria-hidden="true" />
                    <span className="flex-1 text-ink-secondary">{m.name}</span>
                    <span className="tabular-nums text-ink-muted">{Math.round((m.weight / weightSum) * 100)}%</span>
                    <span className="w-28 text-right tabular-nums text-ink-primary">{formatBaht(m.prediction)}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title={t('futureValue')}>
              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="growth-rate" className="text-xs font-medium text-ink-primary">{t('growthRate')}</label>
                  <span className="font-display text-sm font-bold text-ink-primary">{growth}%</span>
                </div>
                <input
                  id="growth-rate"
                  type="range"
                  min={GROWTH_MIN_PCT}
                  max={GROWTH_MAX_PCT}
                  step={GROWTH_STEP_PCT}
                  value={growth}
                  onChange={(e) => setGrowth(Number(e.target.value))}
                  className="mt-2 w-full accent-[#DC2626]"
                />
              </div>
              <p className="text-[11px] text-ink-muted">{t('mthb')}</p>
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-left text-ink-muted">
                    <th className="py-1 font-medium">{t('horizon')}</th>
                    <th className="py-1 text-right font-medium">{t('estimateLow')}</th>
                    <th className="py-1 text-right font-medium">{t('estimateMid')}</th>
                    <th className="py-1 text-right font-medium">{t('estimateHigh')}</th>
                  </tr>
                </thead>
                <tbody className="text-ink-primary">
                  {HORIZONS_YEARS.map((years) => (
                    <tr key={years} className="border-t border-line">
                      <td className="py-1.5">{years}</td>
                      <td className="py-1.5 text-right">{(compound(result.lowerBound, growth, years) / 1e6).toFixed(2)}</td>
                      <td className="py-1.5 text-right font-semibold">{(compound(result.predictedPrice, growth, years) / 1e6).toFixed(2)}</td>
                      <td className="py-1.5 text-right">{(compound(result.upperBound, growth, years) / 1e6).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] leading-relaxed text-ink-muted">{t('futureNote')}</p>
            </Section>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-line bg-surface-soft px-4 py-2.5">
        <p className="text-[11px] leading-relaxed text-ink-secondary">{t('priceNotice')}</p>
      </footer>
    </div>
  );
}
