import { Link } from 'react-router-dom';
import { BRAND, useLang } from '../i18n.jsx';

export default function Footer() {
  const { t } = useLang();
  return (
    <footer id="contact" className="bg-primary-dark px-4 py-12 text-white sm:py-14 md:py-16">
      <div className="mx-auto max-w-container text-center">
        <h2 className="font-display text-3xl font-bold sm:text-[34px] md:text-[40px]">{BRAND}</h2>
        <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed tracking-[0.01em] sm:text-base sm:leading-8">{t('footerTag')}</p>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 tracking-[0.01em] text-white/85 sm:text-base">{t('footerBody')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-white/70 sm:text-sm">
          <Link className="hover:text-white" to="/contact">{t('about')}</Link>
          <Link className="hover:text-white" to="/privacy-policy">{t('privacyPolicy')}</Link>
          <Link className="hover:text-white" to="/terms-of-service">{t('terms')}</Link>
        </div>
        <div className="mt-6 border-t border-white/15 pt-4 text-xs text-white/50">{t('rights')}</div>
      </div>
    </footer>
  );
}

export function SeoBlock({ title, lead, heading }) {
  return (
    <section className="sr-only" aria-label="ข้อมูลเพจสำหรับเครื่องมือค้นหา">
      <h1>{title}</h1>
      <p>{lead}</p>
      {heading}
      <nav aria-label="ลิงก์ภายในเว็บไซต์">
        <h2>หน้าหลักของ {BRAND}</h2>
        <ul>
          <li><Link to="/map">แผนที่</Link></li>
          <li><Link to="/new-land">รายการใหม่</Link></li>
          <li><Link to="/news">ข่าวสาร</Link></li>
          <li><Link to="/contact">เกี่ยวกับเรา</Link></li>
          <li><Link to="/privacy-policy">นโยบายความเป็นส่วนตัว</Link></li>
          <li><Link to="/terms-of-service">เงื่อนไขการใช้บริการ</Link></li>
        </ul>
      </nav>
    </section>
  );
}
