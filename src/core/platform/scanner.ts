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
  detect(source: CanvasImageSource | ImageBitmapSource): Promise<{ rawValue: string; format?: string; cornerPoints?: { x: number; y: number }[] }[]>;
}

/** QR für eigene Etiketten, EAN/UPC für Packungen. */
export type ScanFormat = 'qr_code' | 'ean_13' | 'ean_8' | 'upc_a' | 'upc_e';
export const QR_ONLY: ScanFormat[] = ['qr_code'];
export const QR_AND_BARCODES: ScanFormat[] = ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e'];

/** Lage eines Treffers im Videobild (Pixel des Kamerabilds). */
export interface ScanHit {
  text: string;
  format: string | null;
  points: { x: number; y: number }[];
  videoWidth: number;
  videoHeight: number;
}

const detectors = new Map<string, Promise<Detector>>();

/** Erkenner für die Formate: nativ, sonst zxing-wasm. Einmal je Formatsatz; nach einem Fehler neu versuchen. */
export function getQrDetector(formats: ScanFormat[] = QR_ONLY): Promise<Detector> {
  const key = formats.join(',');
  let detectorPromise = detectors.get(key);
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    const Native = (globalThis as { BarcodeDetector?: { new (o: object): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
    const supported = Native ? await Native.getSupportedFormats().catch((): string[] => []) : [];
    if (Native && formats.every((f) => supported.includes(f))) {
      return new Native({ formats });
    }
    const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');
    prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
    });
    return new BarcodeDetector({ formats });
  })();
  detectors.set(key, detectorPromise);
  detectorPromise.catch(() => detectors.delete(key));
  return detectorPromise;
}

/*
 * Kamera kurz „warm“ halten: iOS-Homescreen-Apps fragen bei jedem getUserMedia erneut nach der Erlaubnis.
 * Wird der Strom innerhalb von 60 s wieder gebraucht (Tab-Wechsel, nächster Scan), nutzen wir ihn weiter –
 * so kommt die Abfrage höchstens einmal je Sitzung. Im Hintergrund wird sofort freigegeben (Datenschutz, Akku).
 */
const LINGER_MS = 60_000;
let shared: { stream: MediaStream; users: number; timer?: ReturnType<typeof setTimeout> } | null = null;

const live = (s: MediaStream) => s.getVideoTracks().some((t) => t.readyState === 'live');

function stopShared() {
  if (!shared) return;
  clearTimeout(shared.timer);
  shared.stream.getTracks().forEach((t) => t.stop());
  shared = null;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && shared && shared.users === 0) stopShared();
  });
}

async function acquireCamera(): Promise<MediaStream> {
  if (shared && live(shared.stream)) {
    clearTimeout(shared.timer);
    shared.users += 1;
    return shared.stream;
  }
  stopShared();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    // 640×480 reicht für QR auf Etiketten-Distanz und spart Rechenzeit/Akku gegenüber HD
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 30 } },
  });
  shared = { stream, users: 1 };
  return stream;
}

function releaseCamera(stream: MediaStream) {
  if (!shared || shared.stream !== stream) return void stream.getTracks().forEach((t) => t.stop());
  shared.users = Math.max(0, shared.users - 1);
  if (shared.users > 0) return;
  if (document.hidden) return stopShared();
  shared.timer = setTimeout(stopShared, LINGER_MS);
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
export async function startScanner(
  video: HTMLVideoElement,
  onCode: (text: string, hit: ScanHit) => void,
  signal?: AbortSignal,
  formats: ScanFormat[] = QR_ONLY,
  /** jede Sichtung (auch bekannte Codes) – für die Markierung im Bild */
  onSight?: (hit: ScanHit) => void,
): Promise<ScannerHandle> {
  if (!window.isSecureContext) throw new ScannerError('insecure');
  if (!navigator.mediaDevices?.getUserMedia) throw new ScannerError('nocamera');

  let stream: MediaStream;
  try {
    stream = await acquireCamera();
  } catch (e) {
    throw toScannerError(e);
  }

  const release = () => {
    // nur das eigene Bild entfernen – ein inzwischen gestarteter Scanner nutzt dasselbe Video-Element
    if (video.srcObject === stream) video.srcObject = null;
    releaseCamera(stream);
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
    detector = await getQrDetector(formats);
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
  let tickCount = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async () => {
    if (stopped) return;
    // nach einem Treffer seltener prüfen (Markierung bleibt sichtbar), sonst ~5×/s
    if (video.readyState >= 2 && !document.hidden && (Date.now() >= pauseUntil || (tickCount++ & 3) === 0)) {
      try {
        const found = await detector.detect(video);
        const first = found[0];
        const text = first?.rawValue;
        const now = Date.now();
        if (text) {
          onSight?.({ text, format: first?.format ?? null, points: first?.cornerPoints ?? [], videoWidth: video.videoWidth, videoHeight: video.videoHeight });
          const isNew = text !== last.text || now - last.at > 2500;
          // jede Sichtung verlängert die Sperre – ein Code im Bild wird nicht alle 2,5 s erneut gemeldet
          last = { text, at: now };
          if (isNew) {
            pauseUntil = now + AFTER_HIT_MS;
            onCode(text, {
              text,
              format: first?.format ?? null,
              points: first?.cornerPoints ?? [],
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
            });
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
