/**
 * Etikettendrucker werden über Profile beschrieben, nie fest verdrahtet.
 * Werte für Niimbot aus niimbluelib (src/printer_models.ts).
 * Layouts rechnen in Millimetern; erst beim Druck wird auf die Pixelbreite gerastert.
 */

export type Connection = 'bluetooth' | 'usb' | 'print-service';
export type InkColor = 'black' | 'red';

export interface LabelPrinterProfile {
  id: string;
  name: string;
  /** Modellname in niimbluelib (PrinterModel) */
  niimbotModel: string;
  dpi: number;
  /** Pixel des Druckkopfs = maximale Druckbreite */
  printheadPixels: number;
  colors: InkColor[];
  connections: Connection[];
}

export const PRINTER_PROFILES: Record<string, LabelPrinterProfile> = {
  'niimbot-b1-pro': {
    id: 'niimbot-b1-pro',
    name: 'Niimbot B1 Pro',
    niimbotModel: 'B1_PRO',
    dpi: 300,
    printheadPixels: 567,
    colors: ['black', 'red'],
    connections: ['bluetooth', 'usb', 'print-service'],
  },
  'niimbot-b1': {
    id: 'niimbot-b1',
    name: 'Niimbot B1',
    niimbotModel: 'B1',
    dpi: 203,
    printheadPixels: 384,
    colors: ['black'],
    connections: ['bluetooth', 'usb', 'print-service'],
  },
};

export const DEFAULT_PRINTER_PROFILE = 'niimbot-b1-pro';

export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi);
}

/** Maximale Druckbreite in mm (auf 0,1 mm gerundet). */
export function printWidthMm(p: LabelPrinterProfile): number {
  return Math.round((p.printheadPixels / p.dpi) * 25.4 * 10) / 10;
}

/** Zweitfarbe auf einfarbigen Druckern wird schwarz. */
export function resolveInk(wanted: InkColor, p: LabelPrinterProfile): InkColor {
  return p.colors.includes(wanted) ? wanted : 'black';
}
