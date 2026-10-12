import type { FilamentEntry, GtinHit, Spool, SpoolCreate, SpoolUpdate } from '@/core/api';

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
  /** Herstellernummer (Bambu z. B. 10102) → Bambuddy material_number */
  materialNumber: string;
  /** null = voll; sonst Rest in g (nur beim Anlegen) */
  remaining: number | null;
  /** Preis je Spule in €, als Text (Komma erlaubt) */
  price: string;
  note: string;
  /** sealed | drybox | open | '' */
  storageType: string;
  /** JJJJ-MM-TT oder null */
  driedAt: string | null;
}

/** Lagerungsarten (Spooly „Feuchtigkeitstracking“) – Grundlage der Trocknungs-Erinnerung. */
export const STORAGE_TYPES = ['sealed', 'bag', 'drybox', 'open'] as const;
export type StorageType = (typeof STORAGE_TYPES)[number];

/** Grundfarben fürs schnelle Antippen (Name deutsch, Hex ohne #). */
export const BASE_COLORS = [
  ['Schwarz', '000000'],
  ['Weiß', 'FFFFFF'],
  ['Grau', '8A8D91'],
  ['Silber', 'C0C0C0'],
  ['Rot', 'D9363E'],
  ['Orange', 'F07A1A'],
  ['Gelb', 'F2C94C'],
  ['Grün', '3CB371'],
  ['Dunkelgrün', '2E6B3A'],
  ['Blau', '3B82F6'],
  ['Hellblau', '5DADE2'],
  ['Dunkelblau', '1F3A8A'],
  ['Lila', '8B5CF6'],
  ['Pink', 'E055A0'],
  ['Braun', '8B4513'],
  ['Beige', 'D8C8A8'],
  ['Gold', 'D4AF37'],
  ['Türkis', '40B5AD'],
] as const;

/** Preis je Spule → € je kg (Bambuddy speichert cost_per_kg). */
export function pricePerKg(price: string, labelWeight: number): number | null {
  const p = Number(price.replace(',', '.').trim());
  if (!price.trim() || !Number.isFinite(p) || p < 0 || labelWeight <= 0) return null;
  return Math.round((p / (labelWeight / 1000)) * 100) / 100;
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
    materialNumber: '',
    remaining: null,
    price: '',
    note: '',
    storageType: '',
    driedAt: null,
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
    materialNumber: s.material_number ?? '',
    remaining: null,
    price: s.cost_per_kg != null ? String(Math.round(s.cost_per_kg * (s.label_weight / 1000) * 100) / 100).replace('.', ',') : '',
    note: s.note ?? '',
    storageType: s.storage_type ?? '',
    driedAt: s.dried_at ?? null,
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

/**
 * Packungs-Barcode übernehmen. Teilen sich Spule und Refill einen Barcode, gilt die Spule;
 * die Spulenart lässt sich danach umschalten. Die Artikelnummer stammt aus irgendeinem Treffer.
 */
export function applyGtin(d: SpoolDraft, hits: GtinHit[]): SpoolDraft {
  const hit = hits.find((h) => !h.refill) ?? hits[0];
  if (!hit) return d;
  const material = hit.material.toUpperCase();
  // Material als ganzes Wort entfernen, egal wo („Silk PLA“, „PLA Basic“, „Fiber HT Matte PLA“)
  const escaped = material.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const subtype = hit.filament
    .replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'gi'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    ...d,
    brand: hit.brand,
    material,
    subtype,
    colorName: hit.color,
    rgba: hit.color_hex ? `${hit.color_hex}FF` : d.rgba,
    labelWeight: hit.weight ?? d.labelWeight,
    coreWeight: hit.spool_weight ?? d.coreWeight,
    coreCatalogId: hit.spool_weight != null ? null : d.coreCatalogId,
    kind: hit.refill ? 'refill' : d.kind,
    materialNumber: hits.find((h) => h.article_number)?.article_number ?? d.materialNumber,
  };
}

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
    material_number: text(d.materialNumber),
    note: text(d.note),
    cost_per_kg: pricePerKg(d.price, d.labelWeight),
    // Angefangene Spule: Rest → Verbrauch
    ...(d.remaining != null ? { weight_used: Math.max(0, Math.min(d.labelWeight, d.labelWeight - d.remaining)) } : {}),
    ...(d.kind === 'refill' ? { category: REFILL_CATEGORY } : {}),
  };
}

/** Bearbeiten: nur geänderte Felder; Refill-Kategorie setzen bzw. wieder entfernen, sonst Kategorie nicht anfassen. */
export function draftToUpdate(d: SpoolDraft, original: Spool): SpoolUpdate {
  const full = draftToCreate(d);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(full)) {
    if (k === 'category') continue;
    if (
      (original as unknown as Record<string, unknown>)[k] !== v &&
      !(v == null && (original as unknown as Record<string, unknown>)[k] == null)
    )
      out[k] = v;
  }
  const wasRefill = original.category === REFILL_CATEGORY;
  if (d.kind === 'refill' && !wasRefill) out.category = REFILL_CATEGORY;
  if (d.kind !== 'refill' && wasRefill) out.category = null;
  return out as SpoolUpdate;
}

/** Zusatzdaten aus dem Formular, die nicht über Bambuddy laufen (getrocknet, Lagerungsart) – nur Änderungen. */
export function draftExtras(d: SpoolDraft, original?: Pick<Spool, 'dried_at' | 'storage_type'>) {
  const patch: { dried_at?: string | null; storage_type?: string | null } = {};
  if ((d.driedAt ?? null) !== (original?.dried_at ?? null)) patch.dried_at = d.driedAt;
  if ((d.storageType || null) !== (original?.storage_type ?? null)) patch.storage_type = d.storageType || null;
  return patch;
}
