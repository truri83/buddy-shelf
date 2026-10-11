import { IonButton, IonContent, IonHeader, IonInput, IonItem, IonList, IonNote, IonPage, IonTitle, IonToolbar, useIonViewDidEnter, useIonViewWillLeave } from '@ionic/react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@/core/i18n';
import { haptic } from '@/core/platform';
import { ScannerView } from '@/core/ui';
import { dispatchScan } from '../scan';

/**
 * Vorlage „Scan“ (SP-02): Kamera mit Zielrahmen, Treffer → Scan-Verteiler. Code-Eingabe bleibt als Ersatz.
 * Die Kamera läuft nur, solange der Tab sichtbar ist.
 */
export function ScanPage() {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const navigate = useNavigate();

  useIonViewDidEnter(() => setActive(true));
  useIonViewWillLeave(() => setActive(false));

  const handleCode = useCallback(
    (raw: string) => {
      const out = dispatchScan(raw);
      if ('route' in out) {
        haptic();
        setMessage(null);
        navigate(out.route);
      } else if ('configured' in out) {
        haptic();
        setMessage(t('settings.saved'));
      } else {
        haptic('warning');
        setMessage(t('scan.unknown'));
      }
    },
    [navigate],
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('scan.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <ScannerView active={active} onCode={handleCode} />
        {message && (
          <p role="status" style={{ textAlign: 'center', color: 'var(--bs-text-2)', margin: '0 0 var(--bs-s3)' }}>
            {message}
          </p>
        )}
        <IonList inset>
          <IonItem>
            <IonInput
              label={t('scan.manual')}
              labelPlacement="stacked"
              placeholder="bm:s:4"
              value={code}
              onIonInput={(e) => setCode(String(e.detail.value ?? ''))}
              onKeyDown={(e) => e.key === 'Enter' && code.trim() && handleCode(code)}
            />
          </IonItem>
        </IonList>
        <IonNote style={{ display: 'block', padding: '0 var(--bs-s4)' }}>{t('scan.manualHint')}</IonNote>
        <IonButton expand="block" className="ion-margin-top" onClick={() => handleCode(code)} disabled={!code.trim()}>
          {t('scan.open')}
        </IonButton>
      </IonContent>
    </IonPage>
  );
}
