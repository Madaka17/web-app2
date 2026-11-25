import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { BRAND, useLang } from '../i18n.jsx';
import { Flag } from './Flags.jsx';
import { AlertHost } from './Alerts.jsx';

const LANGS = [
  { key: 'th', label: 'TH' },
  { key: 'en', label: 'EN' },
  { key: 'zh', label: '中文' },
];

const RING_SRC = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="653" height="653" viewBox="0 0 36 36"><circle cx="22" cy="18" r="12" fill="none" stroke="#111" stroke-width="3.6"/><path d="M13.5 26.5 A12 12 0 0 0 22 30" fill="none" stroke="#d32f2f" stroke-width="3.6"/></svg>')}`;

/** tone: 'map' (white), 'white' (white, back link) or 'red' (red, back link). */
export default function Header({ tone }) {
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();
  const [langOpen, setLangOpen] = useState(false);
  const red = tone === 'red';
  const langBox = useRef(null);

  useEffect(() => {
    if (!langOpen) return undefined;
    const close = (event) => {
      if (langBox.current && !langBox.current.contains(event.target)) setLangOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [langOpen]);

  const hoverBg = red ? 'hover:bg-white/10' : 'hover:bg-surface-2';

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-critical flex h-[var(--nav-h)] items-center border-b backdrop-blur-md transition-colors ${red ? 'border-white/15 bg-primary/95 text-white' : 'border-line bg-white/90 text-ink-primary'}`}>
        <div className="mx-auto flex w-full max-w-container items-center gap-1.5 overflow-x-clip pl-4 pr-[max(1.5rem,env(safe-area-inset-right,0px))] sm:gap-2 sm:px-6 lg:gap-2 lg:px-6 xl:gap-3 xl:px-8">
          <Link aria-label={BRAND} className="flex shrink-0 items-center font-brand text-[20px] leading-none tracking-[-0.06em] sm:text-[22px] lg:text-[24px] xl:text-[30px]" to="/map" style={{ fontWeight: 800 }}>
            <img src={RING_SRC} alt={BRAND} className="h-6 w-auto sm:h-7 lg:h-7 xl:h-9" />
            <span className={`inline-flex items-baseline ${red ? 'text-white' : 'text-ink-primary'}`}>penPlot</span>
          </Link>

          {tone !== 'map' && (
            <button
              type="button"
              onClick={() => navigate('/map')}
              className={`inline-flex h-9 min-w-0 max-w-[min(38vw,10.5rem)] shrink items-center gap-1 rounded-full border px-2.5 text-sm font-semibold transition-colors sm:h-10 sm:max-w-none sm:shrink-0 sm:gap-2 sm:px-4 lg:h-8 lg:text-xs ${red ? 'border-white/30 bg-white/10 text-white hover:bg-white/15' : 'border-line bg-white text-ink-primary hover:bg-surface-2'}`}
            >
              <ChevronLeft size={16} className="shrink-0" />
              <span className="truncate">{t('backToMap')}</span>
            </button>
          )}

          <div className="flex min-w-0 flex-1 justify-center overflow-hidden px-0.5 sm:px-2 lg:px-2 xl:px-4">
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-2 xl:gap-4">
            <div className={`hidden items-center gap-0.5 rounded-pill p-0.5 text-xs font-semibold sm:flex ${red ? 'bg-white/15' : 'bg-surface-2'}`}>
              {LANGS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setLang(item.key)}
                  className={`rounded-full px-1.5 py-0.5 transition-colors xl:px-2 ${lang === item.key ? 'bg-primary text-white shadow-sm' : red ? 'text-white/70 hover:text-white' : 'text-ink-muted hover:text-ink-primary'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-0.5 lg:gap-2 xl:gap-3">
              <div className="relative sm:hidden" ref={langBox}>
                <button type="button" aria-label="Choose language" aria-expanded={langOpen} onClick={() => setLangOpen((v) => !v)} className={`flex h-10 w-9 items-center justify-center rounded-full text-[1.15rem] leading-none transition-colors ${hoverBg}`}>
                  <Flag lang={lang} className="h-[18px] w-[27px]" />
                </button>
                {langOpen && (
                  <div role="menu" className="absolute right-0 top-full z-[60] mt-0 w-36 overflow-hidden rounded-xl border border-line bg-white p-1 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)]">
                    {LANGS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        role="menuitem"
                        onClick={() => { setLang(item.key); setLangOpen(false); }}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold ${lang === item.key ? 'bg-primary/10 text-primary' : 'text-ink-primary hover:bg-surface-2'}`}
                      >
                        <Flag lang={item.key} className="h-[18px] w-[27px]" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <AlertHost />
    </>
  );
}
