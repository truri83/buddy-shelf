/**
 * Eigene Angaben zu Lagerorten, die Bambuddy nicht kennt: Symbol (Emoji) je Ort und der Standard-Ort für neue Spulen.
 * Liegen in den gemeinsamen Einstellungen (/prefs/locations), gelten also auf allen Geräten.
 */
export interface LocationPrefs {
  /** Lagerort-ID → Emoji */
  icons: Record<string, string>;
  /** neue Spulen landen hier */
  defaultId: number | null;
}

export const EMPTY_LOCATION_PREFS: LocationPrefs = { icons: {}, defaultId: null };

/** Vorschläge im Bearbeiten-Blatt. */
export const LOCATION_EMOJIS = ['📦', '🗄️', '🗃️', '🧺', '🛍️', '🔥', '🌵', '❄️', '🧰', '🖨️', '🏠', '⭐'] as const;

/** Gespeicherten Wert robust lesen (fehlende/kaputte Teile → leer). */
export function normalizeLocationPrefs(v: unknown): LocationPrefs {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<LocationPrefs>;
  const icons: Record<string, string> = {};
  if (o.icons && typeof o.icons === 'object') {
    for (const [k, e] of Object.entries(o.icons)) if (typeof e === 'string' && e.trim()) icons[k] = e.trim();
  }
  return { icons, defaultId: typeof o.defaultId === 'number' ? o.defaultId : null };
}

/**
 * Ändern immer auf dem aktuellen Server-Stand: erst lesen, dann schreiben. Kann nicht gelesen werden (offline,
 * noch nicht geladen), wird nichts geschrieben – sonst würden leere Standardwerte alle Symbole löschen.
 */
export async function updateLocationPrefs(
  load: () => Promise<unknown>,
  save: (p: LocationPrefs) => Promise<unknown>,
  change: (p: LocationPrefs) => LocationPrefs,
): Promise<LocationPrefs> {
  const next = change(normalizeLocationPrefs(await load()));
  await save(next);
  return next;
}

/** Symbol und Standard für einen Ort setzen (Standard abwählen nur, wenn dieser Ort Standard war). */
export function withLocation(p: LocationPrefs, id: number, icon: string, isDefault: boolean): LocationPrefs {
  const icons = { ...p.icons };
  if (icon.trim()) icons[id] = icon.trim();
  else delete icons[id];
  const defaultId = isDefault ? id : p.defaultId === id ? null : p.defaultId;
  return { icons, defaultId };
}

/** Ort ist weg: seine Angaben entfernen. */
export function withoutLocation(p: LocationPrefs, id: number): LocationPrefs {
  const icons = { ...p.icons };
  delete icons[id];
  return { icons, defaultId: p.defaultId === id ? null : p.defaultId };
}

/** Standard-Ort, solange es ihn noch gibt. */
export function defaultLocationId(p: LocationPrefs, locations: { id: number }[]): number | null {
  return p.defaultId != null && locations.some((l) => l.id === p.defaultId) ? p.defaultId : null;
}

/** „📦 Regal oben“ für Auswahllisten ohne eigenes Symbol-Feld. */
export function locationText(name: string, icon?: string | null): string {
  return icon ? `${icon} ${name}` : name;
}

/** Eigene Eingabe auf ein Zeichen kürzen (ein Emoji kann aus mehreren Codepunkten bestehen). */
export function symbolOf(text: string): string {
  const s = text.trim();
  if (!s) return '';
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const first = new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(s)[Symbol.iterator]().next();
    return first.done ? '' : first.value.segment;
  }
  return Array.from(s)[0] ?? '';
}
