import { useEffect, useId, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, CheckCircle2, HelpCircle, Home, Info, Layers, MapPin, Minus, Percent, Scale, Target, TrendingUp, X, XCircle } from 'lucide-react';
import { useLang } from '../i18n.jsx';
import { LOCATIONS, findLocationPath } from '../lib/locations';
import { AREA_MAX, AREA_MIN, DEFAULT_FORM, askingGap, gapApplies, isInCoverage, listingPropertyType, targetPatch, toPayload } from '../lib/priceForm';
import { formatBaht, isLandCollateral } from '../lib/prediction';
import { getHealth } from '../lib/api';
import { usePrediction } from '../lib/usePrediction.js';
import { useExplanation } from '../lib/useExplanation.js';
import { barWidth, groupLabelKey, signedPct } from '../lib/explanation';
import { YEAR_MAX, YEAR_MIN } from '../lib/defaults';

const PROPERTY_TYPES = [
  ['condo', 'condo'],
  ['house', 'house'],
  ['townhome', 'townhome'],
  ['land', 'landType'],
];

// The fields the result panels read. Anything missing means the response is unusable.
function isUsableResult(r) {
  return Boolean(r)
    && Number.isFinite(r.predictedPrice)
    && Array.isArray(r.contributions)
    && r.comparables != null
    && r.meta != null
    && Number.isFinite(r.meta.within_20pct)
    && Number.isFinite(r.meta.median_abs_pct_error);
}

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

const DECISION_STYLE = {
  accept: { tint: 'bg-emerald-50 text-[#16a34a]', Icon: CheckCircle2, label: 'decisionAccept', hint: 'decisionAcceptHint' },
  defer: { tint: 'bg-amber-50 text-amber-700', Icon: HelpCircle, label: 'decisionDefer', hint: 'decisionDeferHint' },
  reject: { tint: 'bg-red-50 text-[#DC2626]', Icon: XCircle, label: 'decisionReject', hint: 'decisionRejectHint' },
};

const DECISION_COMPONENTS = [
  ['agreement', 'decisionAgreement'],
  ['local', 'decisionLocal'],
  ['size', 'decisionSize'],
  ['district', 'decisionDistrict'],
];

// Three-way reliability verdict on the estimate. Renders nothing without a decision.
function DecisionBadge({ decision }) {
  const { t } = useLang();
  const style = decision ? DECISION_STYLE[decision.label] : null;
  if (!style) return null;
  const { Icon } = style;
  const label = t(style.label);
  const score = decision.score.toFixed(2);
  return (
    <div role="status" aria-label={`${label} ${t('decisionScore')} ${score}`} className="mt-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${style.tint}`}>
          <Icon size={14} aria-hidden="true" />
          {label}
        </span>
        <span className="text-xs tabular-nums text-ink-secondary">{`${t('decisionScore')} ${score}`}</span>
      </div>
      <p className="text-[11px] text-ink-secondary">{t(style.hint)}</p>
      <details className="text-xs">
        <summary className="cursor-pointer text-ink-secondary">{t('decisionScore')}</summary>
        <ul className="mt-2 space-y-1.5">
          {DECISION_COMPONENTS.map(([key, labelKey]) => {
            const v = decision.components[key];
            return (
              <li key={key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-ink-secondary">{t(labelKey)}</span>
                  <span className="tabular-nums text-ink-primary">{`${Math.round(v * 100)}%`}</span>
                </div>
                <div aria-hidden="true" className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-soft">
                  <div className="h-full rounded-full bg-[#DC2626]/25" style={{ width: `${v * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <section className="space-y-2.5">
      <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
        {Icon && <Icon size={13} className="shrink-0 text-[#DC2626]" aria-hidden="true" />}
        {title}
      </h3>
      {children}
    </section>
  );
}

// Same thresholds as the gap verdict: above +10%, below -10%, otherwise near.
function gapColors(gap) {
  if (gap == null) return { bg: null, text: '', pill: '', Arrow: null, border: 'border-l-line' };
  if (gap > 10) return { bg: 'bg-[#DC2626]', text: 'text-[#DC2626]', pill: 'bg-red-50', Arrow: ArrowUpRight, border: 'border-l-[#DC2626]' };
  if (gap < -10) return { bg: 'bg-emerald-600', text: 'text-[#16a34a]', pill: 'bg-emerald-50', Arrow: ArrowDownRight, border: 'border-l-emerald-600' };
  return { bg: 'bg-amber-500', text: 'text-ink-secondary', pill: 'bg-amber-50', Arrow: Minus, border: 'border-l-amber-500' };
}

// Low / mid / high on a track. The domain is padded, and widened to include the asking price when given.
function RangeBar({ low, mid, high, marker, markerClass = '' }) {
  const { t } = useLang();
  const fmtBaht = (value) => formatBaht(value, { million: t('mthb'), baht: t('thb') });
  const pad = (high - low) * 0.15;
  const lo = marker != null ? Math.min(low, marker) - pad : low - pad;
  const hi = marker != null ? Math.max(high, marker) + pad : high + pad;
  const span = hi - lo || 1;
  const pct = (v) => clamp(((v - lo) / span) * 100, 0, 100);
  const label = `${t('estimateRange')}: ${fmtBaht(low)} – ${fmtBaht(high)}`;
  return (
    <div role="img" aria-label={label} className="mt-3">
      <p className="mb-1.5 text-center text-[11px] text-ink-secondary">{t('estimateRange')}</p>
      <div className="relative h-2 w-full rounded-full bg-surface-soft">
        <div
          className="absolute inset-y-0 rounded-full bg-[#DC2626]/20"
          style={{ left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }}
        />
        <div
          className="absolute inset-y-[-3px] w-[3px] -translate-x-1/2 rounded-sm bg-ink-primary"
          style={{ left: `${pct(mid)}%` }}
        />
        {marker != null && (
          <div
            className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white ${markerClass}`}
            style={{ left: `${pct(marker)}%` }}
          />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-ink-muted">
        <span>{fmtBaht(low)}</span>
        <span>{fmtBaht(high)}</span>
      </div>
    </div>
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

// Why this price: the base, each factor's share, and the unexplained rest. Hidden on error or when there is nothing to show.
function ExplanationSection({ data, loading, fmtBaht }) {
  const { t } = useLang();
  if (loading) {
    return (
      <Section title={t('explainTitle')} icon={BarChart3}>
        <div aria-hidden="true" className="animate-pulse rounded-xl bg-surface-soft h-24" />
      </Section>
    );
  }
  if (!data) return null;
  const maxAbs = Math.max(0, ...data.groups.map((g) => Math.abs(g.pct)));
  return (
    <Section title={t('explainTitle')} icon={BarChart3}>
      <div className="space-y-3 rounded-2xl border border-line p-3 text-xs">
        <p className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 text-ink-secondary">{t('explainBase')}</span>
          <span className="shrink-0 font-display font-bold tabular-nums text-ink-primary">{fmtBaht(data.base_price)}</span>
        </p>
        <ul className="space-y-2.5">
          {data.groups.map((g) => {
            const labelKey = groupLabelKey(g.key);
            const positive = g.pct >= 0;
            return (
              <li key={g.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 break-words text-ink-secondary">{labelKey ? t(labelKey) : g.key}</span>
                  <span className="shrink-0 tabular-nums text-ink-primary">{signedPct(g.pct)}</span>
                </div>
                <div aria-hidden="true" className="relative mt-1 h-1.5 w-full rounded-full bg-surface-soft">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
                  <div
                    className={`absolute inset-y-0 rounded-full ${positive ? 'left-1/2 bg-[#DC2626]/60' : 'right-1/2 bg-ink-muted/50'}`}
                    style={{ width: `${barWidth(g.pct, maxAbs)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="flex items-baseline justify-between gap-2 text-ink-muted">
          <span className="min-w-0">{t('explainOther')}</span>
          <span className="shrink-0 tabular-nums">{signedPct(data.other_pct)}</span>
        </p>
        <details>
          <summary className="cursor-pointer text-ink-secondary">{t('explainDetail')}</summary>
          <ul className="mt-2 space-y-1">
            {data.top_features.map((f) => (
              <li key={f.key} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 break-words text-ink-secondary">{f.label}</span>
                <span className="shrink-0 tabular-nums text-ink-primary">{signedPct(f.pct)}</span>
              </li>
            ))}
          </ul>
        </details>
        <p className="text-[11px] leading-relaxed text-ink-muted">{t('explainNote')}</p>
      </div>
    </Section>
  );
}

export default function PricePanel({ target, onClearTarget, onClose }) {
  const { t } = useLang();
  // Baht amounts use the active language's unit labels.
  const fmtBaht = (value) => formatBaht(value, { million: t('mthb'), baht: t('thb') });
  const [form, setForm] = useState(DEFAULT_FORM);
  const health = useHealth();

  const patch = (fields) => setForm((f) => ({ ...f, ...fields }));

  // A new target (map click, listing or project pin) writes its fields into the form.
  useEffect(() => {
    if (target) setForm((f) => ({ ...f, ...targetPatch(target) }));
  }, [target]);

  const inCoverage = !target || isInCoverage(target.lat, target.lng);
  const payload = inCoverage ? toPayload(form, target) : null;
  const { result, resultPayload, running, error } = usePrediction(payload);

  const point = target?.point ?? null;
  const pointTitle = point ? (point.kind === 'listing' ? point.title : point.name) : null;
  const coords = target ? `${target.lat.toFixed(5)}, ${target.lng.toFixed(5)}` : '';
  const pointPlace = point ? `${point.district} · ${point.province}` : coords;

  // A response missing the fields the panel reads counts as an error, not a crash.
  const usable = isUsableResult(result);
  const failed = Boolean(error) || (Boolean(result) && !usable);
  const showResult = inCoverage && !failed && Boolean(result);
  // The stale result belongs to the current target only when its lat and lng match.
  const resultIsCurrent = Boolean(resultPayload) && resultPayload.lat === payload?.lat && resultPayload.lng === payload?.lng;
  // The explanation is fetched only for the result on screen, after its prediction has settled.
  const explained = useExplanation(showResult && resultIsCurrent ? resultPayload : null);
  const predicted = showResult ? result.predictedPrice : 0;
  const isListing = target?.source === 'listing' && point?.kind === 'listing';
  const priced = isListing && point.group !== 'other';
  // The gap compares the listing with the shown estimate only when size and type match it.
  const gapComparable = priced && resultIsCurrent && predicted > 0 && gapApplies(point.area, listingPropertyType(point.group), resultPayload);
  const gap = gapComparable ? askingGap(point.price, predicted) : null;
  const gapTone = gap == null ? '' : gap > 10 ? 'text-[#DC2626]' : gap < -10 ? 'text-[#16a34a]' : 'text-ink-secondary';
  const gapVerdict = gap == null ? '' : gap > 10 ? t('askingAbove') : gap < -10 ? t('askingBelow') : t('askingNear');
  const gapStyle = gapColors(gap);

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
  const maxPpsqm = compRows.reduce((m, r) => Math.max(m, r.ppsqm), 0);

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
        <Section title={t('location')} icon={MapPin}>
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

        <Section title={t('propertyType')} icon={Home}>
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

        {inCoverage && failed && (
          <div role="alert" className="rounded-lg border border-[#DC2626]/30 bg-red-50 p-3 text-sm text-[#DC2626]">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={15} className="shrink-0" aria-hidden="true" />{t('apiError')}</p>
            {error && <p className="mt-1 break-words text-xs text-[#991b1b]">{error}</p>}
          </div>
        )}

        {inCoverage && !failed && !result && running && (
          <div role="status" className="space-y-3">
            <p className="text-xs text-ink-secondary">{t('calculating')}</p>
            <div aria-hidden="true" className="animate-pulse rounded-xl bg-surface-soft h-28" />
            <div aria-hidden="true" className="animate-pulse rounded-xl bg-surface-soft h-16" />
          </div>
        )}

        {showResult && (
          <div aria-busy={running} className={`space-y-6 transition-opacity duration-200 ${running ? 'opacity-60' : 'opacity-100'}`}>
            <div className="space-y-2.5">
              <div className="rounded-2xl border border-line bg-gradient-to-br from-white to-red-50/40 p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{t('priceEstimate')}</p>
                <p className="font-display text-3xl font-extrabold text-ink-primary tabular-nums">{fmtBaht(result.predictedPrice)}</p>
                <DecisionBadge decision={result.decision} />
                <RangeBar
                  low={result.lowerBound}
                  mid={result.predictedPrice}
                  high={result.upperBound}
                  marker={isListing && resultIsCurrent && gap != null ? point.price : undefined}
                  markerClass={gapStyle.bg ?? ''}
                />
                {result.meta.estate_unmeasured && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700">
                    <Info size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{t('estateUnmeasured')}</span>
                  </p>
                )}
                {isLandCollateral(result.meta.collateral_type) && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{t('landLowAccuracy')}</span>
                  </p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-white/80 p-2.5 ring-1 ring-line">
                    <p className="flex items-center gap-1.5 text-ink-muted"><Target size={13} className="shrink-0" aria-hidden="true" />{t('withinHit')}</p>
                    <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-ink-primary">{result.meta.within_20pct.toLocaleString('en-US', { maximumFractionDigits: 1 })}%</p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-2.5 ring-1 ring-line">
                    <p className="flex items-center gap-1.5 text-ink-muted"><Percent size={13} className="shrink-0" aria-hidden="true" />{t('medianError')}</p>
                    <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-ink-primary">{result.meta.median_abs_pct_error.toLocaleString('en-US', { maximumFractionDigits: 1 })}%</p>
                  </div>
                </div>
                <dl className="mt-3 space-y-1 border-t border-line pt-3 text-xs">
                  <div className="flex gap-2"><dt className="shrink-0 text-ink-muted">{t('resolvedLocation')}</dt><dd className="min-w-0 text-ink-primary">{[result.meta.subdistrict, result.meta.district, result.meta.province].filter(Boolean).join(', ')}</dd></div>
                  {result.meta.project && (
                    <div className="flex gap-2"><dt className="shrink-0 text-ink-muted">{t('snappedProject')}</dt><dd className="min-w-0 text-ink-primary">{result.meta.project}</dd></div>
                  )}
                </dl>
              </div>

              {isListing && resultIsCurrent && (
                <div className={`rounded-2xl border border-l-4 p-4 ${gapStyle.border}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-ink-secondary">{t('askingPrice')}</span>
                    <span className="font-display text-base font-bold tabular-nums text-ink-primary">{fmtBaht(point.price)}</span>
                  </div>
                  {gap != null && (
                    <>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-xs text-ink-secondary">{t('askingVsEstimate')}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-bold tabular-nums ${gapStyle.pill} ${gapTone}`}>
                          <gapStyle.Arrow size={14} aria-hidden="true" />
                          {gap > 0 ? '+' : ''}{gap.toFixed(1)}%
                        </span>
                      </div>
                      <p className={`mt-1 text-xs ${gapTone}`}>{gapVerdict}</p>
                    </>
                  )}
                  {priced && gap == null && <p className="mt-2 text-xs leading-relaxed text-ink-secondary">{t('gapNotComparable')}</p>}
                  {!priced && <p className="mt-2 text-xs leading-relaxed text-ink-secondary">{t('typeUnsupported')}</p>}
                </div>
              )}
            </div>

            <Section title={t('comparables')} icon={Scale}>
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {compRows.map((row) => (
                  <li key={row.label} className="px-3 py-2 text-xs">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-ink-secondary">{row.label}</span>
                      <span className="text-right tabular-nums">
                        <span className="font-display font-bold text-ink-primary">{Math.round(row.ppsqm).toLocaleString('en-US')}</span>{' '}
                        <span className="text-ink-muted">{t('ppsqmUnit')}</span>
                        {row.n != null && <span className="ml-2 text-ink-muted">{`${row.n.toLocaleString('en-US')} ${t('listings')}`}</span>}
                      </span>
                    </div>
                    <div aria-hidden="true" className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-soft">
                      <div className="h-full rounded-full bg-[#DC2626]/25" style={{ width: `${maxPpsqm > 0 ? (row.ppsqm / maxPpsqm) * 100 : 0}%` }} />
                    </div>
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

            <ExplanationSection data={explained.explanation} loading={explained.loading} fmtBaht={fmtBaht} />

            <Section title={t('models')} icon={Layers}>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-soft" aria-hidden="true">
                {result.contributions.map((m) => (
                  <span key={m.name} style={{ width: `${(m.weight / weightSum) * 100}%`, background: m.color }} />
                ))}
              </div>
              <ul className="text-xs">
                {result.contributions.map((m) => (
                  <li key={m.name} className="flex items-center gap-2 py-1">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: m.color }} aria-hidden="true" />
                    <span className="flex-1 text-ink-secondary">{m.name}</span>
                    <span className="tabular-nums text-ink-muted">{Math.round((m.weight / weightSum) * 100)}%</span>
                    <span className="w-28 text-right tabular-nums text-ink-primary">{fmtBaht(m.prediction)}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <details>
              <summary className="cursor-pointer text-ink-secondary">{t('limitsTitle')}</summary>
              <ul className="mt-2 space-y-1 text-xs text-ink-muted">
                <li>{t('limitAsking')}</li>
                <li>{t('limitSnapshot')}</li>
                <li>{t('limitCoverage')}</li>
                <li>{t('limitLand')}</li>
              </ul>
            </details>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-line bg-surface-soft px-4 py-2.5">
        <p className="flex gap-1.5 text-[11px] leading-relaxed text-ink-secondary"><Info size={12} className="mt-0.5 shrink-0" aria-hidden="true" />{t('priceNotice')}</p>
      </footer>
    </div>
  );
}
