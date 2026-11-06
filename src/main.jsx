import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/kanit/thai-400.css';
import '@fontsource/kanit/latin-400.css';
import '@fontsource/kanit/thai-600.css';
import '@fontsource/kanit/latin-600.css';
import '@fontsource/kanit/thai-700.css';
import '@fontsource/kanit/latin-700.css';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
