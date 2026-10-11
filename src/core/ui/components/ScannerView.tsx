import { IonButton } from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@/core/i18n';
import { can, ScannerError, startScanner, type ScannerErrorKind, type ScannerHandle } from '@/core/platform';

type CamState = { kind: 'off' } | { kind: 'starting' } | { kind: 'running'; torch: boolean } | { kind: 'error'; error: ScannerErrorKind };

interface Props {
  /** Kamera nur, solange true (z. B. Tab sichtbar) */
  active: boolean;
  onCode: (text: string) => void;
  /** Hinweis unter dem Bild im laufenden Zustand */
  hint?: string;
}

/** Baustein „Kamera mit Zielrahmen“ (SP-02). Kamera aus, wenn inaktiv oder App im Hintergrund. */
export function ScannerView({ active, onCode, hint }: Props) {
  const [cam, setCam] = useState<CamState>({ kind: 'off' });
  const [torchOn, setTorchOn] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const video = useRef<HTMLVideoElement>(null);
  const handle = useRef<ScannerHandle | null>(null);
  const onCodeRef = useRef(onCode);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const run = active && !hidden && can('scanner');

  useEffect(() => {
    if (!run || !video.current) return;
    let cancelled = false;
    queueMicrotask(() => !cancelled && setCam({ kind: 'starting' }));
    startScanner(video.current, (text) => onCodeRef.current(text))
      .then((h) => {
        if (cancelled) return h.stop();
        handle.current = h;
        setCam({ kind: 'running', torch: h.hasTorch });
      })
      .catch((e: unknown) => !cancelled && setCam({ kind: 'error', error: e instanceof ScannerError ? e.kind : 'failed' }));
    return () => {
      cancelled = true;
      handle.current?.stop();
      handle.current = null;
      setTorchOn(false);
      setCam({ kind: 'off' });
    };
  }, [run, attempt]);

  const toggleTorch = useCallback(async () => {
    await handle.current?.setTorch(!torchOn);
    setTorchOn(!torchOn);
  }, [torchOn]);

  const status =
    cam.kind === 'error' ? t(`scan.${cam.error}`) : cam.kind === 'running' ? (hint ?? t('scan.hint')) : t('scan.starting');

  return (
    <div>
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
              <span>{can('scanner') ? status : t('scan.nocamera')}</span>
              {cam.kind === 'error' && (cam.error === 'denied' || cam.error === 'failed') && (
                <IonButton size="small" fill="outline" onClick={() => setAttempt((a) => a + 1)}>
                  {t('scan.retry')}
                </IonButton>
              )}
            </div>
          </div>
        )}
        {cam.kind === 'running' && cam.torch && (
          <IonButton
            size="small"
            onClick={() => void toggleTorch()}
            style={{ position: 'absolute', right: 'var(--bs-s3)', bottom: 'var(--bs-s3)' }}
            fill={torchOn ? 'solid' : 'outline'}
          >
            {t('scan.torch')}
          </IonButton>
        )}
      </div>
      {cam.kind === 'running' && <p style={{ textAlign: 'center', color: 'var(--bs-text-2)', margin: '0 0 var(--bs-s3)' }}>{status}</p>}
    </div>
  );
}
