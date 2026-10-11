import table from './drying.json';

export interface DryingAdvice {
  /** Schlüssel der Tabelle, z. B. PETG für „PETG-CF“ */
  key: string;
  temp: [number, number];
  hours: [number, number];
  ams: { temp: number; hours: number } | null;
  /** obere Temperatur liegt über dem, was viele Dörrautomaten schaffen */
  tooHotForDehydrator: boolean;
}

type Row = { temp: number[]; hours: number[]; ams?: { temp: number; hours: number } };
const MATERIALS = table.materials as Record<string, Row>;
const ALIASES = table.aliases as Record<string, string>;

/**
 * Trocknungsempfehlung je Material (SP-15). Gleiche Auflösung wie Bambuddy (dryingPresets.ts):
 * erstes Wort, dann ohne Zusatz („PETG-CF“ → PETG), dann Aliasse. Unbekannt → null (nicht raten).
 */
export function dryingAdvice(material: string | null | undefined): DryingAdvice | null {
  const raw = (material ?? '').trim().split(/\s+/)[0]!.toUpperCase();
  for (const candidate of [raw, raw.split('-')[0]!]) {
    const key = ALIASES[candidate] ?? candidate;
    const row = MATERIALS[key];
    if (row) {
      const temp: [number, number] = [row.temp[0]!, row.temp[1]!];
      return { key, temp, hours: [row.hours[0]!, row.hours[1]!], ams: row.ams ?? null, tooHotForDehydrator: temp[1] > table.dehydratorMax };
    }
  }
  return null;
}

/** Ganze Tage seit einem Datum (JJJJ-MM-TT oder ISO), lokal gerechnet. */
export function daysSince(iso: string, now = new Date()): number {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((start(now) - start(d)) / 86_400_000);
}

/** Heutiges Datum als JJJJ-MM-TT (lokal). */
export function todayIso(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
