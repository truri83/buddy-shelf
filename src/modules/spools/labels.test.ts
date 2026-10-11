import { describe, expect, it } from 'vitest';
import type { Spool } from '@/core/api';
import { fillVariables, SPOOL_TEMPLATE } from '@/core/printing';
import { spoolLabelVariables } from './labels';

const spool = {
  id: 4, material: 'PLA', subtype: 'Basic', color_name: 'Black', brand: 'Bambu Lab', label_weight: 1000,
} as Spool;

describe('Spulen-Etikett', () => {
  it('liefert alle Platzhalter der Standardvorlage', () => {
    const vars = spoolLabelVariables(spool);
    expect(vars).toMatchObject({ id: '4', code: 'bm:s:4', material: 'PLA Basic', color: 'Black', brand: 'Bambu Lab', weight: '1000 g' });
    for (const o of SPOOL_TEMPLATE.canvas.objects) {
      expect(fillVariables(String(o.text), vars)).not.toMatch(/{\w+}/);
    }
  });
  it('QR enthält bm:s:<id>', () => {
    const qr = SPOOL_TEMPLATE.canvas.objects.find((o) => o.type === 'QRCode')!;
    expect(fillVariables(String(qr.text), spoolLabelVariables(spool))).toBe('bm:s:4');
  });
  it('fehlende Angaben werden leer statt "null"', () => {
    const vars = spoolLabelVariables({ ...spool, subtype: null, color_name: null, brand: null });
    expect(vars.material).toBe('PLA');
    expect(vars.color).toBe('');
  });
});
