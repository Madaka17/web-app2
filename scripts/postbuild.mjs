// Each page gets its own folder so it works when served as plain static files.
import { copyFileSync, mkdirSync } from 'node:fs';

const routes = ['map', 'new-land', 'news', 'contact', 'privacy-policy', 'terms-of-service', 'auth/login'];
for (const route of routes) {
  mkdirSync(`dist/${route}`, { recursive: true });
  copyFileSync('dist/index.html', `dist/${route}/index.html`);
}
copyFileSync('dist/index.html', 'dist/404.html');
