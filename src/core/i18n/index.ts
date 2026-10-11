import { de, type MessageKey } from './de';

/** Regel 9: alle Texte über t(). Englisch folgt als en.ts mit denselben Schlüsseln. */
export function t(key: MessageKey | (string & {}), vars?: Record<string, string | number>): string {
  const text = (de as Record<string, string>)[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

export type { MessageKey };
export { colorFamily, colorSearchText, colorToEnglish, colorToGerman, otherLanguageName, type ColorFamily } from './colors';
