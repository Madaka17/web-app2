import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bell, Building2, ChevronLeft, House, Lock, Menu, MessageCircle, ShoppingCart, X } from 'lucide-react';
import { BRAND, useLang } from '../i18n.jsx';
import { Flag } from './Flags.jsx';
import { AlertHost, useAlerts } from './Alerts.jsx';

const LANGS = [
  { key: 'th', label: 'TH' },
  { key: 'en', label: 'EN' },
  { key: 'zh', label: '中文' },
];

const RING_SRC = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="653" height="653" viewBox="0 0 36 36"><circle cx="22" cy="18" r="12" fill="none" stroke="#111" stroke-width="3.6"/><path d="M13.5 26.5 A12 12 0 0 0 22 30" fill="none" stroke="#d32f2f" stroke-width="3.6"/></svg>')}`;

const NAV = [
  { to: '/new-land', key: 'newListings' },
  { to: '/news', key: 'news' },
  { to: '/contact', key: 'about' },
];

/** tone: 'map' (white, with mode tabs), 'white' (white, back link) or 'red' (red, back link). */
export default function Header({ tone, mode, onSelectMode }) {
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { signIn } = useAlerts();
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
  const tabs = [
    { key: 'future', icon: Building2 },
    { key: 'land', icon: House },
    { key: 'lease', icon: Lock },
  ];

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
            {tone === 'map' && (
              <div role="tablist" aria-label="Map mode" className="flex w-full max-w-[min(100%,11.5rem)] shrink items-center gap-0.5 rounded-full border border-line bg-white p-0.5 transition-colors sm:max-w-[min(100%,13rem)] sm:gap-1 sm:p-1 lg:max-w-[12.5rem] lg:gap-0.5 lg:p-1 xl:max-w-[min(100%,44rem)] xl:gap-1 xl:p-1">
                {tabs.map(({ key, icon: Icon }) => {
                  const selected = mode === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-disabled={key === 'lease'}
                      title={t(key)}
                      onClick={() => onSelectMode(key)}
                      className={`flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-1.5 text-xs font-semibold transition-colors sm:h-9 sm:px-2 lg:h-8 lg:px-1.5 xl:h-7 xl:gap-1.5 xl:px-3 xl:text-xs ${selected ? 'bg-primary text-white shadow-sm' : 'text-ink-primary hover:bg-surface-2'} ${key === 'lease' ? 'opacity-50' : ''}`}
                    >
                      <span className="shrink-0"><Icon className="size-[18px] sm:size-4 lg:size-3.5" /></span>
                      <span className="hidden whitespace-nowrap xl:inline">{t(key)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-2 xl:gap-4">
            <nav className="hidden items-center gap-1.5 lg:flex xl:gap-2">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `relative rounded-md px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors xl:px-3 xl:text-sm after:absolute after:inset-x-2 after:-bottom-0.5 after:h-[2px] after:rounded-full xl:after:inset-x-3 ${isActive ? `after:opacity-100 ${red ? 'text-white after:bg-white' : 'text-primary after:bg-primary'}` : `after:opacity-0 ${red ? 'text-white/80 hover:text-white' : 'text-ink-secondary hover:text-ink-primary'}`}`}
                >
                  {t(item.key)}
                </NavLink>
              ))}
            </nav>
            <button type="button" onClick={signIn} className={`relative hidden h-9 w-9 items-center justify-center rounded-full transition-colors sm:flex ${hoverBg}`} aria-label="Notifications">
              <Bell size={18} />
            </button>
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
            <button type="button" onClick={() => navigate('/auth/login')} className={`hidden rounded-pill px-4 py-2 text-sm font-bold transition-colors sm:px-5 lg:block ${red ? 'bg-white text-primary hover:bg-white/90' : 'bg-primary text-white hover:bg-primary-dark'}`}>
              {t('login')}
            </button>
            <div className="flex shrink-0 items-center gap-0.5 lg:gap-2 xl:gap-3">
              <button type="button" onClick={() => setDrawer(true)} className={`flex h-10 w-9 items-center justify-center rounded-full transition-colors lg:hidden ${hoverBg}`} aria-label="menu">
                <Menu size={20} />
              </button>
              <button type="button" onClick={signIn} aria-label="Chats" className={`relative flex h-10 w-9 items-center justify-center rounded-full transition-colors lg:h-9 lg:w-9 ${red ? 'text-white hover:bg-white/10' : 'text-ink-secondary hover:bg-surface-2 hover:text-ink-primary'}`}>
                <MessageCircle className="size-5 lg:size-[18px]" />
              </button>
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
              <button type="button" onClick={signIn} className={`relative flex h-10 w-9 items-center justify-center rounded-full transition-colors lg:h-9 lg:w-9 ${hoverBg}`} aria-label="Cart">
                <ShoppingCart className="size-5 lg:size-[18px]" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {drawer && (
        <div className="fixed inset-0 z-[9999] lg:hidden">
          <div className="absolute inset-0 bg-ink-primary/40 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <aside className="anim-drawer absolute right-0 top-0 h-full w-[82%] max-w-sm overflow-y-auto bg-white shadow-panel">
            <div className="flex h-[var(--nav-h)] items-center justify-between border-b border-line px-4">
              <span className="font-display text-[22px] leading-none tracking-[-0.035em]" style={{ fontWeight: 800 }}>
                <span className="text-ink-primary">Open</span><span className="text-primary">Plot</span>
              </span>
              <button type="button" onClick={() => setDrawer(false)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-2" aria-label="close"><X size={20} /></button>
            </div>
            <nav className="p-3">
              {NAV.map((item) => (
                <Link key={item.to} className="flex items-center rounded-xl px-4 py-3 text-base font-semibold text-ink-primary hover:bg-surface-2" to={item.to} onClick={() => setDrawer(false)}>
                  {t(item.key)}
                </Link>
              ))}
            </nav>
            <div className="mt-2 border-t border-line p-3 pt-4">
              <div className="space-y-2">
                <button type="button" onClick={() => { setDrawer(false); navigate('/auth/login'); }} className="btn-primary btn-lg w-full rounded-pill">{t('signup')}</button>
                <button type="button" onClick={() => { setDrawer(false); navigate('/auth/login'); }} className="btn-outline btn-lg w-full rounded-pill">{t('login')}</button>
              </div>
              <div className="mt-4 flex justify-center">
                <div className="flex items-center gap-0.5 rounded-pill bg-surface-2 p-0.5 text-xs font-semibold">
                  {LANGS.map((item) => (
                    <button key={item.key} type="button" onClick={() => setLang(item.key)} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors ${lang === item.key ? 'bg-primary text-white shadow-sm' : 'text-ink-muted hover:text-ink-primary'}`}>
                      <Flag lang={item.key} className="h-3.5 w-[21px]" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
      <AlertHost />
    </>
  );
}
