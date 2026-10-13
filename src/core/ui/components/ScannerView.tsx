import { IonButton } from '@ionic/react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { t } from '@/core/i18n';
import { can, isEmbedded, openStandalone, QR_ONLY, scanFeedback, ScannerError, startScanner, type ScanFormat, type ScanHit, type ScannerErrorKind, type ScannerHandle } from '@/core/platform';

type CamState = { kind: 'off' } | { kind: 'starting' } | { kind: 'running'; torch: boolean } | { kind: 'error'; error: ScannerErrorKind };

interface Props {
  /** Kamera nur, solange true (z. B. Tab sichtbar) */
  active: boolean;
  onCode: (text: string) => void;
  /** Hinweis unter dem Bild im laufenden Zustand */
  hint?: string;
  /** Welche Codes erkannt werden: nur QR (Etiketten) oder auch Packungs-Barcodes */
  formats?: ScanFormat[];
  /** nur passende Codes melden (und nur dann piepen) */
  accept?: (text: string) => boolean;
}

/** Treffer-Umriss: Videopixel → Anzeige (object-fit: cover). */
function toView(hit: ScanHit, el: HTMLElement): string | null {
  if (!hit.points.length || !hit.videoWidth) return null;
  const { width: w, height: h } = el.getBoundingClientRect();
  const scale = Math.max(w / hit.videoWidth, h / hit.videoHeight);
  const ox = (w - hit.videoWidth * scale) / 2;
  const oy = (h - hit.videoHeight * scale) / 2;
  return hit.points.map((p) => `${(p.x * scale + ox).toFixed(1)},${(p.y * scale + oy).toFixed(1)}`).join(' ');
}

/** Ecken des Zielrahmens (statt vollem Rahmen – das Motiv bleibt sichtbar). */
function Corners({ inset }: { inset: CSSProperties['inset'] }) {
  const c = (pos: CSSProperties): CSSProperties => ({
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: 'var(--bs-accent)',
    borderStyle: 'solid',
    borderWidth: 0,
    ...pos,
  });
  return (
    <div aria-hidden style={{ position: 'absolute', inset, boxShadow: '0 0 0 100vmax var(--bs-scrim)', borderRadius: 'var(--bs-r-md)' }}>
      <span style={c({ top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 'var(--bs-r-md)' })} />
      <span style={c({ top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 'var(--bs-r-md)' })} />
      <span style={c({ bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 'var(--bs-r-md)' })} />
      <span style={c({ bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 'var(--bs-r-md)' })} />
    </div>
  );
}

/**
 * Baustein „Kamera mit Zielrahmen“ (SP-02/SP-11). Anvisierhilfe: quadratisch für QR, breit mit Ziellinie
 * für Packungs-Barcodes; der erkannte Code wird kurz umrandet. Kamera aus, wenn inaktiv oder im Hintergrund.
 */
export function ScannerView({ active, onCode, hint, formats = QR_ONLY, accept }: Props) {
  const [cam, setCam] = useState<CamState>({ kind: 'off' });
  const [torchOn, setTorchOn] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [mark, setMark] = useState<{ points: string; at: number } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const handle = useRef<ScannerHandle | null>(null);
  const onCodeRef = useRef(onCode);
  const acceptRef = useRef(accept);
  const [attempt, setAttempt] = useState(0);
  const barcodes = formats.some((f) => f !== 'qr_code');
  const formatKey = formats.join(',');

  useEffect(() => {
    onCodeRef.current = onCode;
    acceptRef.current = accept;
  }, [onCode, accept]);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Umriss nach kurzer Zeit ausblenden
  useEffect(() => {
    if (!mark) return;
    // verschwindet, sobald der Code nicht mehr gesehen wird
    const id = setTimeout(() => setMark(null), 1000);
    return () => clearTimeout(id);
  }, [mark]);

  const run = active && !hidden && can('scanner');

  useEffect(() => {
    if (!run || !video.current) return;
    let cancelled = false;
    const abort = new AbortController();
    queueMicrotask(() => !cancelled && setCam({ kind: 'starting' }));
    startScanner(
      video.current,
      (text) => {
        scanFeedback();
        onCodeRef.current(text);
      },
      {
        signal: abort.signal,
        formats: formatKey.split(',') as ScanFormat[],
        accept: (text) => acceptRef.current?.(text) ?? true,
        onSight: (hit) => {
          const points = box.current ? toView(hit, box.current) : null;
          if (points) setMark({ points, at: Date.now() });
        },
        // Kamera vom System beendet (andere App, Anruf): Meldung mit „erneut starten“ statt eingefrorenem Bild
        onEnded: () => !cancelled && setCam({ kind: 'error', error: 'failed' }),
      },
    )
      .then((h) => {
        if (cancelled) return h.stop();
        handle.current = h;
        setCam({ kind: 'running', torch: h.hasTorch });
      })
      .catch((e: unknown) => !cancelled && setCam({ kind: 'error', error: e instanceof ScannerError ? e.kind : 'failed' }));
    return () => {
      cancelled = true;
      abort.abort();
      handle.current?.stop();
      handle.current = null;
      setTorchOn(false);
      setCam({ kind: 'off' });
    };
  }, [run, attempt, formatKey]);

  const toggleTorch = useCallback(async () => {
    await handle.current?.setTorch(!torchOn);
    setTorchOn(!torchOn);
  }, [torchOn]);

  // Eingebettet (Bambuddy-Seitenleiste) blockiert der Rahmen die Kamera – dann den eigentlichen Grund nennen
  const embeddedBlock = isEmbedded() && (!can('scanner') || cam.kind === 'error');
  const status =
    cam.kind === 'error'
      ? embeddedBlock
        ? t('app.embedded')
        : t(`scan.${cam.error}`)
      : cam.kind === 'running'
        ? (hint ?? (barcodes ? t('scan.hintAny') : t('scan.hint')))
        : t('scan.starting');

  return (
    <div>
      <div
        ref={box}
        style={{
          position: 'relative',
          aspectRatio: barcodes ? '4 / 3' : '1',
          maxWidth: 420,
          margin: '0 auto var(--bs-s3)',
          borderRadius: 'var(--bs-r-lg)',
          overflow: 'hidden',
          background: 'var(--bs-surface-2)',
        }}
      >
        <video ref={video} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: cam.kind === 'running' ? 'block' : 'none' }} />
        {cam.kind === 'running' && (
          <>
            {/* Anvisierhilfe: QR quadratisch; mit Barcodes breit + Ziellinie */}
            <Corners inset={barcodes ? '22% 8%' : '18%'} />
            {barcodes && (
              <div
                aria-hidden
                style={{ position: 'absolute', left: '10%', right: '10%', top: '50%', height: 2, background: 'var(--bs-critical)', opacity: 0.8, boxShadow: '0 0 6px var(--bs-critical)' }}
              />
            )}
            {mark && (
              <svg aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                <polygon points={mark.points} fill="rgba(var(--bs-accent-rgb), 0.2)" stroke="var(--bs-accent)" strokeWidth={4} strokeLinejoin="round" />
              </svg>
            )}
          </>
        )}
        {cam.kind !== 'running' && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 'var(--bs-s5)', textAlign: 'center', color: 'var(--bs-text-2)' }}>
            <div style={{ display: 'grid', gap: 'var(--bs-s3)', justifyItems: 'center' }}>
              <span>{can('scanner') ? status : isEmbedded() ? t('app.embedded') : t('scan.nocamera')}</span>
              {embeddedBlock && (
                <IonButton size="small" onClick={openStandalone}>
                  {t('app.openStandalone')}
                </IonButton>
              )}
              {!embeddedBlock && cam.kind === 'error' && (cam.error === 'denied' || cam.error === 'failed') && (
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
