import { describe, expect, it } from 'vitest';
import type { Spool } from '@/core/api';
import { groupSpools, isLow, matchesSearch } from './logic';

const base: Spool = {
  id: 1, material: 'PLA', subtype: 'Basic', color_name: 'Black', rgba: '000000FF', brand: 'Bambu Lab',
  label_weight: 1000, core_weight: 250, weight_used: 0, note: null, tag_uid: null, tray_uuid: null,
  storage_location: null, location_id: null, material_number: '10101', low_stock_threshold_pct: null,
  last_scale_weight: null, last_weighed_at: null, archived_at: null, created_at: '', updated_at: '',
};

describe('Spulen-Logik', () => {
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
