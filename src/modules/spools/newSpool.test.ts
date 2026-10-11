import { describe, expect, it } from 'vitest';
import type { FilamentEntry, Spool } from '@/core/api';
import { applyFilament, draftFromSpool, draftToCreate, draftToUpdate, emptyDraft, parseHex } from './newSpool';

const spool = {
  id: 4, material: 'PETG', subtype: 'HF', brand: 'Sunlu', color_name: 'Grau', rgba: '8A8D91FF', label_weight: 1000, core_weight: 180, weight_used: 400, location_id: 2, category: null,
} as Spool;

const filament: FilamentEntry = {
  id: 'x', manufacturer: 'Bambu Lab', name: 'Bambu Green', material: 'PLA', color_hex: '00AE42', weight: 1000, spool_weight: 250, spool_type: 'cardboard', finish: null, translucent: false,
};

describe('Spule anlegen/bearbeiten', () => {
  it('leere Texte werden null, Material groß', () => {
    expect(draftToCreate({ ...emptyDraft(), material: ' pla ', subtype: ' ' })).toMatchObject({ material: 'PLA', subtype: null, brand: null, color_name: null, label_weight: 1000 });
  });
  it('Duplizieren übernimmt Eigenschaften, aber keinen Verbrauch', () => {
    const body = draftToCreate(draftFromSpool(spool));
    expect(body).toMatchObject({ material: 'PETG', subtype: 'HF', brand: 'Sunlu', color_name: 'Grau', rgba: '8A8D91FF', core_weight: 180, location_id: 2 });
    expect(body).not.toHaveProperty('weight_used');
    expect(body).not.toHaveProperty('category');
  });
  it('Hex-Eingabe in allen üblichen Schreibweisen', () => {
    expect(parseHex('#00ae42')).toBe('00AE42FF');
    expect(parseHex('0a4')).toBe('00AA44FF');
    expect(parseHex('00AE4280')).toBe('00AE4280');
    expect(parseHex('grün')).toBeNull();
  });
  it('Filament aus der Datenbank füllt Farbe, Gewicht, Leerspule und Spulenart', () => {
    expect(applyFilament(emptyDraft(), filament)).toMatchObject({ brand: 'Bambu Lab', material: 'PLA', colorName: 'Bambu Green', rgba: '00AE42FF', labelWeight: 1000, coreWeight: 250, kind: 'cardboard' });
  });
  it('Refill behält die Mehrwegspule und setzt die Kategorie', () => {
    const d = applyFilament({ ...emptyDraft(), kind: 'refill', coreWeight: 95 }, filament);
    expect(d).toMatchObject({ kind: 'refill', coreWeight: 95 });
    expect(draftToCreate(d)).toMatchObject({ category: 'Refill', core_weight: 95 });
  });
  it('Bearbeiten schickt nur Änderungen; Refill an/aus ändert die Kategorie', () => {
    const d = { ...draftFromSpool(spool), rgba: '00AE42FF' };
    expect(draftToUpdate(d, spool)).toEqual({ rgba: '00AE42FF' });
    expect(draftToUpdate({ ...d, kind: 'refill' }, spool)).toMatchObject({ category: 'Refill' });
    expect(draftToUpdate({ ...draftFromSpool({ ...spool, category: 'Refill' }), kind: 'plastic' }, { ...spool, category: 'Refill' })).toEqual({ category: null });
  });
});

describe('Packungs-Barcode', async () => {
  const { applyGtin } = await import('./newSpool');
  const base = { gtin: '06975337031390', brand: 'Bambu Lab', material: 'PLA', filament: 'PLA Basic', color: 'Silver', color_hex: 'A6A9AA', weight: 1000, spool_weight: null };
  it('füllt Hersteller, Sorte, Farbe, Gewicht; Spule vor Refill; Artikelnummer aus Refill-Eintrag', () => {
    const d = applyGtin(emptyDraft(), [
      { ...base, refill: true, article_number: '10102' },
      { ...base, refill: false, article_number: null },
    ]);
    expect(d).toMatchObject({ brand: 'Bambu Lab', material: 'PLA', subtype: 'Basic', colorName: 'Silver', rgba: 'A6A9AAFF', labelWeight: 1000, kind: 'plastic', materialNumber: '10102' });
    expect(draftToCreate(d)).toMatchObject({ material_number: '10102' });
  });
  it('nur Refill → Spulenart Refill; Leerspule aus der Datenbank', () => {
    expect(applyGtin(emptyDraft(), [{ ...base, refill: true, article_number: null }]).kind).toBe('refill');
    expect(applyGtin(emptyDraft(), [{ ...base, spool_weight: 244, refill: false, article_number: null }]).coreWeight).toBe(244);
  });
  it('kein Treffer → unverändert', () => {
    expect(applyGtin(emptyDraft(), [])).toEqual(emptyDraft());
  });
});
