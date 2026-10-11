import { IonButton, IonContent, IonHeader, IonInput, IonItem, IonList, IonNote, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@/core/i18n';
import { dispatchScan } from '../scan';

/**
 * Vorlage „Scan“. Phase-1-Stand: manuelle Eingabe.
 * Kamera-Scanner folgt über den Plattform-Adapter `scanner` (Steckbrief SP-02).
 */
export function ScanPage() {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const submit = () => {
    const out = dispatchScan(code);
    if ('route' in out) navigate(out.route);
    else if ('configured' in out) setMessage(t('settings.saved'));
    else setMessage(t('scan.unknown'));
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('scan.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div
          style={{
            aspectRatio: '1',
            maxWidth: 360,
            margin: '0 auto var(--bs-s5)',
            borderRadius: 'var(--bs-r-lg)',
            border: '2px dashed var(--bs-border)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--bs-text-2)',
            textAlign: 'center',
            padding: 'var(--bs-s4)',
          }}
        >
          {t('scan.cameraSoon')}
        </div>
        <IonList inset>
          <IonItem>
            <IonInput
              label={t('scan.manual')}
              labelPlacement="stacked"
              placeholder="bm:s:4"
              value={code}
              onIonInput={(e) => setCode(String(e.detail.value ?? ''))}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </IonItem>
        </IonList>
        <IonNote style={{ display: 'block', padding: '0 var(--bs-s4)' }}>{t('scan.manualHint')}</IonNote>
        <IonButton expand="block" className="ion-margin-top" onClick={submit} disabled={!code.trim()}>
          {t('scan.open')}
        </IonButton>
        {message && (
          <p role="status" style={{ textAlign: 'center', color: 'var(--bs-text-2)' }}>
            {message}
          </p>
        )}
      </IonContent>
    </IonPage>
  );
}
