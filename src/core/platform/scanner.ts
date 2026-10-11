/**
 * Plattform-Adapter `scanner` (SP-02): Kamera + QR-Erkennung.
 * Web: getUserMedia + BarcodeDetector. Wo der Browser keinen hat (Safari, Chrome unter Windows),
 * übernimmt der Ponyfill `barcode-detector` (zxing-wasm); die .wasm liefern wir selbst aus (offline, kein CDN).
 * Nativ später ML Kit / Vision hinter derselben Schnittstelle.
 */
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

export type ScannerErrorKind = 'denied' | 'nocamera' | 'insecure' | 'failed';

export class ScannerError extends Error {
  constructor(public readonly kind: ScannerErrorKind, message?: string) {
    super(message ?? kind);
  }
}

export interface ScannerHandle {
  stop(): void;
  hasTorch: boolean;
  setTorch(on: boolean): Promise<void>;
}

interface Detector {
  detect(source: CanvasImageSource | ImageBitmapSource): Promise<{ rawValue: string }[]>;
}

let detectorPromise: Promise<Detector> | null = null;

/** QR-Erkenner: nativ, sonst zxing-wasm. Einmal je Sitzung; nach einem Fehler beim nächsten Aufruf neu versuchen. */
export function getQrDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    const Native = (globalThis as { BarcodeDetector?: { new (o: object): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
    if (Native && (await Native.getSupportedFormats().catch((): string[] => [])).includes('qr_code')) {
      return new Native({ formats: ['qr_code'] });
    }
    const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');
    prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
    });
    return new BarcodeDetector({ formats: ['qr_code'] });
  })();
  detectorPromise.catch(() => (detectorPromise = null));
  return detectorPromise;
}

function toScannerError(e: unknown): ScannerError {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return new ScannerError('denied');
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return new ScannerError('nocamera');
  return new ScannerError('failed', e instanceof Error ? e.message : String(e));
}

/**
 * Startet die Rückkamera im Video-Element und meldet jeden erkannten QR-Inhalt.
 * Ein Code wird nur einmal gemeldet, solange er im Bild bleibt (erst nach 2,5 s ohne ihn wieder).
 * `signal`: Abbruch während des Starts – die Kamera wird dann sofort wieder freigegeben.
 */
export async function startScanner(video: HTMLVideoElement, onCode: (text: string) => void, signal?: AbortSignal): Promise<ScannerHandle> {
  if (!window.isSecureContext) throw new ScannerError('insecure');
  if (!navigator.mediaDevices?.getUserMedia) throw new ScannerError('nocamera');

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      // 640×480 reicht für QR auf Etiketten-Distanz und spart Rechenzeit/Akku gegenüber HD
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 30 } },
    });
  } catch (e) {
    throw toScannerError(e);
  }

  const release = () => {
    stream.getTracks().forEach((t) => t.stop());
    // nur das eigene Bild entfernen – ein inzwischen gestarteter Scanner nutzt dasselbe Video-Element
    if (video.srcObject === stream) video.srcObject = null;
  };
  if (signal?.aborted) {
    release();
    throw new ScannerError('failed', 'abgebrochen');
  }

  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play().catch(() => undefined);

  let detector: Detector;
  try {
    detector = await getQrDetector();
  } catch (e) {
    release();
    throw new ScannerError('failed', e instanceof Error ? e.message : String(e));
  }
  if (signal?.aborted) {
    release();
    throw new ScannerError('failed', 'abgebrochen');
  }
  const track = stream.getVideoTracks()[0];
  const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };

  let stopped = false;
  let last = { text: '', at: 0 };
  // ~5 Erkennungen pro Sekunde; nach einem Treffer kurz Pause (der Nutzer reagiert ohnehin erst)
  const INTERVAL_MS = 200;
  const AFTER_HIT_MS = 900;
  let pauseUntil = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async () => {
    if (stopped) return;
    if (video.readyState >= 2 && !document.hidden && Date.now() >= pauseUntil) {
      try {
        const found = await detector.detect(video);
        const text = found[0]?.rawValue;
        const now = Date.now();
        if (text) {
          const isNew = text !== last.text || now - last.at > 2500;
          // jede Sichtung verlängert die Sperre – ein Code im Bild wird nicht alle 2,5 s erneut gemeldet
          last = { text, at: now };
          if (isNew) {
            pauseUntil = now + AFTER_HIT_MS;
            onCode(text);
          }
        }
      } catch {
        /* einzelnes Bild nicht lesbar – weiter */
      }
    }
    timer = setTimeout(() => void tick(), INTERVAL_MS);
  };
  void tick();

  return {
    hasTorch: !!caps.torch,
    async setTorch(on: boolean) {
      await track?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).catch(() => undefined);
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      release();
    },
  };
}
