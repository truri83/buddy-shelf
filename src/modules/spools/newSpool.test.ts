import { describe, expect, it } from 'vitest';
import type { Spool } from '@/core/api';
import { draftFromSpool, draftToCreate, emptyDraft } from './newSpool';

describe('Spule anlegen', () => {
  it('leere Texte werden null, Material groß', () => {
    expect(draftToCreate({ ...emptyDraft(), material: ' pla ', subtype: ' ' })).toMatchObject({ material: 'PLA', subtype: null, brand: null, color_name: null, label_weight: 1000 });
  });
  it('Duplizieren übernimmt Eigenschaften, aber keinen Verbrauch', () => {
    const s = { id: 4, material: 'PETG', subtype: 'HF', brand: 'Sunlu', color_name: 'Grau', rgba: '8A8D91FF', label_weight: 1000, core_weight: 180, weight_used: 400, location_id: 2 } as Spool;
    const body = draftToCreate(draftFromSpool(s));
    expect(body).toMatchObject({ material: 'PETG', subtype: 'HF', brand: 'Sunlu', color_name: 'Grau', rgba: '8A8D91FF', core_weight: 180, location_id: 2 });
    expect(body).not.toHaveProperty('weight_used');
  });
});
