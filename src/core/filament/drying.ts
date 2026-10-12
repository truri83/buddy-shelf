import { storage } from '@/core/platform';
import table from './drying.json';

const MAX_KEY = 'dry.dehydratorMax';

/** Höchsttemperatur des eigenen Dörrautomaten (°C), pro Gerät; null = unbekannt → kein Hinweis. */
export const getDehydratorMax = () => storage.get<number | null>(MAX_KEY, null);
export const setDehydratorMax = (v: number | null) => storage.set(MAX_KEY, v);

export interface DryingAdvice {
  /** Schlüssel der Tabelle, z. B. PETG für „PETG-CF“ */
  key: string;
  temp: [number, number];
  hours: [number, number];
  ams: { temp: number; hours: number } | null;
  /** obere Temperatur liegt über der eingestellten Höchsttemperatur des Dörrautomaten */
  tooHotForDehydrator: boolean;
}

type Row = { temp: number[]; hours: number[]; ams?: { temp: number; hours: number } };
const MATERIALS = table.materials as Record<string, Row>;
const ALIASES = table.aliases as Record<string, string>;
const REMINDER = table.reminderDays as Record<string, number>;
const FACTOR = table.storageFactor as Record<string, number | null>;

/** Tabellen-Schlüssel wie Bambuddy: erstes Wort, ohne Zusatz („PETG-CF“ → PETG), Aliasse. */
function materialKey(material: string | null | undefined): string | null {
  const raw = (material ?? '').trim().split(/\s+/)[0]!.toUpperCase();
  for (const candidate of [raw, raw.split('-')[0]!]) {
    const key = ALIASES[candidate] ?? candidate;
    if (MATERIALS[key]) return key;
  }
  return null;
}

/**
 * Trocknungsempfehlung je Material (SP-15). Gleiche Auflösung wie Bambuddy (dryingPresets.ts):
 * erstes Wort, dann ohne Zusatz („PETG-CF“ → PETG), dann Aliasse. Unbekannt → null (nicht raten).
 */
export function dryingAdvice(material: string | null | undefined, dehydratorMax: number | null = getDehydratorMax()): DryingAdvice | null {
  const key = materialKey(material);
  const row = key ? MATERIALS[key] : undefined;
  if (!key || !row) return null;
  const temp: [number, number] = [row.temp[0]!, row.temp[1]!];
  return {
    key,
    temp,
    hours: [row.hours[0]!, row.hours[1]!],
    ams: row.ams ?? null,
    tooHotForDehydrator: dehydratorMax != null && temp[1] > dehydratorMax,
  };
}

export interface DryingDue {
  /** Tage zwischen zwei Trocknungen bei dieser Lagerung */
  intervalDays: number;
  /** negativ = überfällig */
  dueInDays: number;
  due: boolean;
}

/**
 * Feuchtigkeits-Erinnerung (Vorbild Spooly): Abstand je Material × Faktor der Lagerungsart, gezählt ab
 * „zuletzt getrocknet“ – sonst ab Anlage der Spule. OVP oder ohne Lagerungsart: keine Erinnerung.
 */
export function dryingDue(
  s: { material: string; storage_type?: string | null; dried_at?: string | null; created_at: string },
  now = new Date(),
): DryingDue | null {
  const key = materialKey(s.material);
  const base = key ? REMINDER[key] : undefined;
  const factor = s.storage_type ? FACTOR[s.storage_type] : null;
  if (!base || factor == null) return null;
  const intervalDays = Math.round(base * factor);
  const since = daysSince(s.dried_at ?? s.created_at.slice(0, 10), now);
  return { intervalDays, dueInDays: intervalDays - since, due: since >= intervalDays };
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
