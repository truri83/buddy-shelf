import type { Spool, SpoolCreate } from '@/core/api';

export const COMMON_MATERIALS = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'PA', 'PC'] as const;

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
  locationId: number | null;
  quantity: number;
}

export function emptyDraft(): SpoolDraft {
  return { material: 'PLA', subtype: '', brand: '', colorName: '', rgba: null, labelWeight: 1000, coreWeight: 250, coreCatalogId: null, locationId: null, quantity: 1 };
}

/** Duplizieren: alles außer Verbrauch, Etikett-Codes und Zuweisungen übernehmen. */
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
    locationId: s.location_id,
    quantity: 1,
  };
}

/** Formular → POST-Body (leere Texte als null, Bambuddy-Feldnamen). */
export function draftToCreate(d: SpoolDraft): SpoolCreate {
  const text = (v: string) => (v.trim() ? v.trim() : null);
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
  };
}
