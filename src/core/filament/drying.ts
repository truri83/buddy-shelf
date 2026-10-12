import defaults from './drying.json';
import { materialFamily } from './material';

/** Werte je Materialfamilie – gepflegt unter Mehr → Trocknung. */
export interface DryingRow {
  temp: [number, number];
  hours: [number, number];
  /** Bambuddys Standard für das AMS 2 Pro (nur Anzeige) */
  ams: { temp: number; hours: number } | null;
  /** Tage bis zur nächsten Trocknung, wenn die Spule offen liegt; null = keine Erinnerung */
  reminderDays: number | null;
}

export type StorageKind = 'sealed' | 'bag' | 'drybox' | 'open';

export interface DryingConfig {
  materials: Record<string, DryingRow>;
  /** Faktor auf reminderDays je Lagerungsart; null = keine Erinnerung (z. B. OVP) */
  storageFactor: Record<StorageKind, number | null>;
  /** Höchsttemperatur des eigenen Dörrautomaten (°C); null = schafft alles → kein Hinweis */
  dehydratorMax: number | null;
}

export const DEFAULT_DRYING: DryingConfig = {
  materials: defaults.materials as unknown as Record<string, DryingRow>,
  storageFactor: defaults.storageFactor as Record<StorageKind, number | null>,
  dehydratorMax: defaults.dehydratorMax as number | null,
};

/** Gespeicherte Werte über die Startwerte legen (fehlende Familien/Felder bleiben Standard). */
export function mergeDrying(saved: Partial<DryingConfig> | null | undefined): DryingConfig {
  if (!saved) return DEFAULT_DRYING;
  return {
    materials: { ...DEFAULT_DRYING.materials, ...(saved.materials ?? {}) },
    storageFactor: { ...DEFAULT_DRYING.storageFactor, ...(saved.storageFactor ?? {}) },
    dehydratorMax: saved.dehydratorMax === undefined ? DEFAULT_DRYING.dehydratorMax : saved.dehydratorMax,
  };
}

export interface DryingAdvice {
  /** Materialfamilie, z. B. PLA für „PLA+“ */
  key: string;
  temp: [number, number];
  hours: [number, number];
  ams: { temp: number; hours: number } | null;
  /** obere Temperatur liegt über der eingestellten Höchsttemperatur des Dörrautomaten */
  tooHotForDehydrator: boolean;
}

/** Trocknungsempfehlung der Materialfamilie (SP-15). Unbekannt → null (nicht raten). */
export function dryingAdvice(material: string | null | undefined, cfg: DryingConfig = DEFAULT_DRYING): DryingAdvice | null {
  const key = materialFamily(material);
  const row = key ? cfg.materials[key] : undefined;
  if (!key || !row) return null;
  return {
    key,
    temp: row.temp,
    hours: row.hours,
    ams: row.ams ?? null,
    tooHotForDehydrator: cfg.dehydratorMax != null && row.temp[1] > cfg.dehydratorMax,
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
 * Feuchtigkeits-Erinnerung (Vorbild Spooly): Abstand der Familie × Faktor der Lagerungsart, gezählt ab
 * „zuletzt getrocknet“ – sonst ab Anlage der Spule. OVP oder ohne Lagerungsart: keine Erinnerung.
 */
export function dryingDue(
  s: { material: string; storage_type?: string | null; dried_at?: string | null; created_at: string },
  cfg: DryingConfig = DEFAULT_DRYING,
  now = new Date(),
): DryingDue | null {
  const key = materialFamily(s.material);
  const base = key ? cfg.materials[key]?.reminderDays : null;
  const factor = s.storage_type ? cfg.storageFactor[s.storage_type as StorageKind] : null;
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
