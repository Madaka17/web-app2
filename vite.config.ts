import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';

// `npm run dev` also starts the Flask model API (ml/api.py) on 127.0.0.1:3030,
// so the app never shows "ต่อกับ Model API ไม่ได้" just because it was not started.
// Uses ml/.venv when present, otherwise python on PATH.
function modelApi(): Plugin {
  let proc: ChildProcess | undefined;
  return {
    name: 'model-api',
    apply: 'serve',
    configureServer(server) {
      // vitest builds a dev server too; a test run must not start (and hang on) the API.
      if (process.env.VITEST) return;
      const ml = fileURLToPath(new URL('./ml', import.meta.url));
      const venv = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
      const python = existsSync(`${ml}/${venv}`) ? `${ml}/${venv}` : 'python';
      if (!existsSync(`${ml}/models/ensemble.joblib`)) {
        server.config.logger.warn('[model-api] ml/models/ensemble.joblib missing - run ml/train_models.py first');
        return;
      }
      proc = spawn(python, ['api.py'], {
        cwd: ml,
        stdio: 'inherit',
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
      proc.on('exit', (code) => server.config.logger.warn(`[model-api] exited with code ${code}`));
      server.httpServer?.on('close', () => proc?.kill());
      process.on('exit', () => proc?.kill());
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), modelApi()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    // maplibre-gl is ~1 MB minified and cannot be split further; it is only
    // loaded with the lazy map page, so it is kept in its own cached chunk
    // instead of one 1 MB blob. The 500 kB warning is raised to its size.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ['maplibre-gl'],
          leaflet: ['leaflet'],
        },
      },
    },
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
