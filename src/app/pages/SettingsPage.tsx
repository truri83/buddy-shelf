import { IonButton, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { configureApi, getApiConfig, isTestedVersion, useBambuddyVersion } from '@/core/api';
import { t } from '@/core/i18n';
import { can, storage, type Capability } from '@/core/platform';
import { modules } from '../registry';

const CAPS: Capability[] = ['scanner', 'printer.bluetooth', 'printer.usb', 'printer.service', 'nfc', 'push', 'share', 'haptics'];

export function SettingsPage() {
  const current = getApiConfig();
  const [url, setUrl] = useState(current.baseUrl);
  const [key, setKey] = useState(current.apiKey ?? '');
  const [saved, setSaved] = useState(false);
  const qc = useQueryClient();
  const version = useBambuddyVersion();
  const actions = modules.flatMap((m) => m.quickActions ?? []);

  const save = () => {
    const cfg = { baseUrl: url.trim().replace(/\/+$/, ''), apiKey: key.trim() || null };
    configureApi(cfg);
    storage.set('api', cfg);
    setSaved(true);
    void qc.invalidateQueries();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('settings.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList inset>
          <IonListHeader>{t('settings.server')}</IonListHeader>
          <IonItem>
            <IonInput
              label={t('settings.url')}
              labelPlacement="stacked"
              placeholder={t('settings.urlHint')}
              value={url}
              onIonInput={(e) => setUrl(String(e.detail.value ?? ''))}
            />
          </IonItem>
          <IonItem>
            <IonInput
              label={t('settings.apiKey')}
              labelPlacement="stacked"
              type="password"
              placeholder={t('settings.apiKeyHint')}
              value={key}
              onIonInput={(e) => setKey(String(e.detail.value ?? ''))}
            />
          </IonItem>
          <IonItem lines="none">
            <IonNote>
              {t('settings.urlHint')} · {t('settings.scanConfig')}
            </IonNote>
          </IonItem>
        </IonList>
        <div className="ion-padding-horizontal">
          <IonButton expand="block" onClick={save}>
            {saved ? t('settings.saved') : t('settings.save')}
          </IonButton>
        </div>
        {actions.length > 0 && (
          <IonList inset>
            <IonListHeader>{t('settings.actions')}</IonListHeader>
            {actions.map((a) => (
              <IonItem key={a.id} routerLink={a.href} detail>
                <IonIcon icon={a.icon} slot="start" aria-hidden />
                <IonLabel>{t(a.label)}</IonLabel>
              </IonItem>
            ))}
          </IonList>
        )}
        {/* Regel 14: Bambuddy-Version prüfen – unbekannt = Hinweis, kein Fehler */}
        {version.data && (
          <IonList inset>
            <IonListHeader>{t('settings.bambuddy')}</IonListHeader>
            <IonItem lines="none">
              <IonNote color={isTestedVersion(version.data.version) ? undefined : 'warning'}>
                {isTestedVersion(version.data.version)
                  ? t('settings.version', { v: version.data.version })
                  : t('settings.versionUntested', { v: version.data.version })}
              </IonNote>
            </IonItem>
          </IonList>
        )}
        <IonList inset>
          <IonListHeader>{t('settings.capabilities')}</IonListHeader>
          {CAPS.map((c) => (
            <IonItem key={c}>
              <IonLabel className="bs-num">{c}</IonLabel>
              <IonLabel slot="end" color={can(c) ? 'success' : 'medium'}>
                {can(c) ? 'ja' : 'nein'}
              </IonLabel>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
}
