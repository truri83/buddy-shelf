import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { catalogMiddleware } from './server/catalog.js';

// Dev: /api und /ws gehen an Bambuddy (BAMBUDDY_URL in .env.local).
// Mock-Modus (npm run dev:mock): MSW beantwortet /api im Browser, kein Server nötig.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.BAMBUDDY_URL || 'http://localhost:8000';
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_SHA__: JSON.stringify(process.env.BUILD_SHA ?? ''),
    },
    plugins: [
      react(),
      // Filament-Katalog wie im Produktionsserver (im Mock-Modus beantwortet MSW /catalog)
      { name: 'filament-catalog', configureServer: (server) => void server.middlewares.use(catalogMiddleware()) },
      VitePWA({
        // Neue Version nach einem Deploy: Hinweis mit „Aktualisieren“ (src/app/UpdateToast.tsx), kein Neuladen mitten in einer Eingabe
        registerType: 'prompt',
        includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'Buddy Shelf',
          short_name: 'Buddy Shelf',
          description: 'Spulen scannen, zuweisen und etikettieren – für Bambuddy',
          lang: 'de',
          // = --bs-bg (dunkel); hell/dunkel wechselt index.html per theme-color-Media-Query
          theme_color: '#0f1114',
          background_color: '#0f1114',
          display: 'standalone',
          start_url: '/',
          // PNG-Icons aus public/icon.svg (npm run icons); iOS nutzt kein SVG für den Homescreen
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Mock-Worker (nur dev:mock) nicht in den Offline-Speicher der echten App
          globIgnores: ['**/mockServiceWorker.js'],
          runtimeCaching: [
            {
              // Filament-Katalog: sofort aus dem Speicher, im Hintergrund aktualisieren (spart Netz und Akku)
              urlPattern: ({ url }) => url.pathname.startsWith('/catalog/'),
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'filament-catalog', expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 } },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      host: true,
      proxy:
        mode === 'mock'
          ? undefined
          : {
              '/api': {
                target,
                changeOrigin: true,
                ws: true,
                // wie server/index.js: Server-Schlüssel, falls das Gerät keinen schickt
                ...(env.BAMBUDDY_API_KEY ? { headers: { 'x-api-key': env.BAMBUDDY_API_KEY } } : {}),
              },
            },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
