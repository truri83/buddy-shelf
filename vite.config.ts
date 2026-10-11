import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// Dev: /api und /ws gehen an Bambuddy (BAMBUDDY_URL in .env.local).
// Mock-Modus (npm run dev:mock): MSW beantwortet /api im Browser, kein Server nötig.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.BAMBUDDY_URL || 'http://localhost:8000';
  return {
    plugins: [
      react(),
      VitePWA({
        // Neue Version nach einem Deploy sofort übernehmen (sonst bleibt die Homescreen-App alt).
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        manifest: {
          name: 'Buddy Shelf',
          short_name: 'Buddy Shelf',
          description: 'Spulen scannen, zuweisen und etikettieren – für Bambuddy',
          lang: 'de',
          theme_color: '#14161a',
          background_color: '#14161a',
          display: 'standalone',
          start_url: '/',
          icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
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
              '/api': { target, changeOrigin: true, ws: true },
            },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
