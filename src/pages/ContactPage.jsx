import { useState } from 'react';
import { ChevronRight, Mail, MessageSquare, Phone, Send, User } from 'lucide-react';
import { BRAND, useLang, usePageMeta } from '../i18n.jsx';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { portraitArt } from '../art.js';

const PEOPLE = [
  { name: 'ALEX SAMPLE', role: 'Founder & CEO', art: 'a', pos: 'center 18%', blurb: 'Visionary leader driving technological innovation in property markets.' },
  { name: 'JORDAN EXAMPLE', role: 'Co-Founder & COO', art: 'b', pos: 'center 12%', blurb: 'Expert in operational excellence and strategic ecosystem development.' },
];

function Field({ label, required, icon: Icon, type = 'text', value, onChange, autoComplete }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-ink-primary">{label}{required && <span className="text-primary"> *</span>}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"><Icon size={14} /></span>
        <input className="input py-2 pl-9 text-sm" type={type} autoComplete={autoComplete} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function ContactRow({ href, icon: Icon, label, value }) {
  return (
    <a href={href} className="flex items-center gap-3 rounded-xl border border-line bg-surface-soft px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-white">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-wide text-ink-muted">{label}</span>
        <span className="block truncate text-sm font-bold text-ink-primary">{value}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-ink-muted" />
    </a>
  );
}

export default function ContactPage() {
  const { t } = useLang();
  usePageMeta(`About Us | ${BRAND}`, 'Sample company page for a land data platform.');
  const [form, setForm] = useState({ name: '', mobile: '', email: '', message: '' });
  const [status, setStatus] = useState(null);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.mobile.trim() || !form.email.trim()) {
      setStatus('error');
      return;
    }
    setStatus('sent');
    setForm({ name: '', mobile: '', email: '', message: '' });
  };

  return (
    <div className="min-h-full bg-surface-soft">
      <Header tone="red" />
      <main className="min-h-[calc(100vh-var(--nav-h))] pt-[var(--nav-h)]">
        <div className="bg-surface-2 py-8 sm:py-12">
          <div className="mx-auto w-full max-w-container px-4 sm:px-6 lg:px-8">
            <header className="mb-7 sm:mb-9">
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink-primary sm:text-5xl">{t('about')}</h1>
              <div className="mt-3 h-1 w-16 rounded-full bg-primary" />
              <p className="mt-4 max-w-2xl text-base leading-8 text-ink-secondary sm:text-lg sm:leading-9">{t('aboutLead')}</p>
            </header>
            <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
              <div className="space-y-7 lg:col-span-8">
                <section className="relative overflow-hidden rounded-2xl bg-primary">
                  <div className="absolute bottom-4 right-6 font-serif text-8xl leading-none text-white/15" aria-hidden="true">”</div>
                  <div className="relative border-l-4 border-white/35 px-5 py-7 sm:px-8 sm:py-8">
                    <p className="font-sans text-lg font-medium italic leading-[1.7] tracking-normal text-white sm:text-xl sm:leading-9 md:text-2xl md:leading-10">
                      We believe <span className="font-bold text-white">open data</span>, <span className="font-bold text-white">shared tools</span>, and <span className="font-bold text-white">smart search</span> can move the local property market from paper records to a clear and simple online platform that anyone can use with real confidence.
                    </p>
                  </div>
                </section>
                <section>
                  <h2 className="mb-4 flex items-center gap-3 font-display text-[34px] font-extrabold tracking-tight text-ink-primary">
                    <span className="h-[3px] w-8 rounded bg-primary" />
                    {t('leadership')}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {PEOPLE.map((person) => (
                      <article key={person.name} className="overflow-hidden rounded-2xl border border-line bg-white">
                        <div className="relative aspect-[4/3] overflow-hidden bg-surface-soft">
                          <img src={portraitArt(person.art)} alt={person.name} className="h-full w-full object-cover" style={{ objectPosition: person.pos }} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent" />
                        </div>
                        <div className="space-y-2 px-5 py-4">
                          <span className="inline-flex rounded-full bg-primary px-3 py-1 text-xs font-semibold tracking-wide text-white">{person.role}</span>
                          <h3 className="font-display text-[24px] font-bold leading-tight tracking-tight text-ink-primary sm:text-[26px]">{person.name}</h3>
                          <p className="text-[15px] leading-7 text-ink-secondary">{person.blurb}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
              <div className="lg:col-span-4">
                <aside className="space-y-4">
                  <section className="overflow-hidden rounded-2xl border border-line bg-white p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-gradient-to-br from-primary/20 to-primary/5 p-0.5">
                        <img src={portraitArt('a')} alt="Alex" className="h-24 w-24 rounded-full object-cover ring-2 ring-white sm:h-28 sm:w-28" style={{ objectPosition: 'center 18%' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-[30px] font-extrabold leading-tight tracking-tight text-ink-primary">Alex</p>
                        <p className="mt-1 text-xs font-semibold tracking-[0.08em] text-primary">ALEX SAMPLE</p>
                      </div>
                    </div>
                    <div className="mt-5 space-y-2.5">
                      <ContactRow href="#contact-form" icon={MessageSquare} label={t('lineId')} value="sample-line-id" />
                      <ContactRow href="tel:0000000000" icon={Phone} label={t('phoneNo')} value="000 000 0000" />
                    </div>
                    <a href="mailto:hello@example.com" className="btn btn-lg btn-pill mt-5 inline-flex w-full items-center justify-center gap-2 border border-primary bg-primary font-semibold text-white transition-colors hover:bg-primary/90 hover:text-white">
                      <Send size={16} />
                      {t('sendMessage')}
                    </a>
                  </section>
                  <section id="contact-form" className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
                    <div className="bg-primary px-3 py-2 text-center">
                      <h2 className="font-display text-base font-bold tracking-wide text-white">{t('contactUs')}</h2>
                    </div>
                    <form onSubmit={submit} className="space-y-3 bg-surface-soft/60 p-4" noValidate>
                      <Field label={t('fullName')} required icon={User} autoComplete="name" value={form.name} onChange={set('name')} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label={t('mobile')} required icon={Phone} type="tel" autoComplete="tel" value={form.mobile} onChange={set('mobile')} />
                        <Field label={t('email')} required icon={Mail} type="email" autoComplete="email" value={form.email} onChange={set('email')} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-ink-primary">{t('message')}</label>
                        <div className="relative">
                          <textarea rows={3} aria-label={t('message')} className="input min-h-[5.5rem] resize-y py-2 text-sm" value={form.message} onChange={(e) => set('message')(e.target.value)} />
                        </div>
                      </div>
                      {status && <p role="status" className={`text-center text-xs ${status === 'sent' ? 'text-emerald-700' : 'text-primary'}`}>{status === 'sent' ? t('thanks') : t('required')}</p>}
                      <div className="flex justify-center">
                        <button type="submit" className="btn-primary btn-md btn-pill inline-flex min-w-[8.5rem] items-center justify-center gap-1.5 px-6">
                          {t('submit')}
                          <Send size={14} />
                        </button>
                      </div>
                    </form>
                  </section>
                </aside>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    </div>
  );
}
