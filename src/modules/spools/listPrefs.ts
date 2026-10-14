/**
 * Auswahllisten entschlacken: ausgeblendete Hersteller/Materialien (gemeinsame Einstellung /prefs/lists) und
 * „zuletzt genutzt“ aus dem eigenen Bestand (nichts zu pflegen).
 */
export interface ListPrefs {
  hiddenBrands: string[];
  hiddenMaterials: string[];
}

export const EMPTY_LIST_PREFS: ListPrefs = { hiddenBrands: [], hiddenMaterials: [] };

const strings = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && !!x.trim()))] : []);

export function normalizeListPrefs(v: unknown): ListPrefs {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<ListPrefs>;
  return { hiddenBrands: strings(o.hiddenBrands), hiddenMaterials: strings(o.hiddenMaterials) };
}

/** Ändern immer auf dem aktuellen Server-Stand; ist der nicht lesbar, wird nichts geschrieben. */
export async function updateListPrefs(
  load: () => Promise<unknown>,
  save: (p: ListPrefs) => Promise<unknown>,
  change: (p: ListPrefs) => ListPrefs,
): Promise<ListPrefs> {
  const next = change(normalizeListPrefs(await load()));
  await save(next);
  return next;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Ein- oder ausblenden (Groß/Klein egal). */
export function setHidden(list: string[], value: string, hidden: boolean): string[] {
  const rest = list.filter((x) => !same(x, value));
  return hidden ? [...rest, value] : rest;
}

export const isHidden = (list: string[], value: string) => list.some((x) => same(x, value));

/** Werte aus dem Bestand, neueste Spule zuerst, ohne Doppelte (z. B. Hersteller). */
export function recentValues<S extends { id: number; archived_at?: string | null }>(
  spools: S[],
  pick: (s: S) => string | null | undefined,
  limit = 6,
): string[] {
  const out: string[] = [];
  for (const s of [...spools].sort((a, b) => b.id - a.id)) {
    const v = pick(s)?.trim();
    if (v && !out.some((x) => same(x, v))) out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}
