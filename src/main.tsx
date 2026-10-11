import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/display.css';
// Ionics Dunkel-Palette liefert die Zwischenstufen (Überschriften, Trenner, Hinweise); Farben kommen aus unseren Tokens
import '@ionic/react/css/palettes/dark.system.css';
import './core/ui/tokens.css';

import { configureApi, type ApiConfig } from './core/api';
import { storage } from './core/platform';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';

/** Neue Version nach einem Deploy: stündlich und beim Zurückkehren in die App prüfen, dann neu laden (autoUpdate). */
function registerUpdates() {
  if (!import.meta.env.PROD || import.meta.env.MODE === 'mock') return;
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      setInterval(() => void reg.update(), 60 * 60_000);
      document.addEventListener('visibilitychange', () => !document.hidden && void reg.update());
    },
  });
}

async function start() {
  registerUpdates();
  configureApi(storage.get<Partial<ApiConfig>>('api', {}));

  if (import.meta.env.MODE === 'mock') {
    const { worker } = await import('../mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
