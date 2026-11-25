import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LangProvider } from './i18n.jsx';
import { AlertProvider } from './components/Alerts.jsx';
import CookieBanner from './components/CookieBanner.jsx';
import MapPage from './pages/MapPage.jsx';
import { PrivacyPage, TermsPage } from './pages/DocPages.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const { pathname } = useLocation();
  const hideCookie = pathname.startsWith('/privacy-policy') || pathname.startsWith('/terms-of-service');
  return (
    <LangProvider>
      <AlertProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Navigate to="/map" replace />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/privacy-policy" element={<PrivacyPage />} />
          <Route path="/terms-of-service" element={<TermsPage />} />
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
        {!hideCookie && <CookieBanner />}
      </AlertProvider>
    </LangProvider>
  );
}
