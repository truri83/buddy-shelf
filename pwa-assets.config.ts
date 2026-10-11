import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Icons aus public/icon.svg: `npx @vite-pwa/assets-generator@2.0.0` (Ergebnis liegt in public/ und wird eingecheckt).
// iOS rundet das Homescreen-Icon selbst ab → vollflächig in der Icon-Hintergrundfarbe, kein weißer Rand.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    apple: { sizes: [180], padding: 0, resizeOptions: { background: '#14161a', fit: 'contain' } },
    maskable: { sizes: [512], padding: 0.1, resizeOptions: { background: '#14161a' } },
  },
  images: ['public/icon.svg'],
});
