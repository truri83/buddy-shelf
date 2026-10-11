import { describe, expect, it } from 'vitest';
import { fillRatio, remainingGrams, weightUsedFromScale } from './types';

describe('Gewichte', () => {
  const spool = { label_weight: 1000, core_weight: 237, weight_used: 546 };

  it('Restgewicht und Füllstand', () => {
    expect(remainingGrams(spool)).toBe(454);
    expect(fillRatio(spool)).toBeCloseTo(0.454);
  });

  it('nie negativ', () => {
    expect(remainingGrams({ label_weight: 1000, weight_used: 1200 })).toBe(0);
  });

  it('Waage: Brutto minus Leerspule', () => {
    // 691 g brutto, 237 g Leerspule → 454 g Rest → 546 g verbraucht
    expect(weightUsedFromScale(691, spool)).toBe(546);
    expect(weightUsedFromScale(100, spool)).toBe(1000);
  });
});

describe('Fehlertexte', async () => {
  const { describeError } = await import('./client');
  it('nimmt Bambuddys detail', () => {
    expect(describeError(409, { detail: 'Location already exists' })).toBe('Location already exists');
    expect(describeError(422, { detail: [{ loc: ['body', 'weight_grams'], msg: 'Input should be greater than 0' }] })).toBe('weight_grams: Input should be greater than 0');
    expect(describeError(401, undefined)).toMatch(/API-Schlüssel/);
    expect(describeError(500, 'x')).toBeNull();
  });
});
