import { describe, expect, it } from 'vitest';
import type { Spool } from '@/core/api';
import { groupSpools, isLow, matchesSearch, sortSpools } from './logic';

const base: Spool = {
  id: 1, material: 'PLA', subtype: 'Basic', color_name: 'Black', rgba: '000000FF', brand: 'Bambu Lab',
  label_weight: 1000, core_weight: 250, weight_used: 0, note: null, tag_uid: null, tray_uuid: null,
  storage_location: null, location_id: null, material_number: '10101', low_stock_threshold_pct: null,
  last_scale_weight: null, last_weighed_at: null, archived_at: null, created_at: '', updated_at: '',
};

describe('Spulen-Logik', () => {
  it('sortiert nach Nummer oder wenigstem Rest', () => {
    const a = { ...base, id: 3, weight_used: 100 };
    const b = { ...base, id: 1, weight_used: 900 };
    const c = { ...base, id: 2, weight_used: 900 };
    expect(sortSpools([a, b, c], 'id').map((s) => s.id)).toEqual([1, 2, 3]);
    // b und c haben am wenigsten Rest (gleich viel → nach Nummer), a am meisten
    expect(sortSpools([a, b, c], 'remaining').map((s) => s.id)).toEqual([1, 2, 3]);
  });

  it('niedrig unter 20 %', () => {
    expect(isLow({ ...base, weight_used: 875 })).toBe(true);
    expect(isLow({ ...base, weight_used: 500 })).toBe(false);
    expect(isLow({ ...base, weight_used: 500, low_stock_threshold_pct: 60 })).toBe(true);
  });

  it('gruppiert nach Material, ohne archivierte', () => {
    const groups = groupSpools(
      [base, { ...base, id: 2, material: 'PETG' }, { ...base, id: 3, archived_at: '2026-01-01' }],
      'material', [], 'Ohne',
    );
    expect(groups.map((g) => [g.title, g.spools.length])).toEqual([['PETG', 1], ['PLA', 1]]);
  });

  it('sucht in mehreren Feldern', () => {
    expect(matchesSearch(base, 'pla black')).toBe(true);
    expect(matchesSearch(base, '#1')).toBe(true);
    expect(matchesSearch(base, 'petg')).toBe(false);
  });
});
