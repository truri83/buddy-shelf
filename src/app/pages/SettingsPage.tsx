import { IonButton, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { configureApi, getApiConfig } from '@/core/api';
import { t } from '@/core/i18n';
import { can, storage, type Capability } from '@/core/platform';

const CAPS: Capability[] = ['scanner', 'printer.bluetooth', 'printer.usb', 'printer.service', 'nfc', 'push', 'share', 'haptics'];

export function SettingsPage() {
  const current = getApiConfig();
  const [url, setUrl] = useState(current.baseUrl);
  const [key, setKey] = useState(current.apiKey ?? '');
  const [saved, setSaved] = useState(false);
  const qc = useQueryClient();

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
              placeholder="https://…"
              value={url}
              onIonInput={(e) => setUrl(String(e.detail.value ?? ''))}
            />
          </IonItem>
          <IonItem>
            <IonInput
              label={t('settings.apiKey')}
              labelPlacement="stacked"
              type="password"
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
