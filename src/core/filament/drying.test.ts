import { describe, expect, it, vi } from 'vitest';

// Tests laufen in Node: Gerätespeicher leer
vi.mock('@/core/platform', () => ({ storage: { get: (_k: string, fallback: unknown) => fallback, set: () => undefined } }));
import { daysSince, dryingAdvice, dryingDue, todayIso } from './drying';

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
  it('warnt nur, wenn die eingestellte Höchsttemperatur nicht reicht', () => {
    expect(dryingAdvice('ABS', 70)?.tooHotForDehydrator).toBe(true);
    expect(dryingAdvice('PLA', 70)?.tooHotForDehydrator).toBe(false);
    expect(dryingAdvice('ABS', null)?.tooHotForDehydrator).toBe(false);
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

describe('Trocknungs-Erinnerung', () => {
  const now = new Date(2026, 9, 12, 9, 0);
  const spool = { material: 'PETG', created_at: '2026-08-01T10:00:00Z' };
  it('offen: PETG nach 21 Tagen fällig, gezählt ab zuletzt getrocknet', () => {
    expect(dryingDue({ ...spool, storage_type: 'open', dried_at: '2026-10-01' }, now)).toEqual({
      intervalDays: 21,
      dueInDays: 10,
      due: false,
    });
    expect(dryingDue({ ...spool, storage_type: 'open', dried_at: '2026-09-01' }, now)?.due).toBe(true);
  });
  it('Trockenbox verlängert, ohne Datum zählt die Anlage', () => {
    expect(dryingDue({ ...spool, storage_type: 'drybox' }, now)).toMatchObject({ intervalDays: 84, due: false });
  });
  it('OVP, ohne Lagerungsart oder unbekanntes Material: keine Erinnerung', () => {
    expect(dryingDue({ ...spool, storage_type: 'sealed' }, now)).toBeNull();
    expect(dryingDue(spool, now)).toBeNull();
    expect(dryingDue({ ...spool, material: 'PEEK', storage_type: 'open' }, now)).toBeNull();
  });
});
