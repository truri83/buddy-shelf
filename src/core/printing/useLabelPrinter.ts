import { useSyncExternalStore } from 'react';
import { saveFile } from '@/core/platform';
import type { PrinterInfo, Transport } from './engine';
import { DEFAULT_PRINTER_PROFILE, PRINTER_PROFILES } from './profiles';
import { templateUsesRed, type LabelTemplate, type LabelVariables } from './template';

/** Fabric + niimbluelib erst laden, wenn ein Etikett gebraucht wird (App bleibt schlank). */
export const loadEngine = () => import('./engine');

export interface LabelPrinterState {
  status: 'idle' | 'connecting' | 'printing' | 'error';
  printer: PrinterInfo | null;
  progress: number;
  error: string | null;
}

let state: LabelPrinterState = { status: 'idle', printer: null, progress: 0, error: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<LabelPrinterState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Rot drucken? Nur wenn die Vorlage Rot nutzt und der Drucker (bzw. das Profil) es kann. */
function twoColorFor(template: LabelTemplate): boolean {
  if (!templateUsesRed(template)) return false;
  if (state.printer) return state.printer.supportsRed;
  return PRINTER_PROFILES[DEFAULT_PRINTER_PROFILE]?.colors.includes('red') ?? false;
}

async function connect(transport: Transport) {
  set({ status: 'connecting', error: null });
  try {
    const engine = await loadEngine();
    set({ status: 'idle', printer: await engine.connectPrinter(transport) });
  } catch (e) {
    set({ status: 'error', printer: null, error: message(e) });
  }
}

async function disconnect() {
  const engine = await loadEngine();
  await engine.disconnectPrinter();
  set({ status: 'idle', printer: null });
}

/** Vorschau als Data-URL – exakt das Bild, das gedruckt wird. */
async function preview(template: LabelTemplate, vars: LabelVariables): Promise<string> {
  const engine = await loadEngine();
  return (await engine.renderLabel(template, vars, { twoColor: twoColorFor(template) })).toDataURL('image/png');
}

/** Stapeldruck: ein Datensatz je Etikett, `quantity` Kopien je Etikett. */
/** @returns true, wenn alles gedruckt wurde */
async function print(template: LabelTemplate, records: LabelVariables[], quantity = 1): Promise<boolean> {
  set({ status: 'printing', progress: 0, error: null });
  try {
    const engine = await loadEngine();
    const twoColor = twoColorFor(template);
    const pages = [];
    for (const r of records) pages.push(await engine.renderLabel(template, r, { twoColor }));
    await engine.printPages({
      pages,
      quantity,
      printDirection: template.label.printDirection,
      twoColor,
      onProgress: (progress) => set({ progress }),
    });
    set({ status: 'idle', progress: 100 });
    return true;
  } catch (e) {
    set({ status: 'error', error: message(e), printer: (await loadEngine()).connectedPrinter() });
    return false;
  }
}

/** Ersatzweg ohne Drucker: PNG je Etikett speichern (z. B. iPhone, später Druckdienst). */
async function savePng(template: LabelTemplate, records: LabelVariables[], name: (r: LabelVariables, i: number) => string) {
  const engine = await loadEngine();
  for (const [i, r] of records.entries()) {
    const canvas = await engine.renderLabel(template, r, { twoColor: twoColorFor(template) });
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (blob) saveFile(blob, name(r, i));
  }
}

/** Fehler vom letzten Versuch vergessen (beim erneuten Öffnen des Druckblatts). */
function clearError() {
  if (state.error || state.status === 'error') set({ error: null, status: 'idle' });
}

export function useLabelPrinter() {
  const s = useSyncExternalStore(subscribe, () => state);
  return { ...s, connect, disconnect, preview, print, savePng, clearError };
}
