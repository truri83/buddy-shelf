import { fillRatio, slotLabel, type Location, type Spool, type SpoolAssignment } from '@/core/api';
import { colorFamily, colorSearchText } from '@/core/i18n';

export const DEFAULT_LOW_PCT = 20;

const capitalize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

export function isLow(s: Spool): boolean {
  return fillRatio(s) * 100 < (s.low_stock_threshold_pct ?? DEFAULT_LOW_PCT);
}

export type GroupBy = 'none' | 'material' | 'color' | 'location' | 'brand';

export interface SpoolGroup {
  key: string;
  title: string;
  spools: Spool[];
}

export function locationName(s: Spool, locations: Location[]): string | null {
  if (s.location_id != null) return locations.find((l) => l.id === s.location_id)?.name ?? null;
  return s.storage_location || null;
}

/** Kurze Slot-Bezeichnung für Badges („AMS 2 · 2“, „Extern L“). */
export function amsLabel(a: SpoolAssignment): string {
  return a.ams_label ?? slotLabel(a.ams_id, a.tray_id);
}


export function groupSpools(spools: Spool[], by: GroupBy, locations: Location[], noLocationTitle: string): SpoolGroup[] {
  const active = spools.filter((s) => !s.archived_at);
  if (by === 'none') return [{ key: 'all', title: '', spools: active }];
  const map = new Map<string, Spool[]>();
  for (const s of active) {
    const key =
      by === 'material'
        ? s.material.toUpperCase()
        : by === 'brand'
          ? (s.brand ?? '–')
          : by === 'color'
            ? capitalize(colorFamily(s.rgba) ?? '–')
            : (locationName(s, locations) ?? noLocationTitle);
    map.set(key, [...(map.get(key) ?? []), s]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'de')).map(([key, list]) => ({ key, title: key, spools: list }));
}

/** Lagerorte für die Auswahl: zuletzt genutzter zuerst, sonst wie von Bambuddy sortiert. */
export function orderLocations(locations: Location[], lastId: number | null): Location[] {
  const last = locations.find((l) => l.id === lastId);
  return last ? [last, ...locations.filter((l) => l !== last)] : locations;
}

export type SortBy = 'id' | 'remaining';

/** Sortierung innerhalb der Gruppen: nach Nummer oder wenigster Rest zuerst (wie Spooly). */
export function sortSpools(list: Spool[], by: SortBy): Spool[] {
  const rest = (s: Spool) => s.label_weight - s.weight_used;
  return [...list].sort((a, b) => (by === 'remaining' ? rest(a) - rest(b) || a.id - b.id : a.id - b.id));
}

export function matchesSearch(s: Spool, q: string): boolean {
  if (!q) return true;
  // Farbe in beiden Sprachen + Farbfamilie aus dem Hex-Wert („schwarz“ findet „Black“)
  const hay = [s.id, s.material, s.subtype, s.brand, s.material_number, colorSearchText(s.color_name, s.rgba)].join(' ').toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w.replace(/^#/, '')));
}
