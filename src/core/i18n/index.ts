import { de, type MessageKey } from './de';

/** Regel 9: alle Texte über t(). Englisch folgt als en.ts mit denselben Schlüsseln. */
export function t(key: MessageKey | (string & {}), vars?: Record<string, string | number>): string {
  const text = (de as Record<string, string>)[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

export type { MessageKey };
export { colorFamily, colorSearchText, colorToEnglish, colorToGerman, foldGerman, otherLanguageName, type ColorFamily } from './colors';

/** Zahlen in deutscher Schreibweise (1.000 statt 1000). */
/** Datum deutsch, z. B. 11.10.2026 (JJJJ-MM-TT wird lokal gelesen). */
export const fmtDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('de-DE');

export const fmtNum = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
