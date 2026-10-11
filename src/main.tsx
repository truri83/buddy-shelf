import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/display.css';
import './core/ui/tokens.css';

import { configureApi, type ApiConfig } from './core/api';
import { storage } from './core/platform';
import { App } from './app/App';

async function start() {
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
