import { IonButton, IonContent, IonHeader, IonInput, IonItem, IonList, IonNote, IonPage, IonTitle, IonToolbar, useIonViewDidEnter, useIonViewWillLeave } from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@/core/i18n';
import { can, haptic, ScannerError, startScanner, type ScannerErrorKind, type ScannerHandle } from '@/core/platform';
import { dispatchScan } from '../scan';

type CamState = { kind: 'off' } | { kind: 'starting' } | { kind: 'running'; torch: boolean } | { kind: 'error'; error: ScannerErrorKind };

/**
 * Vorlage „Scan“ (SP-02): Kamera mit Zielrahmen, Treffer → Scan-Verteiler. Code-Eingabe bleibt als Ersatz.
 * Die Kamera läuft nur, solange der Tab sichtbar ist.
 */
export function ScanPage() {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [cam, setCam] = useState<CamState>({ kind: 'off' });
  const [torchOn, setTorchOn] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const handle = useRef<ScannerHandle | null>(null);
  const starting = useRef(false);
  const visible = useRef(false);
  const navigate = useNavigate();

  const handleCode = useCallback(
    (raw: string) => {
      const out = dispatchScan(raw);
      if ('route' in out) {
        haptic();
        navigate(out.route);
      } else if ('configured' in out) {
        haptic();
        setMessage(t('settings.saved'));
      } else if ('notYet' in out) setMessage(t('scan.slotSoon'));
      else {
        haptic('warning');
        setMessage(t('scan.unknown'));
      }
    },
    [navigate],
  );

  const stop = useCallback(() => {
    visible.current = false;
    handle.current?.stop();
    handle.current = null;
    setTorchOn(false);
    setCam({ kind: 'off' });
  }, []);

  const start = useCallback(async () => {
    visible.current = true;
    if (!can('scanner') || !video.current || handle.current || starting.current) return;
    starting.current = true;
    setCam({ kind: 'starting' });
    setMessage(null);
    try {
      const h = await startScanner(video.current, handleCode);
      // Tab inzwischen verlassen? Dann Kamera sofort wieder aus
      if (!visible.current) h.stop();
      else {
        handle.current = h;
        setCam({ kind: 'running', torch: h.hasTorch });
      }
    } catch (e) {
      setCam({ kind: 'error', error: e instanceof ScannerError ? e.kind : 'failed' });
    } finally {
      starting.current = false;
    }
  }, [handleCode]);

  useIonViewDidEnter(() => void start());
  useIonViewWillLeave(stop);

  // Kamera aus, wenn die App in den Hintergrund geht; beim Zurückkommen wieder an
  useEffect(() => {
    // nur wieder starten, wenn der Scan-Tab gerade aktiv ist
    const onVis = () => (document.hidden ? stop() : document.location.pathname.startsWith('/scan') && void start());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stop();
    };
  }, [start, stop]);

  const toggleTorch = async () => {
    await handle.current?.setTorch(!torchOn);
    setTorchOn(!torchOn);
  };

  const status =
    cam.kind === 'error'
      ? t(`scan.${cam.error}`)
      : cam.kind === 'starting'
        ? t('scan.starting')
        : cam.kind === 'running'
          ? t('scan.hint')
          : null;

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
            position: 'relative',
            aspectRatio: '1',
            maxWidth: 420,
            margin: '0 auto var(--bs-s3)',
            borderRadius: 'var(--bs-r-lg)',
            overflow: 'hidden',
            background: 'var(--bs-surface-2)',
          }}
        >
          <video ref={video} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: cam.kind === 'running' ? 'block' : 'none' }} />
          {/* Zielrahmen */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: '18%',
              border: '3px solid var(--bs-accent)',
              borderRadius: 'var(--bs-r-md)',
              boxShadow: cam.kind === 'running' ? '0 0 0 100vmax rgba(0,0,0,.35)' : 'none',
            }}
          />
          {cam.kind !== 'running' && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 'var(--bs-s5)', textAlign: 'center', color: 'var(--bs-text-2)' }}>
              <div style={{ display: 'grid', gap: 'var(--bs-s3)', justifyItems: 'center' }}>
                <span>{status}</span>
                {cam.kind === 'error' && cam.error !== 'insecure' && cam.error !== 'nocamera' && (
                  <IonButton size="small" fill="outline" onClick={() => void start()}>
                    {t('scan.retry')}
                  </IonButton>
                )}
              </div>
            </div>
          )}
          {cam.kind === 'running' && cam.torch && (
            <IonButton size="small" onClick={() => void toggleTorch()} style={{ position: 'absolute', right: 'var(--bs-s3)', bottom: 'var(--bs-s3)' }} fill={torchOn ? 'solid' : 'outline'}>
              {t('scan.torch')}
            </IonButton>
          )}
        </div>
        {cam.kind === 'running' && <IonNote style={{ display: 'block', textAlign: 'center', marginBottom: 'var(--bs-s3)' }}>{status}</IonNote>}
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
