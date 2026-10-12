import { describe, expect, it } from 'vitest';
import { materialFamily, materialLabel, materialVariant } from './material';

describe('Materialfamilie', () => {
  it('Unterarten gehören zur Familie', () => {
    for (const m of ['PLA', 'PLA+', 'PLA 2.0+', 'PLA-CF', 'pla matte', 'PLA2.0']) expect(materialFamily(m), m).toBe('PLA');
    expect(materialFamily('PETG-CF')).toBe('PETG');
    expect(materialFamily('PCTG')).toBe('PETG');
    expect(materialFamily('PA6-CF')).toBe('PA');
    expect(materialFamily('Nylon')).toBe('PA');
    expect(materialFamily('TPU 95A')).toBe('TPU');
    expect(materialFamily('PC')).toBe('PC');
  });
  it('unbekannt bleibt unbekannt', () => {
    expect(materialFamily('PEEK')).toBeNull();
    expect(materialFamily('')).toBeNull();
  });
  it('Unterart = Rest + Sorte', () => {
    expect(materialVariant('PLA+', 'Matte')).toBe('+ Matte');
    expect(materialVariant('PLA', 'Basic')).toBe('Basic');
    expect(materialVariant('PLA-CF')).toBe('CF');
    expect(materialVariant('PLA')).toBe('');
  });
});

describe('Material-Abzeichen', () => {
  it('Sorte = Farbname wird nicht doppelt gezeigt', () => {
    expect(materialLabel({ material: 'PLA', subtype: 'Jade White', color_name: 'Jade White' })).toBe('PLA');
    expect(materialLabel({ material: 'PLA+', subtype: 'Black', color_name: 'black' })).toBe('PLA+');
    expect(materialLabel({ material: 'PLA', subtype: 'Matte', color_name: 'Charcoal' })).toBe('PLA Matte');
  });
});
