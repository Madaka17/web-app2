import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { useLang } from '../i18n.jsx';

const AlertContext = createContext(null);

/** Only one alert shows at a time. A new alert replaces the one on screen. */
export function AlertProvider({ children }) {
  const [alert, setAlert] = useState(null);
  const close = useCallback(() => setAlert(null), []);
  const signIn = useCallback(() => setAlert({ type: 'signin' }), []);
  const value = useMemo(() => ({ alert, setAlert, close, signIn }), [alert, close, signIn]);
  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
}

export function useAlerts() {
  return useContext(AlertContext);
}

function Backdrop() {
  return <div className="absolute inset-0 bg-ink-primary/45 backdrop-blur-sm" aria-hidden="true" />;
}

function NoticeDialog({ title, children, onOk, okLabel }) {
  return (
    <div className="fixed inset-0 z-[3100] flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">
      <Backdrop />
      <div role="alertdialog" aria-modal="true" aria-labelledby="alert-title" aria-describedby="alert-desc" className="relative flex max-h-[min(88dvh,36rem)] w-full max-w-[min(100%,18rem)] flex-col overflow-hidden rounded-xl border border-line/40 bg-white shadow-[0_16px_48px_-12px_rgba(0,0,0,0.28)] sm:max-h-[min(90dvh,40rem)] sm:max-w-[20rem] md:max-w-sm md:rounded-2xl">
        <div className="shrink-0 border-b border-line/40 px-3.5 py-3 sm:px-5 sm:py-4">
          <h3 id="alert-title" className="text-sm font-extrabold leading-snug text-ink-primary sm:text-base md:text-lg">{title}</h3>
        </div>
        <div id="alert-desc" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 py-3 text-xs leading-relaxed text-ink-secondary sm:px-5 sm:py-4 sm:text-sm">{children}</div>
        <div className="shrink-0 border-t border-line/40 bg-surface-soft/30 px-3.5 py-2.5 sm:px-5 sm:py-4">
          <div className="flex justify-stretch sm:justify-end">
            <button type="button" onClick={onOk} className="btn-primary btn-sm btn-pill min-h-9 w-full sm:min-h-10 sm:w-auto">{okLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CenterCard({ children, label }) {
  return (
    <div className="fixed inset-0 z-[3100] flex items-center justify-center p-4">
      <Backdrop />
      <div role="alertdialog" aria-modal="true" aria-label={label} className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center">{children}</div>
    </div>
  );
}

export function AlertHost() {
  const { t } = useLang();
  const { alert, setAlert, close } = useAlerts();
  const navigate = useNavigate();
  if (!alert) return null;
  let content = null;
  if (alert.type === 'edu') {
    content = (
      <NoticeDialog title="ข้อมูลเพื่อการศึกษา" okLabel="ตกลง" onOk={() => setAlert({ type: 'pdpa', after: alert.after })}>
        <div className="space-y-1">
          <p>ข้อมูลในเว็บตัวอย่างนี้สมมติขึ้นเพื่อการสาธิต</p>
          <p className="font-bold text-ink-primary">ไม่ใช่ประกาศจริง</p>
        </div>
      </NoticeDialog>
    );
  } else if (alert.type === 'pdpa') {
    content = (
      <NoticeDialog
        title="เตือน: การประมวลผลข้อมูลส่วนบุคคล"
        okLabel="ตกลง"
        onOk={() => {
          close();
          if (alert.after) alert.after();
        }}
      >
        <p>หากเว็บนี้เปิดใช้งานจริงและมีข้อมูลส่วนบุคคล ผู้ใช้ต้องปฏิบัติตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 หากไม่ประสงค์ดำเนินการต่อ โปรดออกจากหน้านี้ แล้วกดตกลงเพื่อปิดข้อความนี้</p>
      </NoticeDialog>
    );
  } else if (alert.type === 'dev') {
    content = (
      <CenterCard label={t('devNotice')}>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"><Construction size={32} /></div>
        <p className="text-sm leading-relaxed text-ink-secondary">{t('devNotice')} 🙏</p>
        <button type="button" onClick={close} className="btn-primary btn-md mt-6 w-full">{t('gotIt')}</button>
      </CenterCard>
    );
  } else if (alert.type === 'signin') {
    content = (
      <CenterCard label={t('signInTitle')}>
        <h3 className="font-sans text-lg font-extrabold text-black">{t('signInTitle')}</h3>
        <button type="button" onClick={() => { close(); navigate('/auth/login'); }} className="btn-primary btn-lg btn-pill mt-4 w-full">{t('signInCta')}</button>
        <button type="button" onClick={close} className="btn-outline btn-lg btn-pill mt-2 w-full">{t('cancel')}</button>
      </CenterCard>
    );
  } else if (alert.type === 'sample') {
    content = (
      <CenterCard label={t('sample')}>
        <p className="text-sm leading-relaxed text-ink-secondary">{t('sample')}</p>
        <button type="button" onClick={close} className="btn-primary btn-md mt-5 w-full">{t('gotIt')}</button>
      </CenterCard>
    );
  }
  return createPortal(content, document.body);
}
