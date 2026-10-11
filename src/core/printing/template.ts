/**
 * Etiketten-Vorlagen im Format von NiimBlue (github.com/MultiMote/niimblue, MIT, `ExportedLabelTemplate`):
 * Fabric-JSON + Etikett-Eigenschaften in Pixeln der Druckerauflösung. Vorlagen lassen sich deshalb auf
 * niim.blue gestalten, exportieren und hier importieren (freier Editor ohne Eigenbau).
 *
 * Platzhalter in Texten und QR-Codes: `{id}`, `{material}` … sowie `{dt}` (heutiges Datum).
 */

export type PrintDirection = 'left' | 'top';

export interface LabelTemplate {
  /** Stabile ID (für gespeicherte Auswahl) */
  id: string;
  title: string;
  canvas: { version: string; objects: Record<string, unknown>[] };
  label: { printDirection: PrintDirection; size: { width: number; height: number } };
}

/** Ein Datensatz je Etikett (Stapeldruck = mehrere Datensätze). */
export type LabelVariables = Record<string, string>;

// Gleiche Syntax wie NiimBlue (canvas_preprocess.ts), ohne Datumsrechnung.
const VARIABLE_RX = /{\s*(\$?\w+)(?:([+-])(\d+)([yMwdhms]))?\s*(?:\|\s*(.*?)\s*)?}/g;

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Ersetzt Platzhalter; unbekannte bleiben stehen (wie in NiimBlue). */
export function fillVariables(text: string, vars: LabelVariables): string {
  return text.replace(VARIABLE_RX, (source: string, key: string) => {
    const v = vars[key];
    if (v !== undefined) return v;
    if (key === 'dt') return today();
    return source;
  });
}

const RED = /^(#f00|#ff0000|red|rgb\(\s*255\s*,\s*0\s*,\s*0\s*\))$/i;

/** Nutzt die Vorlage Rot (Zweitfarbe)? */
export function templateUsesRed(t: LabelTemplate): boolean {
  return t.canvas.objects.some((o) => ['fill', 'stroke'].some((k) => typeof o[k] === 'string' && RED.test(o[k] as string)));
}

/** Breite in Druckkopf-Richtung (Pixel), um sie gegen das Druckerprofil zu prüfen. */
export function headPixels(t: LabelTemplate): number {
  return t.label.printDirection === 'left' ? t.label.size.height : t.label.size.width;
}

/**
 * Prüft eine importierte Vorlage (NiimBlue-Export) grob auf das erwartete Format.
 * @throws Error mit verständlicher Meldung
 */
export function parseTemplate(json: unknown, fallbackId = 'import'): LabelTemplate {
  const o = json as Partial<LabelTemplate> & { title?: string; id?: string };
  const size = o?.label?.size;
  if (!o?.canvas || !Array.isArray(o.canvas.objects) || !size || !(size.width > 0) || !(size.height > 0)) {
    throw new Error('Keine gültige Etiketten-Vorlage (NiimBlue-Export erwartet).');
  }
  const dir = o.label?.printDirection === 'left' ? 'left' : 'top';
  return {
    id: o.id ?? fallbackId,
    title: o.title ?? 'Importiert',
    canvas: { version: o.canvas.version ?? '7.0.0', objects: o.canvas.objects },
    label: { printDirection: dir, size: { width: size.width, height: size.height } },
  };
}
