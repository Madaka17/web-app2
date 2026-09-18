import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    // IPv4 loopback explicitly: `tailscale serve` proxies to 127.0.0.1, and
    // Node's default "localhost" can bind ::1 only.
    host: '127.0.0.1',
    // Same-origin /api so the page works from any device that can reach the
    // dev server (Tailscale, LAN); the Flask API stays bound to localhost.
    proxy: {
      '/api': 'http://127.0.0.1:3030',
    },
  },
});
