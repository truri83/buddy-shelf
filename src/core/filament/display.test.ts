import { describe, expect, it } from 'vitest';
import { DEFAULT_DISPLAY, mergeDisplay, stockLevel, thresholdsFor } from './display';

const spool = (material: string, restPct: number, own: number | null = null) => ({
  material,
  label_weight: 1000,
  weight_used: 1000 - restPct * 10,
  low_stock_threshold_pct: own,
});

describe('Spulen-Anzeige', () => {
  it('Standard: niedrig unter 25 %, fast leer ab 8 %', () => {
    expect(stockLevel(spool('PLA', 50), DEFAULT_DISPLAY)).toBe('ok');
    expect(stockLevel(spool('PLA', 25), DEFAULT_DISPLAY)).toBe('ok');
    expect(stockLevel(spool('PLA', 24), DEFAULT_DISPLAY)).toBe('low');
    expect(stockLevel(spool('PLA', 8), DEFAULT_DISPLAY)).toBe('empty');
    expect(stockLevel(spool('PLA', 0), DEFAULT_DISPLAY)).toBe('empty');
  });

  it('Familie überschreibt global, auch für Unterarten (PLA+ → PLA)', () => {
    const cfg = mergeDisplay({ materials: { PLA: { lowPct: 40, emptyPct: 15 } } });
    expect(stockLevel(spool('PLA+', 30), cfg)).toBe('low');
    expect(stockLevel(spool('PLA 2.0+', 12), cfg)).toBe('empty');
    expect(stockLevel(spool('PETG', 30), cfg)).toBe('ok');
  });

  it('Bambuddys Schwelle je Spule überschreibt „Niedrig“, fast leer bleibt darunter', () => {
    expect(stockLevel(spool('PLA', 50, 60), DEFAULT_DISPLAY)).toBe('low');
    expect(thresholdsFor(spool('PLA', 50, 5), DEFAULT_DISPLAY)).toEqual({ lowPct: 5, emptyPct: 5 });
  });

  it('ungültige gespeicherte Werte fallen auf Standard zurück', () => {
    const cfg = mergeDisplay({ lowPct: 5, emptyPct: 10, materials: { PLA: { lowPct: 10, emptyPct: 20 } }, defaultWeight: -1 });
    expect(cfg.lowPct).toBe(25);
    expect(cfg.emptyPct).toBe(8);
    expect(cfg.materials).toEqual({});
    expect(cfg.defaultWeight).toBe(1000);
    expect(mergeDisplay(null)).toEqual(DEFAULT_DISPLAY);
  });
});
