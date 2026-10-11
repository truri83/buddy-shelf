/**
 * Handgeschriebene Teilmenge der Bambuddy-Typen für Phase 1.
 * Ziel: durch generierte Typen ersetzen (`npm run api:types` → bambuddy.gen.ts).
 * Feldnamen exakt wie in Bambuddy (backend/app/schemas/spool.py, location.py).
 */

export interface Spool {
  id: number;
  material: string;
  subtype: string | null;
  color_name: string | null;
  /** RRGGBBAA */
  rgba: string | null;
  brand: string | null;
  label_weight: number;
  core_weight: number;
  weight_used: number;
  note: string | null;
  tag_uid: string | null;
  tray_uuid: string | null;
  storage_location: string | null;
  location_id: number | null;
  material_number: string | null;
  low_stock_threshold_pct: number | null;
  last_scale_weight: number | null;
  last_weighed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SpoolUpdate = Partial<
  Pick<
    Spool,
    'material' | 'subtype' | 'color_name' | 'rgba' | 'brand' | 'label_weight' | 'core_weight' | 'weight_used' | 'note' | 'storage_location' | 'location_id'
  >
>;

export interface Location {
  id: number;
  name: string;
  identifier: string | null;
  spool_count: number;
}

export interface SpoolAssignment {
  id: number;
  spool_id: number;
  printer_id: number;
  printer_name: string | null;
  ams_id: number;
  tray_id: number;
  ams_label: string | null;
  configured: boolean;
  pending_config: boolean;
}

export interface SpoolAssignmentCreate {
  spool_id: number;
  printer_id: number;
  ams_id: number;
  tray_id: number;
}

/** Restgewicht in Gramm, nie negativ. */
export function remainingGrams(s: Pick<Spool, 'label_weight' | 'weight_used'>): number {
  return Math.max(0, Math.round(s.label_weight - s.weight_used));
}

/** Füllstand 0–1. */
export function fillRatio(s: Pick<Spool, 'label_weight' | 'weight_used'>): number {
  if (s.label_weight <= 0) return 0;
  return Math.min(1, remainingGrams(s) / s.label_weight);
}

/** Bruttogewicht von der Waage → verbrauchte Menge für Bambuddy. */
export function weightUsedFromScale(grossGrams: number, s: Pick<Spool, 'label_weight' | 'core_weight'>): number {
  const net = Math.max(0, grossGrams - s.core_weight);
  return Math.max(0, s.label_weight - net);
}
