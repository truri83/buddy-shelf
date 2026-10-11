import type { FilamentEntry, Spool, SpoolCreate, SpoolUpdate } from '@/core/api';

export const COMMON_MATERIALS = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'PA', 'PC'] as const;
export const NET_WEIGHTS = [250, 500, 750, 1000, 2000, 3000] as const;
export const REFILL_CATEGORY = 'Refill';

/** Kunststoff-/Pappspule oder Refill (Filament auf eigener Mehrwegspule). */
export type SpoolKind = 'plastic' | 'cardboard' | 'refill';

/** Formularstand für SP-07 (Zahlen schon als Zahlen). */
export interface SpoolDraft {
  material: string;
  subtype: string;
  brand: string;
  colorName: string;
  /** RRGGBBAA */
  rgba: string | null;
  labelWeight: number;
  coreWeight: number;
  coreCatalogId: number | null;
  kind: SpoolKind;
  locationId: number | null;
  quantity: number;
}

export function emptyDraft(): SpoolDraft {
  return {
    material: 'PLA',
    subtype: '',
    brand: '',
    colorName: '',
    rgba: null,
    labelWeight: 1000,
    coreWeight: 250,
    coreCatalogId: null,
    kind: 'plastic',
    locationId: null,
    quantity: 1,
  };
}

/** Duplizieren/Bearbeiten: alles außer Verbrauch, Etikett-Codes und Zuweisungen übernehmen. */
export function draftFromSpool(s: Spool): SpoolDraft {
  return {
    material: s.material,
    subtype: s.subtype ?? '',
    brand: s.brand ?? '',
    colorName: s.color_name ?? '',
    rgba: s.rgba,
    labelWeight: s.label_weight,
    coreWeight: s.core_weight,
    coreCatalogId: s.core_weight_catalog_id ?? null,
    kind: s.category === REFILL_CATEGORY ? 'refill' : 'plastic',
    locationId: s.location_id,
    quantity: 1,
  };
}

/** Hex-Eingabe „#00ae42“, „00AE42“ oder „0a4“ → RRGGBBAA, sonst null. */
export function parseHex(input: string): string | null {
  let v = input.trim().replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{3}$/.test(v)) v = v.replace(/./g, (c) => c + c);
  if (/^[0-9A-F]{6}$/.test(v)) return `${v}FF`;
  if (/^[0-9A-F]{8}$/.test(v)) return v;
  return null;
}

export const rgbaToHex = (rgba: string | null) => (rgba ? `#${rgba.slice(0, 6)}` : '');

/** Eintrag aus der Filament-Datenbank übernehmen. */
export function applyFilament(d: SpoolDraft, f: FilamentEntry): SpoolDraft {
  return {
    ...d,
    brand: f.manufacturer,
    material: f.material.toUpperCase(),
    colorName: f.name,
    rgba: f.color_hex ? `${f.color_hex}FF` : d.rgba,
    labelWeight: f.weight ?? d.labelWeight,
    // Refill behält die eigene Mehrwegspule
    coreWeight: d.kind === 'refill' ? d.coreWeight : (f.spool_weight ?? d.coreWeight),
    coreCatalogId: d.kind === 'refill' ? d.coreCatalogId : f.spool_weight != null ? null : d.coreCatalogId,
    kind: d.kind === 'refill' ? 'refill' : f.spool_type === 'cardboard' ? 'cardboard' : 'plastic',
  };
}

const text = (v: string) => (v.trim() ? v.trim() : null);

/** Formular → POST-Body (leere Texte als null, Bambuddy-Feldnamen). */
export function draftToCreate(d: SpoolDraft): SpoolCreate {
  return {
    material: d.material.trim().toUpperCase(),
    subtype: text(d.subtype),
    brand: text(d.brand),
    color_name: text(d.colorName),
    rgba: d.rgba,
    label_weight: d.labelWeight,
    core_weight: d.coreWeight,
    core_weight_catalog_id: d.coreCatalogId,
    location_id: d.locationId,
    ...(d.kind === 'refill' ? { category: REFILL_CATEGORY } : {}),
  };
}

/** Bearbeiten: nur geänderte Felder; Refill-Kategorie setzen bzw. wieder entfernen, sonst Kategorie nicht anfassen. */
export function draftToUpdate(d: SpoolDraft, original: Spool): SpoolUpdate {
  const full = draftToCreate(d);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(full)) {
    if (k === 'category') continue;
    if ((original as unknown as Record<string, unknown>)[k] !== v && !(v == null && (original as unknown as Record<string, unknown>)[k] == null)) out[k] = v;
  }
  const wasRefill = original.category === REFILL_CATEGORY;
  if (d.kind === 'refill' && !wasRefill) out.category = REFILL_CATEGORY;
  if (d.kind !== 'refill' && wasRefill) out.category = null;
  return out as SpoolUpdate;
}
