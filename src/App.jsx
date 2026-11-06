import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LangProvider } from './i18n.jsx';
import { AlertProvider } from './components/Alerts.jsx';
import CookieBanner from './components/CookieBanner.jsx';
import MapPage from './pages/MapPage.jsx';
import NewLandPage from './pages/NewLandPage.jsx';
import NewsPage from './pages/NewsPage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import { PrivacyPage, TermsPage } from './pages/DocPages.jsx';
import LoginPage from './pages/LoginPage.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const { pathname } = useLocation();
  const hideCookie = pathname.startsWith('/privacy-policy') || pathname.startsWith('/terms-of-service') || pathname.startsWith('/auth/');
  return (
    <LangProvider>
      <AlertProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Navigate to="/map" replace />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/new-land" element={<NewLandPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy-policy" element={<PrivacyPage />} />
          <Route path="/terms-of-service" element={<TermsPage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
        {!hideCookie && <CookieBanner />}
      </AlertProvider>
    </LangProvider>
  );
}
