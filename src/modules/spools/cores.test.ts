import { describe, expect, it } from 'vitest';
import { weightUsedFromScale, type Spool } from '@/core/api';
import { coreName, coreSuggestions, groupCores, netToGross } from './cores';

const catalog = [
  { id: 24, name: 'Bambu Lab - Plastic', weight: 237, is_default: true },
  { id: 30, name: 'Sunlu - Plastic', weight: 180, is_default: true },
];

describe('Leerspulen', () => {
  it('Bezeichnung im Bambuddy-Stil', () => {
    expect(coreName('Polymaker', 'cardboard')).toBe('Polymaker - Cardboard');
    expect(coreName('Sunlu', null)).toBe('Sunlu - Plastic');
  });
  it('schlägt nur Fehlendes vor, ohne Ausreißer', () => {
    const db = [
      { manufacturer: 'Bambu Lab', spool_type: null, weight: 250, count: 287 },
      { manufacturer: 'Polymaker', spool_type: 'cardboard' as const, weight: 140, count: 228 },
      { manufacturer: 'Polymaker', spool_type: 'plastic' as const, weight: 819, count: 150 },
      { manufacturer: 'Sunlu', spool_type: 'plastic' as const, weight: 130, count: 71 },
      { manufacturer: 'Kleinfirma', spool_type: 'plastic' as const, weight: 200, count: 2 },
    ];
    expect(coreSuggestions(db, catalog)).toEqual([{ name: 'Polymaker - Cardboard', weight: 140, count: 228 }]);
  });
  it('gruppiert nach Hersteller und zählt Nutzung', () => {
    const spools = [{ core_weight_catalog_id: 24, archived_at: null }, { core_weight_catalog_id: 24, archived_at: 'x' }] as Spool[];
    const g = groupCores(catalog, spools);
    expect(g.map((x) => x.maker)).toEqual(['Bambu Lab', 'Sunlu']);
    expect(g[0]!.entries[0]!.used).toBe(1);
  });
  it('Netto und Brutto ergeben denselben Rest', () => {
    const s = { label_weight: 1000, core_weight: 160 };
    expect(1000 - weightUsedFromScale(netToGross(400, s.core_weight), s)).toBe(400);
  });
});
