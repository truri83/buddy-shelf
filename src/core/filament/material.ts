/**
 * Materialfamilie und Unterart: „PLA+“, „PLA 2.0+“, „PLA-CF“ gehören zur Familie PLA; die Unterart ist der Rest
 * („+“, „2.0+“, „CF“) plus die Sorte der Spule („Matte“). Grundlage für Trocknung, Filter und Gruppierung.
 */

/** Bekannte Familien (Reihenfolge = Anzeige). */
export const FAMILIES = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'PA', 'PC', 'PVA', 'HIPS', 'PP'] as const;
export type MaterialFamily = (typeof FAMILIES)[number];

/** Schreibweisen, die zu einer Familie gehören (Großbuchstaben, ohne Zusatz). */
const ALIASES: Record<string, MaterialFamily> = {
  PET: 'PETG',
  PCTG: 'PETG',
  TPE: 'TPU',
  NYLON: 'PA',
  PAHT: 'PA',
  PPA: 'PA',
  PLAPLUS: 'PLA',
  HTPLA: 'PLA',
};

const isFamily = (v: string): v is MaterialFamily => (FAMILIES as readonly string[]).includes(v);

/** „PLA+“ → PLA, „PETG-CF“ → PETG, „PA6-CF“ → PA, „Nylon“ → PA, „PEEK“ → null. */
export function materialFamily(material: string | null | undefined): MaterialFamily | null {
  const m = (material ?? '').trim().toUpperCase();
  if (!m) return null;
  const word = m.split(/\s+/)[0]!;
  const letters = /^[A-Z]+/.exec(word)?.[0] ?? '';
  for (const c of [word, word.replace(/[^A-Z0-9]/g, ''), letters]) {
    if (isFamily(c)) return c;
    if (ALIASES[c]) return ALIASES[c];
  }
  return null;
}

/** Unterart: Rest des Materials nach der Familie plus Sorte – „PLA+“ + „Matte“ → „+ Matte“. */
export function materialVariant(material: string, subtype?: string | null): string {
  const fam = materialFamily(material);
  let rest = material.trim();
  if (fam && rest.toUpperCase().startsWith(fam)) rest = rest.slice(fam.length);
  rest = rest.replace(/^[\s-]+/, '');
  return [rest, subtype?.trim()].filter(Boolean).join(' ');
}

/** Sorte nur, wenn sie nicht bloß der Farbname ist (Spoolman liefert oft den Filamentnamen = Farbe als Sorte). */
export function cleanSubtype(s: { subtype?: string | null; color_name?: string | null }): string | null {
  const sub = s.subtype?.trim();
  if (!sub) return null;
  return s.color_name && sub.toLowerCase() === s.color_name.trim().toLowerCase() ? null : sub;
}

/** Text fürs Material-Abzeichen: „PLA+ Matte“, ohne doppelten Farbnamen. */
export function materialLabel(s: { material: string; subtype?: string | null; color_name?: string | null }): string {
  return [s.material, cleanSubtype(s)].filter(Boolean).join(' ');
}
