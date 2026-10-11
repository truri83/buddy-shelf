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
export type ScanFormat = 'qr_code' | 'ean_13' | 'ean_8' | 'upc_a';
export const QR_ONLY: ScanFormat[] = ['qr_code'];
// UPC-E bewusst nicht: kommt als 8 Ziffern, Prüfziffer gilt für die UPC-A-Langform (auf Filament kaum genutzt)
export const QR_AND_BARCODES: ScanFormat[] = ['qr_code', 'ean_13', 'ean_8', 'upc_a'];
export const BARCODES_ONLY: ScanFormat[] = ['ean_13', 'ean_8', 'upc_a'];

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
interface Shared {
  stream: MediaStream;
  users: number;
  timer?: ReturnType<typeof setTimeout>;
}
let shared: Shared | null = null;
/** laufende Anfrage – gleichzeitige Starts teilen sich eine Kamera-Abfrage */
let pending: Promise<MediaStream> | null = null;

const live = (s: MediaStream) => s.getVideoTracks().some((t) => t.readyState === 'live');

function stopShared(entry: Shared | null = shared) {
  if (!entry) return;
  clearTimeout(entry.timer);
  entry.stream.getTracks().forEach((t) => t.stop());
  if (shared === entry) shared = null;
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
  if (!pending) {
    stopShared();
    pending = navigator.mediaDevices
      .getUserMedia({
        audio: false,
        // 640×480 reicht für QR auf Etiketten-Distanz und spart Rechenzeit/Akku gegenüber HD
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 30 } },
      })
      .then((stream) => {
        shared = { stream, users: 0 };
        return stream;
      })
      .finally(() => (pending = null));
  }
  const stream = await pending;
  if (shared?.stream === stream) {
    clearTimeout(shared.timer);
    shared.users += 1;
  }
  return stream;
}

function releaseCamera(stream: MediaStream) {
  const entry = shared;
  if (!entry || entry.stream !== stream) return void stream.getTracks().forEach((t) => t.stop());
  entry.users = Math.max(0, entry.users - 1);
  if (entry.users > 0) return;
  if (document.hidden) return stopShared(entry);
  clearTimeout(entry.timer);
  // der Timer gilt nur diesem Strom und nur, wenn ihn bis dahin niemand wieder übernommen hat
  entry.timer = setTimeout(() => entry.users === 0 && stopShared(entry), LINGER_MS);
}

/** Nur für Tests: Kamera-Verwaltung direkt ansprechen. */
export const _camera = { acquire: acquireCamera, release: releaseCamera, LINGER_MS };

function toScannerError(e: unknown): ScannerError {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return new ScannerError('denied');
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return new ScannerError('nocamera');
  return new ScannerError('failed', e instanceof Error ? e.message : String(e));
}

/** Welcher Scanner ein Video-Element gerade „besitzt“ – mehrere Starts nacheinander stören sich nicht. */
const owners = new WeakMap<HTMLVideoElement, symbol>();

export interface ScannerOptions {
  signal?: AbortSignal;
  formats?: ScanFormat[];
  /** jede Sichtung (auch bekannte Codes) – für die Markierung im Bild */
  onSight?: (hit: ScanHit) => void;
  /** nur Codes, die hier true liefern, werden gemeldet (z. B. nur Packungs-Barcodes) */
  accept?: (text: string) => boolean;
  /** Kamera wurde vom System beendet (andere App, Anruf) */
  onEnded?: () => void;
}

/**
 * Startet die Rückkamera im Video-Element und meldet jeden erkannten Code.
 * Ein Code wird nur einmal gemeldet, solange er im Bild bleibt (erst nach 2,5 s ohne ihn wieder).
 */
export async function startScanner(video: HTMLVideoElement, onCode: (text: string, hit: ScanHit) => void, opts: ScannerOptions = {}): Promise<ScannerHandle> {
  const { signal, formats = QR_ONLY, onSight, accept, onEnded } = opts;
  if (!window.isSecureContext) throw new ScannerError('insecure');
  if (!navigator.mediaDevices?.getUserMedia) throw new ScannerError('nocamera');

  let stream: MediaStream;
  try {
    stream = await acquireCamera();
  } catch (e) {
    throw toScannerError(e);
  }

  const me = Symbol('scanner');
  let released = false;
  let torch = false;
  const track = stream.getVideoTracks()[0];
  const release = () => {
    if (released) return;
    released = true;
    // Taschenlampe aus, bevor der Strom (warm) weiterlebt
    if (torch) void track?.applyConstraints({ advanced: [{ torch: false } as MediaTrackConstraintSet] }).catch(() => undefined);
    if (owners.get(video) === me) {
      owners.delete(video);
      video.srcObject = null;
    }
    releaseCamera(stream);
  };
  if (signal?.aborted) {
    release();
    throw new ScannerError('failed', 'abgebrochen');
  }

  owners.set(video, me);
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
  const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
  const ended = () => onEnded?.();
  track?.addEventListener('ended', ended);

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
        // erster passender Code (z. B. EAN neben einem QR auf der Packung)
        const first = found.find((f) => !accept || accept(f.rawValue));
        const text = first?.rawValue;
        const now = Date.now();
        if (first && text) {
          const hit: ScanHit = { text, format: first.format ?? null, points: first.cornerPoints ?? [], videoWidth: video.videoWidth, videoHeight: video.videoHeight };
          onSight?.(hit);
          const isNew = text !== last.text || now - last.at > 2500;
          // jede Sichtung verlängert die Sperre – ein Code im Bild wird nicht alle 2,5 s erneut gemeldet
          last = { text, at: now };
          if (isNew) {
            pauseUntil = now + AFTER_HIT_MS;
            onCode(text, hit);
          }
        }
      } catch {
        /* einzelnes Bild nicht lesbar – weiter */
      }
    }
    if (!stopped) timer = setTimeout(() => void tick(), INTERVAL_MS);
  };
  void tick();

  return {
    hasTorch: !!caps.torch,
    async setTorch(on: boolean) {
      torch = on;
      await track?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).catch(() => undefined);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      track?.removeEventListener('ended', ended);
      release();
    },
  };
}
