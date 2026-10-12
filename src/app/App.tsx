import { IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ellipsisHorizontal, scanOutline } from 'ionicons/icons';
import { Navigate, Route } from 'react-router-dom';
import { t } from '@/core/i18n';
import { ScanPage } from './pages/ScanPage';
import { UpdateToast } from './UpdateToast';
import { SettingsPage } from './pages/SettingsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { modules, tabModules } from './registry';

// Ionic wählt iOS- oder Material-Stil anhand der Plattform (UI-Regel 4).
setupIonicReact({ animated: !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches });

const queryClient = new QueryClient({
  // Schreibvorgänge nie still pausieren: offline sofort Fehler zeigen statt später unbemerkt nachzuholen
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, networkMode: 'offlineFirst' }, mutations: { networkMode: 'always' } },
});

// Tabs der Module + „Mehr“; der Scan-Knopf sitzt immer in der Mitte: links die vordere Hälfte, rechts der Rest.
// Alle Tabs gleich breit; fehlt rechts einer, füllt eine Lücke neben dem Scan-Knopf auf (Mehr spiegelt den ersten Tab).
const TABS = [
  ...tabModules.map((m) => ({ id: m.id, href: m.tab!.href, icon: m.icon, label: m.title })),
  { id: 'more', href: '/more', icon: ellipsisHorizontal, label: 'nav.more' },
];
const left = TABS.slice(0, Math.ceil(TABS.length / 2));
const right = TABS.slice(left.length);
const gap = left.length - right.length;

export function App() {
  const first = tabModules[0];
  return (
    <QueryClientProvider client={queryClient}>
      <IonApp>
        <IonReactRouter>
          <IonTabs>
            <IonRouterOutlet>
              {modules.flatMap((m) => m.routes.map((r) => <Route key={r.path} path={r.path} element={<r.component />} />))}
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/more" element={<SettingsPage />} />
              <Route path="/more/templates" element={<TemplatesPage />} />
              <Route path="/" element={<Navigate to={first?.tab?.href ?? '/more'} replace />} />
            </IonRouterOutlet>
            <IonTabBar slot="bottom">
              {left.map((tab) => (
                <IonTabButton key={tab.id} tab={tab.id} href={tab.href} className="bs-tab">
                  <IonIcon icon={tab.icon} aria-hidden />
                  <IonLabel>{t(tab.label)}</IonLabel>
                </IonTabButton>
              ))}
              {/* Scannen als runder Mittelknopf ohne Beschriftung; Name für Screenreader */}
              <IonTabButton tab="scan" href="/scan" className="bs-tab-scan" aria-label={t('nav.scan')}>
                <span className="bs-tab-fab">
                  <IonIcon icon={scanOutline} aria-hidden />
                </span>
              </IonTabButton>
              {Array.from({ length: gap }, (_, i) => (
                <IonTabButton key={`gap${i}`} tab={`gap${i}`} disabled className="bs-tab bs-tab-gap" aria-hidden />
              ))}
              {right.map((tab) => (
                <IonTabButton key={tab.id} tab={tab.id} href={tab.href} className="bs-tab">
                  <IonIcon icon={tab.icon} aria-hidden />
                  <IonLabel>{t(tab.label)}</IonLabel>
                </IonTabButton>
              ))}
            </IonTabBar>
          </IonTabs>
        </IonReactRouter>
        <UpdateToast />
      </IonApp>
    </QueryClientProvider>
  );
}
