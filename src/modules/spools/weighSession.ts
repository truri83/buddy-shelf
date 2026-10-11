import type { Spool } from '@/core/api';

/** Eine Runde „Wiegen & Inventur“ (SP-09). Liegt im Gerätespeicher, damit Unterbrechungen nichts kosten. */
export interface WeighSession {
  startedAt: string;
  /** Inventur: nicht gescannte Spulen werden am Ende gezeigt */
  inventory: boolean;
  /** Ort für diese Runde (Inventur): jede gescannte Spule wird dorthin gebucht; null = Ort nicht ändern */
  locationId: number | null;
  done: WeighEntry[];
}

export interface WeighEntry {
  spoolId: number;
  /** Bruttogewicht von der Waage; null = nur gesehen (Inventur ohne Wiegen) */
  gross: number | null;
  rest: number | null;
  at: string;
}

export const SESSION_KEY = 'spools.weighSession';

export function newSession(inventory = false, locationId: number | null = null): WeighSession {
  return { startedAt: new Date().toISOString(), inventory, locationId, done: [] };
}

/** Eintrag hinzufügen; dieselbe Spule nochmal = alter Eintrag wird ersetzt (neuester oben). */
export function record(s: WeighSession, e: WeighEntry): WeighSession {
  const old = s.done.find((d) => d.spoolId === e.spoolId);
  // Wiegen überschreibt „nur gesehen“, aber „nur gesehen“ löscht kein Gewicht
  const merged = old && e.gross == null ? { ...e, gross: old.gross, rest: old.rest } : e;
  return { ...s, done: [merged, ...s.done.filter((d) => d.spoolId !== e.spoolId)] };
}

/**
 * Inventur: aktive Spulen, die in dieser Runde nicht gescannt wurden.
 * Mit Ort für die Runde: nur Spulen, die laut Bambuddy dort liegen sollten.
 */
export function missingSpools(s: WeighSession, spools: Spool[]): Spool[] {
  const seen = new Set(s.done.map((d) => d.spoolId));
  return spools.filter((x) => !x.archived_at && !seen.has(x.id) && (s.locationId == null || x.location_id === s.locationId));
}

/** Eingabe „1.234,5“ / „1234“ / „812 g“ → Gramm, sonst null. */
export function parseGrams(input: string): number | null {
  const v = input.trim().replace(/\s*g$/i, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  const n = Number(v);
  return n > 0 && n <= 100_000 ? n : null;
}
