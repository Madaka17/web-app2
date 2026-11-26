import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, FileImage, Loader2, PencilLine, Plus, Printer, Trash2 } from 'lucide-react';
import { BRAND, useLang, usePageMeta } from '../i18n.jsx';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import {
  CATEGORIES, DEFAULT_SETTINGS, NOT_INCLUDED_TH, PRESETS, PRICE_SOURCE, ROOM_TYPES, estimate, toCsv,
} from '../lib/buildCost';
import { PlanReadError, readPlan } from '../lib/planApi';

const EMPTY_ROOM = { name: '', type: 'bedroom', width_m: 3, length_m: 3 };
const ERROR_KEYS = new Set(['bad_image', 'limit_ip', 'limit_day', 'busy', 'config', 'unreadable', 'upstream']);
const errorKey = (code) => `bcErr_${code === 'budget' ? 'limit_day' : ERROR_KEYS.has(code) ? code : 'upstream'}`;
const baht = (n) => (n == null ? '–' : n.toLocaleString('th-TH', { maximumFractionDigits: 2 }));
const monthLabel = (m) => {
  if (!m) return '';
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('th-TH', { month: 'short', year: 'numeric' });
};

function Card({ title, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-4 sm:p-6 ${className}`}>
      <h2 className="mb-4 font-display text-lg font-bold text-ink-primary">{title}</h2>
      {children}
    </section>
  );
}

function Num({ label, value, onChange, step = 0.1, min = 0, max }) {
  return (
    <label className="block text-xs font-semibold text-ink-secondary">
      {label}
      <input
        type="number" inputMode="decimal" step={step} min={min} max={max}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        className="input mt-1 py-2 text-sm"
      />
    </label>
  );
}

function Pills({ value, options, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          className={`rounded-pill border px-3 py-1.5 text-sm transition-colors ${value === o.id ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink-primary hover:border-primary/50'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function BuildCostPage() {
  const { t } = useLang();
  usePageMeta(`${t('bcTitle')} | ${BRAND}`, t('bcLead'));
  const [plan, setPlan] = useState(null);
  const [floors, setFloors] = useState(1);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [presetId, setPresetId] = useState('standard');
  const [selection, setSelection] = useState(PRESETS.standard);
  const [reading, setReading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  const abort = useRef(null);

  useEffect(() => () => abort.current?.abort(), []);

  const result = useMemo(() => (plan ? estimate(plan, settings, selection) : null), [plan, settings, selection]);

  const onFile = async (file) => {
    if (!file) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setError(null);
    setReading(true);
    setSeconds(0);
    try {
      const read = await readPlan(file, controller.signal, setSeconds);
      const { floors: f, ...rest } = read;
      setFloors(f);
      setPlan(rest);
    } catch (e) {
      if (e.name !== 'AbortError') setError(e instanceof PlanReadError ? e.code : 'upstream');
    } finally {
      if (abort.current === controller) setReading(false);
    }
  };

  const cancel = () => {
    abort.current?.abort();
    setReading(false);
  };

  const manual = () => {
    setError(null);
    setFloors(1);
    setPlan({ rooms: [{ ...EMPTY_ROOM, name: t('rt_living'), type: 'living', width_m: 4, length_m: 4 }], doors: 1, windows: 1, exterior_wall_m: 16, interior_wall_m: 0 });
  };

  const patchPlan = (patch) => setPlan((p) => ({ ...p, ...patch }));
  const patchRoom = (i, patch) => setPlan((p) => ({ ...p, rooms: p.rooms.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const patchSettings = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const choosePreset = (id) => {
    setPresetId(id);
    setSelection(PRESETS[id]);
  };
  const choose = (cat, opt) => {
    setPresetId(null);
    setSelection((s) => ({ ...s, [cat]: opt }));
  };

  const downloadCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(result)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'material-list.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const catLabel = (id) => (id === 'common' ? t('bcCommon') : CATEGORIES.find((c) => c.id === id)?.label_th ?? id);
  const grouped = result
    ? [...CATEGORIES.map((c) => c.id), 'common']
      .map((id) => ({ id, lines: result.lines.filter((l) => l.category === id) }))
      .filter((g) => g.lines.length)
    : [];

  return (
    <div className="min-h-full bg-surface-soft">
      <div className="print:hidden"><Header tone="white" /></div>
      <main className="pt-[var(--nav-h)] print:pt-0">
        <div className="mx-auto w-full max-w-container space-y-5 px-4 py-6 sm:px-6 lg:px-8">
          <header>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-primary sm:text-3xl">{t('bcTitle')}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-secondary sm:text-base">{t('bcLead')}</p>
          </header>

          <Card title={t('bcStep1')} className="print:hidden">
            <p className="mb-3 text-sm text-ink-secondary">{t('bcUploadHint')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className={`btn-primary btn-md btn-pill inline-flex cursor-pointer items-center gap-2 ${reading ? 'pointer-events-none opacity-60' : ''}`}>
                <FileImage size={16} /> {t('bcChoose')}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={reading}
                  onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <button type="button" onClick={manual} disabled={reading} className="btn-outline btn-md btn-pill inline-flex items-center gap-2 disabled:opacity-60">
                <PencilLine size={16} /> {t('bcManual')}
              </button>
            </div>
            <p className="mt-3 text-xs text-ink-muted">{t('bcPrivacy')}</p>
            {reading && (
              <div role="status" className="mt-4 flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-primary">
                <Loader2 size={18} className="animate-spin" />
                <span className="flex-1">{t('bcReading')} ({seconds}s)</span>
                <button type="button" onClick={cancel} className="text-xs font-semibold text-primary">{t('bcCancel')}</button>
              </div>
            )}
            {error && <p role="alert" className="mt-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">{t(errorKey(error))}</p>}
          </Card>

          {plan && (
            <Card title={t('bcStep2')} className="print:hidden">
              <p className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900"><AlertTriangle size={16} className="shrink-0" /> {t('bcCheckWarn')}</p>
              {floors > 1 && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('bcFloorsWarn')}</p>}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-muted">
                      <th className="pb-2 font-semibold">{t('bcRoom')}</th>
                      <th className="pb-2 font-semibold">{t('bcType')}</th>
                      <th className="pb-2 font-semibold">{t('bcWidth')}</th>
                      <th className="pb-2 font-semibold">{t('bcLength')}</th>
                      <th className="pb-2 text-right font-semibold">{t('sqm')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {plan.rooms.map((r, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="py-1.5 pr-2"><input aria-label={t('bcRoom')} className="input py-1.5 text-sm" value={r.name} onChange={(e) => patchRoom(i, { name: e.target.value })} /></td>
                        <td className="py-1.5 pr-2">
                          <select aria-label={t('bcType')} className="input py-1.5 text-sm" value={r.type} onChange={(e) => patchRoom(i, { type: e.target.value })}>
                            {ROOM_TYPES.map((rt) => <option key={rt} value={rt}>{t(`rt_${rt}`)}</option>)}
                          </select>
                        </td>
                        <td className="w-24 py-1.5 pr-2"><input aria-label={t('bcWidth')} type="number" step="0.1" min="0" className="input py-1.5 text-sm" value={r.width_m} onChange={(e) => patchRoom(i, { width_m: Number(e.target.value) })} /></td>
                        <td className="w-24 py-1.5 pr-2"><input aria-label={t('bcLength')} type="number" step="0.1" min="0" className="input py-1.5 text-sm" value={r.length_m} onChange={(e) => patchRoom(i, { length_m: Number(e.target.value) })} /></td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{baht((r.width_m || 0) * (r.length_m || 0))}</td>
                        <td className="py-1.5 text-right">
                          <button type="button" aria-label={t('bcRemove')} disabled={plan.rooms.length === 1} onClick={() => patchPlan({ rooms: plan.rooms.filter((_, j) => j !== i) })} className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2 hover:text-primary disabled:opacity-30">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <button type="button" onClick={() => patchPlan({ rooms: [...plan.rooms, { ...EMPTY_ROOM, name: `${t('bcRoom')} ${plan.rooms.length + 1}` }] })} className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  <Plus size={16} /> {t('bcAddRoom')}
                </button>
                <span className="text-sm text-ink-secondary">{t('bcFloorArea')}: <b className="tabular-nums text-ink-primary">{baht(result?.bases.floor)}</b> {t('sqm')}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Num label={t('bcDoors')} step={1} value={plan.doors} onChange={(v) => patchPlan({ doors: v })} />
                <Num label={t('bcWindows')} step={1} value={plan.windows} onChange={(v) => patchPlan({ windows: v })} />
                <Num label={t('bcExtWall')} value={plan.exterior_wall_m} onChange={(v) => patchPlan({ exterior_wall_m: v })} />
                <Num label={t('bcIntWall')} value={plan.interior_wall_m} onChange={(v) => patchPlan({ interior_wall_m: v })} />
                <Num label={t('bcWallHeight')} value={settings.wall_height_m} onChange={(v) => patchSettings({ wall_height_m: v })} />
                <Num label={t('bcPitch')} step={1} max={60} value={settings.roof_pitch_deg} onChange={(v) => patchSettings({ roof_pitch_deg: v })} />
                <Num label={t('bcOverhang')} value={settings.roof_overhang_m} onChange={(v) => patchSettings({ roof_overhang_m: v })} />
                <div className="text-xs font-semibold text-ink-secondary">
                  {t('bcRoofShape')}
                  <div className="mt-1">
                    <Pills label={t('bcRoofShape')} value={settings.roof_shape} onChange={(v) => patchSettings({ roof_shape: v })}
                      options={[{ id: 'gable', label: t('bcGable') }, { id: 'hip', label: t('bcHip') }]} />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {plan && (
            <Card title={t('bcStep3')} className="print:hidden">
              <Pills label={t('bcStep3')} value={presetId} onChange={choosePreset}
                options={[{ id: 'economy', label: t('bcEconomy') }, { id: 'standard', label: t('bcStandard') }, { id: 'premium', label: t('bcPremium') }]} />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {CATEGORIES.filter((c) => !c.fixed).map((c) => (
                  <div key={c.id}>
                    <p className="mb-1.5 text-xs font-semibold text-ink-secondary">{c.label_th}</p>
                    <Pills label={c.label_th} value={selection[c.id]} onChange={(v) => choose(c.id, v)}
                      options={c.options.map((o) => ({ id: o.id, label: o.label_th }))} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title={t('bcStep4')}>
            {!result ? (
              <p className="text-sm text-ink-muted">{t('bcEmpty')}</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-ink-muted">
                        <th className="pb-2 font-semibold">{t('bcItem')}</th>
                        <th className="pb-2 text-right font-semibold">{t('bcQty')}</th>
                        <th className="pb-2 pl-3 font-semibold">{t('bcUnit')}</th>
                        <th className="pb-2 text-right font-semibold">{t('bcUnitPrice')}</th>
                        <th className="pb-2 text-right font-semibold">{t('bcTotal')}</th>
                      </tr>
                    </thead>
                    {grouped.map((g) => (
                      <tbody key={g.id}>
                        <tr><td colSpan={5} className="pb-1 pt-4 text-xs font-bold text-primary">{catLabel(g.id)}</td></tr>
                        {g.lines.map((l) => (
                          <tr key={l.item} className="border-t border-line align-top">
                            <td className="py-2 pr-2">
                              {l.name_th}
                              {(l.missing || !l.verified) && (
                                <span className="block text-xs text-ink-muted">
                                  {l.missing ? `${l.missing} · ${t('bcNoPrice')}` : t('bcApprox')}
                                </span>
                              )}
                            </td>
                            <td className="py-2 text-right tabular-nums">{baht(l.qty)}</td>
                            <td className="py-2 pl-3 text-ink-secondary">{l.unit_th}</td>
                            <td className="py-2 text-right tabular-nums">
                              {baht(l.unit_price)}
                              {l.month && <span className="block text-[11px] text-ink-muted">{monthLabel(l.month)}</span>}
                            </td>
                            <td className="py-2 text-right font-semibold tabular-nums">{baht(l.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    ))}
                    <tfoot className="border-t-2 border-ink-primary/20">
                      <tr><td colSpan={4} className="pt-3 text-right text-ink-secondary">{t('bcSubtotal')}</td><td className="pt-3 text-right tabular-nums">{baht(result.subtotal)}</td></tr>
                      <tr><td colSpan={4} className="text-right text-ink-secondary">{t('bcVat')}</td><td className="text-right tabular-nums">{baht(result.vat)}</td></tr>
                      <tr><td colSpan={4} className="pt-1 text-right text-base font-bold">{t('bcGrand')}</td><td className="pt-1 text-right text-base font-bold tabular-nums text-primary">{baht(result.total)}</td></tr>
                    </tfoot>
                  </table>
                </div>

                <div className="mt-5 space-y-2 text-xs leading-5 text-ink-secondary">
                  <p className="font-semibold text-ink-primary">{t('bcDisclaimer')}</p>
                  <p>
                    <a href={PRICE_SOURCE.url} target="_blank" rel="noopener noreferrer" className="underline">{t('bcPriceSource')}</a>
                    {' · '}{t('bcPriceMonths')}: {monthLabel(result.months.oldest)}–{monthLabel(result.months.newest)}
                  </p>
                  <p>{t('bcQtySource')}</p>
                  <p>{t('bcNotIncluded')}: {NOT_INCLUDED_TH.join(' · ')}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 print:hidden">
                  <button type="button" onClick={() => window.print()} className="btn-outline btn-md btn-pill inline-flex items-center gap-2"><Printer size={16} /> {t('bcPrint')}</button>
                  <button type="button" onClick={downloadCsv} className="btn-outline btn-md btn-pill inline-flex items-center gap-2"><Download size={16} /> {t('bcCsv')}</button>
                </div>
              </>
            )}
          </Card>
        </div>
        <div className="print:hidden"><Footer /></div>
      </main>
    </div>
  );
}
