import { describe, expect, it } from 'vitest';

import { DEFAULT_DRYING, daysSince, dryingAdvice, dryingDue, mergeDrying, todayIso } from './drying';

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
    const max70 = { ...DEFAULT_DRYING, dehydratorMax: 70 };
    expect(dryingAdvice('ABS', max70)?.tooHotForDehydrator).toBe(true);
    expect(dryingAdvice('PLA', max70)?.tooHotForDehydrator).toBe(false);
    expect(dryingAdvice('ABS')?.tooHotForDehydrator).toBe(false);
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
    expect(dryingDue({ ...spool, storage_type: 'open', dried_at: '2026-10-01' }, DEFAULT_DRYING, now)).toEqual({
      intervalDays: 21,
      dueInDays: 10,
      due: false,
    });
    expect(dryingDue({ ...spool, storage_type: 'open', dried_at: '2026-09-01' }, DEFAULT_DRYING, now)?.due).toBe(true);
  });
  it('Trockenbox verlängert, ohne Datum zählt die Anlage', () => {
    expect(dryingDue({ ...spool, storage_type: 'drybox' }, DEFAULT_DRYING, now)).toMatchObject({ intervalDays: 84, due: false });
  });
  it('OVP, ohne Lagerungsart oder unbekanntes Material: keine Erinnerung', () => {
    expect(dryingDue({ ...spool, storage_type: 'sealed' }, DEFAULT_DRYING, now)).toBeNull();
    expect(dryingDue(spool, DEFAULT_DRYING, now)).toBeNull();
    expect(dryingDue({ ...spool, material: 'PEEK', storage_type: 'open' }, DEFAULT_DRYING, now)).toBeNull();
  });
});

describe('Familie und eigene Werte', () => {
  const now = new Date(2026, 9, 12, 9, 0);
  it('PLA+ und PLA 2.0+ trocknen wie PLA', () => {
    expect(dryingAdvice('PLA+')?.key).toBe('PLA');
    expect(dryingAdvice('PLA 2.0+')?.temp).toEqual(DEFAULT_DRYING.materials.PLA!.temp);
  });
  it('eigene Werte überschreiben den Standard, Rest bleibt', () => {
    const cfg = mergeDrying({
      materials: { PETG: { temp: [65, 70], hours: [6, 8], ams: null, reminderDays: 14 } },
      storageFactor: { drybox: 2 } as never,
    });
    expect(dryingAdvice('PETG', cfg)?.temp).toEqual([65, 70]);
    expect(dryingAdvice('PLA', cfg)?.temp).toEqual(DEFAULT_DRYING.materials.PLA!.temp);
    expect(
      dryingDue({ material: 'PETG', storage_type: 'drybox', dried_at: '2026-10-01', created_at: '2026-01-01' }, cfg, now),
    ).toMatchObject({ intervalDays: 28 });
    expect(cfg.storageFactor.bag).toBe(DEFAULT_DRYING.storageFactor.bag);
  });
});
