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
  core_weight_catalog_id?: number | null;
  /** Freie Kategorie in Bambuddy; „Refill“ = Filament auf Mehrwegspule */
  category?: string | null;
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
    'material' | 'subtype' | 'color_name' | 'rgba' | 'brand' | 'label_weight' | 'core_weight' | 'weight_used' | 'note' | 'storage_location' | 'location_id' | 'category' | 'core_weight_catalog_id'
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

/** Recht, das die App braucht (Bambuddy `backend/app/core/permissions.py`). */
export type Permission = 'inventory:read' | 'inventory:update' | 'inventory:view_assignments' | 'printers:read' | (string & {});

export interface Me {
  username: string;
  permissions: Permission[];
}

export interface LocationCreate {
  name: string;
  identifier?: string | null;
}

/** POST /inventory/spools – nur `material` ist Pflicht. */
export type SpoolCreate = { material: string } & Partial<
  Pick<Spool, 'subtype' | 'color_name' | 'rgba' | 'brand' | 'label_weight' | 'core_weight' | 'location_id' | 'note' | 'material_number' | 'category'>
> & { core_weight_catalog_id?: number | null };

/** Filament aus der Datenbank SpoolmanDB (über /catalog unseres Servers) */
export interface FilamentEntry {
  id: string;
  manufacturer: string;
  name: string;
  material: string;
  /** RRGGBB ohne # */
  color_hex: string | null;
  /** Nettogewicht g */
  weight: number | null;
  /** Leerspule g */
  spool_weight: number | null;
  spool_type: 'plastic' | 'cardboard' | 'metal' | null;
  finish: string | null;
  translucent: boolean;
}

/** Treffer für einen Packungs-Barcode (Open Filament Database über /catalog/gtin) */
export interface GtinHit {
  gtin: string;
  brand: string;
  material: string;
  /** z. B. „PLA Basic“ */
  filament: string;
  /** Farbname */
  color: string;
  /** RRGGBB */
  color_hex: string | null;
  weight: number | null;
  spool_weight: number | null;
  refill: boolean;
  /** Herstellernummer, bei Bambu z. B. 10102 → Bambuddy material_number */
  article_number: string | null;
  /** Variante nicht geladen (Farbe/Refill evtl. unvollständig) */
  partial?: boolean;
}

/** Typisches Leerspulen-Gewicht eines Herstellers laut Filament-Datenbank (/catalog/spools) */
export interface DbSpoolWeight {
  manufacturer: string;
  spool_type: 'plastic' | 'cardboard' | 'metal' | null;
  weight: number;
  /** Anzahl Filamente mit diesem Wert */
  count: number;
}

/** GET /inventory/catalog – Leerspulen-Gewichte */
export interface CatalogEntry {
  id: number;
  name: string;
  weight: number;
  is_default: boolean;
}

/** GET /inventory/colors(/search) */
export interface ColorEntry {
  id: number;
  manufacturer: string;
  color_name: string;
  /** #RRGGBB */
  hex_color: string;
  material: string | null;
}

export interface Printer {
  id: number;
  name: string;
  model: string | null;
  is_active: boolean;
}

/** Bambuddy schemas/printer.py AMSTray; state 9 = leer, 10 = eingelegt, 11 = geladen */
export interface AmsTray {
  id: number;
  /** RRGGBBAA */
  tray_color: string | null;
  tray_type: string | null;
  tray_sub_brands: string | null;
  remain: number | null;
  state: number | null;
  /** RFID der Bambu-Spule (leer/Nullen = kein Chip) */
  tag_uid?: string | null;
  tray_uuid?: string | null;
}

export interface AmsUnit {
  id: number;
  is_ams_ht: boolean;
  tray: AmsTray[];
}

export interface PrinterStatus {
  id: number;
  name: string;
  connected: boolean;
  ams: AmsUnit[];
  /** Externe Halterungen: id 254 (links) / 255 (rechts) → Zuweisung ams_id 255, tray_id = id − 254 */
  vt_tray: AmsTray[];
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
