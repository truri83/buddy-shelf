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

/**
 * iOS 26 zeichnet in Homescreen-Apps ein Unschärfe-Band über den oberen Rand der Webseite (WebKit-Bug 301994,
 * offen). Liegt die Kopfzeile darin, wirkt sie verwischt → im Standalone-Modus auf iOS etwas tiefer setzen.
 */
function markIosStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (ios && (nav.standalone || window.matchMedia('(display-mode: standalone)').matches)) {
    document.documentElement.classList.add('ios-standalone');
  }
}

/**
 * iOS scrollt beim Tippen in ein Feld das ganze Fenster; bleibt das nach dem Schließen der Tastatur oder nach
 * einem App-Wechsel stehen, ist die App verschoben (Tab-Leiste mitten im Bild). Die App selbst scrollt nur in
 * ion-content – das Fenster gehört immer auf 0.
 */
function keepWindowInPlace() {
  const reset = () => {
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
  };
  document.addEventListener('focusout', () => setTimeout(reset, 100));
  document.addEventListener('visibilitychange', () => !document.hidden && reset());
  window.visualViewport?.addEventListener('resize', () => setTimeout(reset, 100));
}

async function start() {
  keepWindowInPlace();
  markIosStandalone();
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
