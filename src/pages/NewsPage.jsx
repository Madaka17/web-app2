import { BRAND, useLang, usePageMeta } from '../i18n.jsx';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';

export default function NewsPage() {
  const { t } = useLang();
  usePageMeta(`News | ${BRAND}`, t('newsLead'));
  return (
    <div className="min-h-full bg-surface-soft">
      <Header tone="red" />
      <main className="min-h-[calc(100vh-var(--nav-h))] pt-[var(--nav-h)]">
        <div className="mx-auto w-full max-w-container px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <header className="mb-6 sm:mb-8">
            <h1 className="font-display text-2xl font-extrabold leading-8 tracking-tight text-ink-primary sm:text-[30px] sm:leading-9">{BRAND} News</h1>
            <p className="max-w-2xl text-sm leading-[22px] text-ink-secondary sm:text-base sm:leading-7">{t('newsLead')}</p>
          </header>
          <div className="rounded-2xl bg-white px-6 py-10 text-center">
            <p className="text-sm font-medium leading-6 text-primary">โหลดข่าวไม่สำเร็จ</p>
            <p className="text-xs leading-5 text-ink-muted">ลองรีเฟรชหน้า หรือตรวจสอบการเชื่อมต่อ API</p>
          </div>
        </div>
        <Footer />
      </main>
    </div>
  );
}
