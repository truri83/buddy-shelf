import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonTitle,
  IonToggle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { useQueryClient } from '@tanstack/react-query';
import { alertCircle, checkmarkCircle, cloudOfflineOutline, documentTextOutline, serverOutline, volumeHighOutline } from 'ionicons/icons';
import { useState } from 'react';
import {
  ApiError,
  configureApi,
  getApiConfig,
  isTestedVersion,
  useAuthStatus,
  useBambuddyVersion,
  useInventorySource,
  useMe,
} from '@/core/api';
import { t } from '@/core/i18n';
import { can, scanSoundEnabled, setScanSound, storage, type Capability } from '@/core/platform';
import { modules } from '../registry';

const CAPS: Capability[] = ['scanner', 'printer.bluetooth', 'printer.usb', 'printer.service', 'nfc', 'push', 'share', 'haptics'];

/** Kleine Zweitzeile im Stil der iOS-Einstellungen. */
const sub = { color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)', whiteSpace: 'normal' } as const;

/** „Mehr“: Aktionen der Module, Verbindungsstatus, Erweitert (Adresse/Schlüssel), Über, Diagnose. */
export function SettingsPage() {
  const [url, setUrl] = useState(() => getApiConfig().baseUrl);
  const [key, setKey] = useState(() => getApiConfig().apiKey ?? '');
  const [saved, setSaved] = useState(false);
  const [sound, setSound] = useState(scanSoundEnabled);
  useIonViewWillEnter(() => {
    const c = getApiConfig();
    setUrl(c.baseUrl);
    setKey(c.apiKey ?? '');
    setSaved(false);
  });
  const qc = useQueryClient();
  const version = useBambuddyVersion();
  const me = useMe();
  const authStatus = useAuthStatus();
  const source = useInventorySource();
  const actions = modules.flatMap((m) => m.quickActions ?? []);

  const save = () => {
    const cfg = { baseUrl: url.trim().replace(/\/+$/, ''), apiKey: key.trim() || null };
    configureApi(cfg);
    storage.set('api', cfg);
    setSaved(true);
    void qc.invalidateQueries();
  };

  // Verbindungsstatus: angemeldet / Schlüssel fehlt / nicht erreichbar
  const authFailed = me.error instanceof ApiError && (me.error.status === 401 || me.error.status === 403);
  const offline = me.fetchStatus === 'paused' || (me.isError && !(me.error instanceof ApiError));
  const status = me.data
    ? { icon: checkmarkCircle, color: 'var(--bs-good)', title: t('settings.connected', { user: me.data.username }) }
    : authFailed && authStatus.data?.auth_enabled === false
      ? // Bambuddy ohne Anmeldung: /auth/me ist dann immer 401 – das ist kein Fehler
        { icon: checkmarkCircle, color: 'var(--bs-good)', title: t('settings.connectedNoAuth') }
      : authFailed
        ? { icon: alertCircle, color: 'var(--bs-warn)', title: t('settings.authMissing') }
        : offline
          ? { icon: cloudOfflineOutline, color: 'var(--bs-critical)', title: t('state.offline') }
          : null;
  const v = version.data?.version;
  const ownKey = !!getApiConfig().apiKey;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('settings.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {/* Täglich gebraucht oben, Einrichtung darunter (Manifest: group 'setup') */}
        {(['daily', 'setup'] as const).map((group) => (
          <IonList inset key={group}>
            <IonListHeader>{t(`settings.group.${group}`)}</IonListHeader>
            {actions
              .filter((a) => (a.group ?? 'daily') === group)
              .map((a) => (
                <IonItem key={a.id} routerLink={a.href} detail>
                  <IonIcon icon={a.icon} slot="start" color="primary" aria-hidden />
                  <IonLabel>{t(a.label)}</IonLabel>
                </IonItem>
              ))}
            {group === 'setup' && (
              <IonItem routerLink="/more/templates" detail>
                <IonIcon icon={documentTextOutline} slot="start" color="primary" aria-hidden />
                <IonLabel>{t('templates.title')}</IonLabel>
              </IonItem>
            )}
          </IonList>
        ))}

        <IonList inset>
          <IonListHeader>{t('settings.group.app')}</IonListHeader>
          <IonItem lines="none">
            <IonIcon icon={volumeHighOutline} slot="start" color="primary" aria-hidden />
            <IonToggle
              checked={sound}
              onIonChange={(e) => {
                setSound(e.detail.checked);
                setScanSound(e.detail.checked);
              }}
            >
              {t('settings.scanSound')}
              <div style={sub}>{t('settings.scanSoundHint')}</div>
            </IonToggle>
          </IonItem>
        </IonList>

        <IonList inset>
          <IonListHeader>{t('settings.connection')}</IonListHeader>
          <IonItem lines="none">
            {status && <IonIcon icon={status.icon} slot="start" style={{ color: status.color }} aria-hidden />}
            <IonLabel>
              {status?.title ?? t('state.loading')}
              <div style={sub}>
                {v ? (isTestedVersion(v) ? t('settings.version', { v }) : t('settings.versionUntested', { v })) : 'Bambuddy'}
                {' · '}
                {ownKey ? t('settings.ownKey') : t('settings.serverKey')}
              </div>
            </IonLabel>
          </IonItem>
          {source.data && (
            <IonItem lines="none">
              <IonIcon icon={serverOutline} slot="start" style={{ color: 'var(--bs-text-2)' }} aria-hidden />
              <IonLabel>
                {source.data.spoolman ? t('settings.sourceSpoolman') : t('settings.sourceBambuddy')}
                <div style={sub}>{source.data.spoolman ? (source.data.url ?? '') : t('settings.sourceBambuddyHint')}</div>
              </IonLabel>
            </IonItem>
          )}
        </IonList>

        <IonAccordionGroup expand="inset">
          <IonAccordion value="advanced">
            <IonItem slot="header">
              <IonLabel>{t('settings.advanced')}</IonLabel>
            </IonItem>
            <div slot="content">
              <IonItem>
                <IonInput
                  label={t('settings.url')}
                  labelPlacement="stacked"
                  placeholder="–"
                  value={url}
                  onIonInput={(e) => setUrl(String(e.detail.value ?? ''))}
                />
              </IonItem>
              <IonItem>
                <IonInput
                  label={t('settings.apiKey')}
                  labelPlacement="stacked"
                  type="password"
                  placeholder="–"
                  value={key}
                  onIonInput={(e) => setKey(String(e.detail.value ?? ''))}
                />
              </IonItem>
              <IonItem lines="none">
                <IonLabel>
                  <div style={sub}>{t('settings.advancedHint')}</div>
                </IonLabel>
              </IonItem>
              <div style={{ padding: '0 var(--bs-s4) var(--bs-s4)', background: 'var(--bs-surface)' }}>
                <IonButton expand="block" onClick={save}>
                  {saved ? t('settings.saved') : t('settings.save')}
                </IonButton>
              </div>
            </div>
          </IonAccordion>

          <IonAccordion value="diagnose">
            <IonItem slot="header">
              <IonLabel>{t('settings.capabilities')}</IonLabel>
            </IonItem>
            <div slot="content">
              {CAPS.map((c) => (
                <IonItem key={c}>
                  <IonLabel>{t(`cap.${c}`)}</IonLabel>
                  <IonNote slot="end" color={can(c) ? 'success' : 'medium'}>
                    {can(c) ? t('common.yes') : t('common.no')}
                  </IonNote>
                </IonItem>
              ))}
            </div>
          </IonAccordion>
        </IonAccordionGroup>

        <p style={{ textAlign: 'center', color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)', padding: 'var(--bs-s4)' }}>
          {t('app.name')} {__APP_VERSION__}
          {__BUILD_SHA__ ? ` · ${__BUILD_SHA__.slice(0, 7)}` : ''}
        </p>
      </IonContent>
    </IonPage>
  );
}
