import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n.jsx';

export default function CookieBanner() {
  const { t } = useLang();
  const [open, setOpen] = useState(() => {
    try { return !localStorage.getItem('cookie-choice'); } catch { return true; }
  });
  const [details, setDetails] = useState(false);

  const choose = (value) => {
    try { localStorage.setItem('cookie-choice', value); } catch { /* storage is optional */ }
    setOpen(false);
    setDetails(false);
  };

  if (!open) return null;
  return createPortal(
    <>
      <aside
        className="cookie-consent-banner fixed z-[2100] bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] w-[min(calc(100%-1.5rem),20rem)] rounded-xl border border-border/60 bg-white p-3.5 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.35)] sm:bottom-6 sm:right-6 sm:w-[min(calc(100vw-3rem),22rem)] sm:p-4 md:w-[min(calc(100vw-3rem),24rem)] md:p-5"
        role="region"
        aria-labelledby="cookie-title"
        aria-describedby="cookie-desc"
      >
        <h2 id="cookie-title" className="font-display text-sm font-bold leading-snug text-ink-primary sm:text-base">{t('cookieTitle')}</h2>
        <p id="cookie-desc" className="mt-2 line-clamp-4 text-[11px] leading-snug text-ink-secondary sm:mt-2.5 sm:line-clamp-none sm:text-sm sm:leading-relaxed">{t('cookieBody')}</p>
        <div className="mt-3 flex flex-row items-stretch gap-1 sm:mt-4 sm:gap-2">
          <button type="button" onClick={() => choose('accept')} className="btn-primary btn-sm btn-pill cookie-action flex-1 leading-tight sm:flex-none sm:px-3 sm:text-xs">{t('accept')}</button>
          <button type="button" onClick={() => choose('reject')} className="btn-secondary btn-sm btn-pill cookie-action flex-1 leading-tight sm:flex-none sm:px-3 sm:text-xs">{t('reject')}</button>
          <button type="button" onClick={() => setDetails(true)} className="btn-outline btn-sm btn-pill cookie-action flex-1 leading-tight sm:flex-none sm:px-3 sm:text-xs">{t('viewDetails')}</button>
        </div>
        <div className="mt-2.5 flex flex-wrap justify-center gap-x-3 gap-y-0.5 border-t border-border/50 pt-2.5 text-[10px] sm:mt-3 sm:gap-x-4 sm:pt-3 sm:text-xs">
          <button type="button" onClick={() => setDetails(true)} className="font-medium text-primary underline-offset-2 hover:underline">{t('cookiePolicy')}</button>
          <Link className="font-medium text-primary underline-offset-2 hover:underline" to="/privacy-policy">{t('privacyPolicy')}</Link>
        </div>
      </aside>
      {details && (
        <div className="fixed inset-0 z-[3200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-primary/45 backdrop-blur-sm" aria-hidden="true" onClick={() => setDetails(false)} />
          <div role="dialog" aria-modal="true" aria-label={t('cookiePolicy')} className="relative w-full max-w-md rounded-2xl bg-white p-5">
            <h3 className="font-display text-lg font-bold">{t('cookiePolicy')}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">This sample site keeps your cookie choice and language in this browser only. It does not send them anywhere.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => choose('reject')} className="btn-secondary btn-sm btn-pill">{t('reject')}</button>
              <button type="button" onClick={() => choose('accept')} className="btn-primary btn-sm btn-pill">{t('accept')}</button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
