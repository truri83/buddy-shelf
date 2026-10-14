import { describe, expect, it } from 'vitest';
import { DEFAULT_DRYING } from './drying';
import { moistureState } from './moisture';

const now = new Date('2026-10-14T12:00:00');
// PLA: Erinnerung 30 Tage; Trockenbox Faktor 4 → 120 Tage; offen Faktor 1 → 30 Tage
const pla = (o: object) => ({ material: 'PLA', created_at: '2026-01-01T00:00:00', ...o });

describe('Feuchtigkeits-Ampel', () => {
  it('grün, gelb, rot nach Rest des Intervalls', () => {
    expect(moistureState(pla({ storage_type: 'open', dried_at: '2026-10-10' }), DEFAULT_DRYING, now).level).toBe('dry');
    expect(moistureState(pla({ storage_type: 'open', dried_at: '2026-09-21' }), DEFAULT_DRYING, now).level).toBe('soon');
    expect(moistureState(pla({ storage_type: 'open', dried_at: '2026-09-01' }), DEFAULT_DRYING, now).level).toBe('due');
  });
  it('grau ohne Aussage: OVP, ohne Lagerungsart', () => {
    expect(moistureState(pla({ storage_type: 'sealed' }), DEFAULT_DRYING, now).level).toBe('none');
    expect(moistureState(pla({ storage_type: null }), DEFAULT_DRYING, now).level).toBe('none');
  });
  it('Erklärung nennt zuletzt getrocknet, Lagerung und nächste Trocknung', () => {
    const s = moistureState(pla({ storage_type: 'drybox', dried_at: '2026-10-02' }), DEFAULT_DRYING, now);
    expect(s.detail).toMatch(/12 Tagen/);
    expect(s.detail).toMatch(/Trockenbox/);
    expect(s.detail).toMatch(/108 Tagen/);
  });
});
