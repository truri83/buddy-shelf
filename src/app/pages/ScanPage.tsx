import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@/core/i18n';
import { haptic, warnFeedback, QR_AND_BARCODES } from '@/core/platform';
import { ScannerView } from '@/core/ui';
import { applyConfig, dispatchScan } from '../scan';

/**
 * Vorlage „Scan“ (SP-02): Kamera mit Zielrahmen, Treffer → Scan-Verteiler. Code-Eingabe bleibt als Ersatz.
 * Die Kamera läuft nur, solange der Tab sichtbar ist.
 */
/** Von Hand: „4“ oder „#4“ ist die Spulennummer, alles andere geht als Code durch. */
const asCode = (v: string) => {
  const n = v.trim().replace(/^#/, '');
  return /^\d{1,7}$/.test(n) ? `bm:s:${n}` : v.trim();
};

export function ScanPage() {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [alert] = useIonAlert();
  // Nach dem Zurückkehren nicht sofort wieder zum Etikett springen, das noch im Bild ist
  const lastJump = useRef({ raw: '', at: 0 });

  useIonViewDidEnter(() => setActive(true));
  useIonViewWillLeave(() => setActive(false));

  const handleCode = useCallback(
    (raw: string, fromCamera = false) => {
      const out = dispatchScan(raw);
      if ('route' in out) {
        if (fromCamera && raw === lastJump.current.raw && Date.now() - lastJump.current.at < 8000) return;
        lastJump.current = { raw, at: Date.now() };
        haptic();
        setMessage(null);
        navigate(out.route);
      } else if ('config' in out) {
        haptic();
        void alert({
          header: t('settings.server'),
          message: t('scan.configQ'),
          buttons: [
            { text: t('common.cancel'), role: 'cancel' },
            {
              text: t('scan.configApply'),
              handler: () => {
                applyConfig(out.config);
                void qc.invalidateQueries();
                setMessage(t('settings.saved'));
              },
            },
          ],
        });
      } else {
        warnFeedback();
        setMessage(t('scan.unknown'));
      }
    },
    [navigate, alert, qc],
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('scan.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <ScannerView active={active} formats={QR_AND_BARCODES} onCode={(raw) => handleCode(raw, true)} />
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
              placeholder="4"
              value={code}
              onIonInput={(e) => setCode(String(e.detail.value ?? ''))}
              onKeyDown={(e) => e.key === 'Enter' && code.trim() && handleCode(asCode(code))}
            />
          </IonItem>
        </IonList>
        <IonNote style={{ display: 'block', padding: '0 var(--bs-s4)' }}>{t('scan.manualHint')}</IonNote>
        <IonButton expand="block" className="ion-margin-top" onClick={() => handleCode(asCode(code))} disabled={!code.trim()}>
          {t('scan.open')}
        </IonButton>
      </IonContent>
    </IonPage>
  );
}
