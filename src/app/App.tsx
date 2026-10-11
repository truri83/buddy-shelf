import { IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ellipsisHorizontal, scanOutline } from 'ionicons/icons';
import { Navigate, Route } from 'react-router-dom';
import { t } from '@/core/i18n';
import { ScanPage } from './pages/ScanPage';
import { UpdateToast } from './UpdateToast';
import { SettingsPage } from './pages/SettingsPage';
import { modules, tabModules } from './registry';

// Ionic wählt iOS- oder Material-Stil anhand der Plattform (UI-Regel 4).
setupIonicReact({ animated: !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches });

const queryClient = new QueryClient({
  // Schreibvorgänge nie still pausieren: offline sofort Fehler zeigen statt später unbemerkt nachzuholen
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, networkMode: 'offlineFirst' }, mutations: { networkMode: 'always' } },
});

export function App() {
  const [first, ...rest] = tabModules;
  return (
    <QueryClientProvider client={queryClient}>
      <IonApp>
        <IonReactRouter>
          <IonTabs>
            <IonRouterOutlet>
              {modules.flatMap((m) => m.routes.map((r) => <Route key={r.path} path={r.path} element={<r.component />} />))}
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/more" element={<SettingsPage />} />
              <Route path="/" element={<Navigate to={first?.tab?.href ?? '/more'} replace />} />
            </IonRouterOutlet>
            <IonTabBar slot="bottom">
              {first && (
                <IonTabButton tab={first.id} href={first.tab!.href}>
                  <IonIcon icon={first.icon} aria-hidden />
                  <IonLabel>{t(first.title)}</IonLabel>
                </IonTabButton>
              )}
              {rest.slice(0, 1).map((m) => (
                <IonTabButton key={m.id} tab={m.id} href={m.tab!.href}>
                  <IonIcon icon={m.icon} aria-hidden />
                  <IonLabel>{t(m.title)}</IonLabel>
                </IonTabButton>
              ))}
              {/* Scannen als runder Mittelknopf ohne Beschriftung; Name für Screenreader */}
              <IonTabButton tab="scan" href="/scan" className="bs-tab-scan" aria-label={t('nav.scan')}>
                <span className="bs-tab-fab">
                  <IonIcon icon={scanOutline} aria-hidden />
                </span>
              </IonTabButton>
              {rest.slice(1).map((m) => (
                <IonTabButton key={m.id} tab={m.id} href={m.tab!.href}>
                  <IonIcon icon={m.icon} aria-hidden />
                  <IonLabel>{t(m.title)}</IonLabel>
                </IonTabButton>
              ))}
              <IonTabButton tab="more" href="/more">
                <IonIcon icon={ellipsisHorizontal} aria-hidden />
                <IonLabel>{t('nav.more')}</IonLabel>
              </IonTabButton>
            </IonTabBar>
          </IonTabs>
        </IonReactRouter>
        <UpdateToast />
      </IonApp>
    </QueryClientProvider>
  );
}
