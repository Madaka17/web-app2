import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { BRAND, useLang, usePageMeta } from '../i18n.jsx';
import { AlertHost, useAlerts } from '../components/Alerts.jsx';
import { skyArt } from '../art.js';

const LANGS = [['th', 'TH'], ['en', 'EN'], ['zh', '中文']];

export default function LoginPage() {
  const { t, lang, setLang } = useLang();
  const { setAlert } = useAlerts();
  usePageMeta(`${t('login')} | ${BRAND}`, t('sample'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);

  const showNotice = (event) => {
    event?.preventDefault();
    setAlert({ type: 'sample' });
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-surface-soft p-3 sm:p-6">
      <div className="grid min-h-[min(852px,calc(100vh-3rem))] w-full max-w-[1024px] overflow-hidden rounded-xl bg-white lg:grid-cols-2">
        <div className="flex flex-col justify-center px-5 py-8 sm:px-12">
          <div className="flex items-center justify-between">
            <Link to="/map" className="font-display text-2xl text-primary">{BRAND}</Link>
            <div className="flex items-center gap-0.5 rounded-pill bg-surface-2 p-0.5 text-xs font-semibold">
              {LANGS.map(([key, label]) => (
                <button key={key} type="button" onClick={() => setLang(key)} className={`rounded-full px-2 py-0.5 transition-colors ${lang === key ? 'bg-primary text-white shadow-sm' : 'text-ink-muted hover:text-ink-primary'}`}>{label}</button>
              ))}
            </div>
          </div>
          <h1 className="mt-4 font-display text-3xl font-extrabold text-ink-primary">{t('login')}</h1>
          <form onSubmit={showNotice} className="mt-7 space-y-3" noValidate>
            <div>
              <label htmlFor="login-email" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{t('emailLabel')}</label>
              <input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input h-[42px] rounded-lg" />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{t('passwordLabel')}</label>
              <div className="relative">
                <input id="login-password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input h-[42px] rounded-lg pr-10" />
                <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <label className="flex items-center gap-2 text-ink-secondary"><input type="checkbox" className="h-4 w-4 accent-primary" />{t('remember')}</label>
              <button type="button" onClick={showNotice} className="font-medium text-primary hover:underline">{t('forgot')}</button>
            </div>
            <button type="submit" className="btn-primary btn-lg btn-pill w-full">{t('login')}</button>
          </form>
          <button type="button" onClick={showNotice} className="btn-outline btn-lg btn-pill mt-4 w-full">{t('google')}</button>
          <div className="my-5 flex items-center gap-3 text-xs text-ink-muted">
            <span className="h-px flex-1 bg-line" />
            {t('or')}
            <span className="h-px flex-1 bg-line" />
          </div>
          <button type="button" onClick={showNotice} className="btn-outline btn-lg btn-pill w-full">{t('signup')}</button>
        </div>
        <div className="hidden flex-col lg:flex">
          <img src={skyArt()} alt="" className="h-[153px] w-full object-cover" />
          <div className="flex flex-1 items-center justify-center">
            <svg viewBox="0 0 36 36" className="h-[330px] w-[330px]" aria-hidden="true">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#000" strokeWidth="3.6" />
            </svg>
          </div>
        </div>
      </div>
      <AlertHost />
    </div>
  );
}
