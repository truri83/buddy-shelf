import { describe, expect, it } from 'vitest';
import type { Spool } from '@/core/api';
import { missingSpools, newSession, parseGrams, record } from './weighSession';

const sp = (id: number, location_id: number | null, archived = false) => ({ id, location_id, archived_at: archived ? 'x' : null }) as Spool;

describe('Wiegen & Inventur', () => {
  it('neuester Eintrag oben, gleiche Spule wird ersetzt', () => {
    let s = newSession();
    s = record(s, { spoolId: 1, gross: 900, rest: 650, at: 'a' });
    s = record(s, { spoolId: 2, gross: 500, rest: 250, at: 'b' });
    s = record(s, { spoolId: 1, gross: 880, rest: 630, at: 'c' });
    expect(s.done.map((d) => [d.spoolId, d.rest])).toEqual([
      [1, 630],
      [2, 250],
    ]);
  });
  it('„nur gesehen“ löscht kein Gewicht', () => {
    let s = record(newSession(true), { spoolId: 1, gross: 900, rest: 650, at: 'a' });
    s = record(s, { spoolId: 1, gross: null, rest: null, at: 'b' });
    expect(s.done[0]).toMatchObject({ gross: 900, rest: 650, at: 'b' });
  });
  it('Inventur: fehlende Spulen, mit Ort nur die dort erwarteten', () => {
    const spools = [sp(1, 1), sp(2, 1), sp(3, 2), sp(4, 1, true)];
    const s = record(newSession(true), { spoolId: 1, gross: null, rest: null, at: 'a' });
    expect(missingSpools(s, spools).map((x) => x.id)).toEqual([2, 3]);
    expect(missingSpools({ ...s, locationId: 1 }, spools).map((x) => x.id)).toEqual([2]);
  });
  it('Gewicht in üblichen Schreibweisen', () => {
    expect(parseGrams('812')).toBe(812);
    expect(parseGrams('812,5')).toBe(812.5);
    expect(parseGrams('1.234')).toBe(1234);
    expect(parseGrams('812 g')).toBe(812);
    expect(parseGrams('abc')).toBeNull();
    expect(parseGrams('0')).toBeNull();
  });
});
