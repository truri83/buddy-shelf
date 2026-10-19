import { describe, expect, it } from 'vitest';
import type { Spool } from '@/core/api';
import { BUILTIN_TEMPLATES, fillVariables } from '@/core/printing';

const SPOOL_TEMPLATES = BUILTIN_TEMPLATES.filter((x) => x.kind === 'spool');
const SPOOL_TEMPLATE = SPOOL_TEMPLATES[0]!;
import { spoolLabelVariables } from './labels';

const spool = {
  id: 4,
  material: 'PLA',
  subtype: 'Basic',
  color_name: 'Black',
  brand: 'Bambu Lab',
  label_weight: 1000,
} as Spool;

describe('Spulen-Etikett', () => {
  it('liefert alle Platzhalter der Standardvorlage', () => {
    const vars = spoolLabelVariables(spool);
    expect(vars).toMatchObject({ id: '4', code: 'bm:s:4', material: 'PLA Basic', color: 'Black', brand: 'Bambu Lab', weight: '1000 g' });
    for (const o of SPOOL_TEMPLATE.canvas.objects) {
      expect(fillVariables(String(o.text), vars)).not.toMatch(/{\w+}/);
    }
  });
  it('jede Spulen-Vorlage hat nur bekannte Platzhalter und einen QR mit bm:s:<id>', () => {
    const vars = spoolLabelVariables({ ...spool, core_weight: 237, material_number: null });
    expect(vars).toMatchObject({ core: '237 g', article: '–' });
    for (const tpl of SPOOL_TEMPLATES) {
      for (const o of tpl.canvas.objects) expect(fillVariables(String(o.text), vars), tpl.id).not.toMatch(/{\w+}/);
      const qr = tpl.canvas.objects.find((o) => o.type === 'QRCode');
      expect(fillVariables(String(qr?.text), vars), tpl.id).toBe('bm:s:4');
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

describe('Trocknungs-Etikett', async () => {
  const { driedLabelVariables } = await import('./labels');
  const { guessKind } = await import('@/core/printing/template');
  it('Datum ausdrücklich oder aus der Spule, deutsch formatiert', () => {
    const s = {
      id: 7,
      material: 'PLA',
      subtype: 'Basic',
      color_name: 'Black',
      brand: 'Bambu Lab',
      label_weight: 1000,
      core_weight: 250,
      material_number: null,
      dried_at: '2026-10-02T00:00:00',
    } as never;
    expect(driedLabelVariables(s, '2026-10-19').dried).toBe('19.10.2026');
    expect(driedLabelVariables(s).dried).toBe('02.10.2026');
  });
  it('Vorlagen mit {dried} gelten als Trocknungs-Etikett', () => {
    expect(guessKind([{ type: 'Textbox', text: 'Getrocknet {dried}' }])).toBe('dried');
  });
});
