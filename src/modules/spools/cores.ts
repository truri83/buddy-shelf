import type { CatalogEntry, DbSpoolWeight, Spool } from '@/core/api';

/** Bezeichnung im Stil des Bambuddy-Katalogs („Bambu Lab - Plastic“). */
export function coreName(manufacturer: string, type: DbSpoolWeight['spool_type']): string {
  const kind = type === 'cardboard' ? 'Cardboard' : type === 'metal' ? 'Metal' : 'Plastic';
  return `${manufacturer} - ${kind}`;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Hersteller-Teil eines Katalognamens („Bambu Lab - Plastic High Temp“ → „Bambu Lab“). */
export const coreManufacturer = (name: string) => name.split(' - ')[0]!.trim();

/**
 * Vorschläge aus der Filament-Datenbank: Hersteller + Spulenart, die im Katalog noch fehlen.
 * Pro Hersteller und Art nur der häufigste Wert; Ausreißer mit sehr wenigen Filamenten weglassen.
 */
export function coreSuggestions(
  db: DbSpoolWeight[],
  catalog: CatalogEntry[],
  minCount = 5,
): { name: string; weight: number; count: number }[] {
  const have = new Set(catalog.map((c) => norm(c.name)));
  const haveMaker = new Set(catalog.map((c) => norm(coreManufacturer(c.name))));
  return (
    db
      .filter((d) => d.count >= minCount && d.weight > 0 && d.weight < 600)
      .map((d) => ({
        name: coreName(d.manufacturer, d.spool_type),
        weight: d.weight,
        count: d.count,
        maker: norm(d.manufacturer),
        typed: d.spool_type != null,
      }))
      // Ohne Spulenart nur vorschlagen, wenn der Hersteller noch gar nicht im Katalog ist
      .filter((d) => !have.has(norm(d.name)) && (d.typed || !haveMaker.has(d.maker)))
      .map(({ name, weight, count }) => ({ name, weight, count }))
  );
}

/** Katalog nach Hersteller gruppiert, mit Nutzung durch Spulen. */
export function groupCores(catalog: CatalogEntry[], spools: Spool[]) {
  const used = new Map<number, number>();
  for (const s of spools)
    if (s.core_weight_catalog_id != null && !s.archived_at)
      used.set(s.core_weight_catalog_id, (used.get(s.core_weight_catalog_id) ?? 0) + 1);
  const groups = new Map<string, (CatalogEntry & { used: number })[]>();
  for (const c of [...catalog].sort((a, b) => a.name.localeCompare(b.name, 'de'))) {
    const key = coreManufacturer(c.name);
    groups.set(key, [...(groups.get(key) ?? []), { ...c, used: used.get(c.id) ?? 0 }]);
  }
  return [...groups.entries()].map(([maker, entries]) => ({ maker, entries }));
}

/** Netto-Eingabe (nur Filament) → Brutto für den Waagen-Endpunkt; eine Rechenregel für beide Wege. */
export const netToGross = (net: number, coreWeight: number) => net + coreWeight;

/**
 * Leerspule einer Spule im Katalog finden. Mit Spoolman liefert Bambuddy keine Katalog-Nummer –
 * dann über das Gewicht: zuerst Einträge desselben Herstellers, sonst nur, wenn das Gewicht eindeutig ist.
 */
export function matchCore(
  spool: Pick<Spool, 'core_weight' | 'core_weight_catalog_id' | 'brand'>,
  catalog: CatalogEntry[],
): CatalogEntry | undefined {
  if (spool.core_weight_catalog_id != null) return catalog.find((c) => c.id === spool.core_weight_catalog_id);
  const same = catalog.filter((c) => Math.round(c.weight) === Math.round(spool.core_weight));
  const brand = spool.brand ? norm(spool.brand) : '';
  const ofBrand = brand ? same.filter((c) => norm(coreManufacturer(c.name)) === brand) : [];
  if (ofBrand.length === 1) return ofBrand[0];
  return same.length === 1 ? same[0] : undefined;
}
