/**
 * Verbindung zum Niimbot-Drucker über niimbluelib (MIT). Druckablauf wie NiimBlue PrintPreview.onPrint.
 * Web: Bluetooth (Web Bluetooth) und USB (Web Serial) in Chrome/Edge. Nativ später Capacitor-BLE.
 */
import {
  ImageEncoder,
  LabelType,
  NiimbotBluetoothClient,
  NiimbotSerialClient,
  PageColorType,
  PrintTaskCapability,
  printTasksCapabilities,
  type NiimbotAbstractClient,
} from '@mmote/niimbluelib';
import type { PrintDirection } from '../template';

export type Transport = 'bluetooth' | 'usb';

export interface PrinterInfo {
  transport: Transport;
  name: string;
  model: string | null;
  printheadPixels: number | null;
  supportsRed: boolean;
}

let client: NiimbotAbstractClient | null = null;
let info: PrinterInfo | null = null;

export function connectedPrinter(): PrinterInfo | null {
  return client?.isConnected() ? info : null;
}

/** Muss direkt aus einem Klick heraus aufgerufen werden (Geräteauswahl des Browsers). */
export async function connectPrinter(transport: Transport): Promise<PrinterInfo> {
  await disconnectPrinter();
  const c = transport === 'bluetooth' ? new NiimbotBluetoothClient() : new NiimbotSerialClient();
  const conn = await c.connect();
  client = c;
  const meta = c.getModelMetadata();
  const task = c.getPrintTaskType();
  info = {
    transport,
    name: conn.deviceName ?? meta?.model ?? 'Niimbot',
    model: meta?.model ?? null,
    printheadPixels: meta?.printheadPixels ?? null,
    supportsRed: !!task && printTasksCapabilities[task].includes(PrintTaskCapability.SupportDoubleColor),
  };
  return info;
}

export async function disconnectPrinter(): Promise<void> {
  const c = client;
  client = null;
  info = null;
  if (c?.isConnected()) await c.disconnect().catch(() => undefined);
}

export interface PrintJob {
  pages: HTMLCanvasElement[];
  /** Kopien je Seite */
  quantity: number;
  printDirection: PrintDirection;
  twoColor: boolean;
  density?: number;
  onProgress?: (percent: number) => void;
}

/** Druckt alle Seiten in einem Auftrag (Stapeldruck). */
export async function printPages(job: PrintJob): Promise<void> {
  const c = client;
  if (!c?.isConnected()) throw new Error('Kein Drucker verbunden');
  const taskName = c.getPrintTaskType();
  if (!taskName) throw new Error('Druckermodell unbekannt – von niimbluelib nicht unterstützt');
  const meta = c.getModelMetadata();
  const pageColor = job.twoColor && info?.supportsRed ? PageColorType.DoubleColor : PageColorType.SingleColor;
  const total = job.pages.length * job.quantity;

  const onProgress = (e: { page: number; pagePrintProgress: number; pageFeedProgress: number }) => {
    const page = (e.pagePrintProgress + e.pageFeedProgress) / 2;
    job.onProgress?.(Math.min(100, Math.floor(((e.page + page / 100) / total) * 100)));
  };

  c.stopHeartbeat();
  c.on('printprogress', onProgress);
  const task = c.protocol.newPrintTask(taskName, {
    totalPages: total,
    density: job.density ?? meta?.densityDefault ?? 3,
    labelType: LabelType.WithGaps,
    pageColor,
    statusPollIntervalMs: 100,
    statusTimeoutMs: 8_000,
  });
  try {
    await task.printInit();
    for (const page of job.pages) {
      await task.printPage(ImageEncoder.encodeCanvas(page, pageColor, job.printDirection), job.quantity);
      await task.waitForPageFinished();
    }
    await task.waitForFinished();
  } finally {
    await task.printEnd().catch(() => undefined);
    c.off('printprogress', onProgress);
    c.startHeartbeat();
  }
}
