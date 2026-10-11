import { describe, expect, it } from 'vitest';
import { daysSince, dryingAdvice, todayIso } from './drying';

describe('Trocknungsempfehlung', () => {
  it('findet Material, Zusatz und Aliasse wie Bambuddy', () => {
    expect(dryingAdvice('PETG')).toMatchObject({ key: 'PETG', temp: [60, 65], hours: [4, 8], ams: { temp: 65, hours: 12 } });
    expect(dryingAdvice('PETG-CF')?.key).toBe('PETG');
    expect(dryingAdvice('pla matte')?.key).toBe('PLA');
    expect(dryingAdvice('PA6-CF')?.key).toBe('PA');
  });
  it('unbekannt → keine Empfehlung statt raten', () => {
    expect(dryingAdvice('PEEK')).toBeNull();
    expect(dryingAdvice(null)).toBeNull();
  });
  it('warnt, wenn der Dörrautomat zu kalt sein könnte', () => {
    expect(dryingAdvice('ABS')?.tooHotForDehydrator).toBe(true);
    expect(dryingAdvice('PLA')?.tooHotForDehydrator).toBe(false);
  });
});

describe('Datum', () => {
  const now = new Date(2026, 9, 11, 22, 0);
  it('zählt Kalendertage', () => {
    expect(daysSince('2026-10-11', now)).toBe(0);
    expect(daysSince('2026-10-10', now)).toBe(1);
    expect(daysSince('2026-10-01', now)).toBe(10);
  });
  it('heute als JJJJ-MM-TT', () => {
    expect(todayIso(now)).toBe('2026-10-11');
  });
});
