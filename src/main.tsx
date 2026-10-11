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
import { storage, unlockAudio } from './core/platform';
import { App } from './app/App';

async function start() {
  unlockAudio();
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
