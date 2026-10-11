import { describe, expect, it } from 'vitest';
import { threshold, thresholdRedBlack } from './postprocess';
import { fillVariables, headPixels, parseTemplate, templateUsesRed, type LabelTemplate } from './template';
import { BUILTIN_TEMPLATES } from './templates';
import { PRINTER_PROFILES } from './profiles';

const px = (...rgba: number[]) => ({ data: new Uint8ClampedArray(rgba) });

describe('fillVariables', () => {
  it('ersetzt bekannte Platzhalter, lässt unbekannte stehen', () => {
    expect(fillVariables('bm:s:{id} · {material} {unknown}', { id: '4', material: 'PLA Basic' })).toBe('bm:s:4 · PLA Basic {unknown}');
  });
  it('erlaubt Leerzeichen wie NiimBlue', () => {
    expect(fillVariables('#{ id }', { id: '7' })).toBe('#7');
  });
  it('{dt} wird zum heutigen Datum', () => {
    expect(fillVariables('{dt}', {})).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Schwellwert', () => {
  it('Schwarz/Weiß: Rot wird schwarz, Transparenz weiß', () => {
    const img = threshold(px(255, 0, 0, 255, 250, 250, 250, 255, 0, 0, 0, 0));
    expect([...img.data]).toEqual([0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
  });
  it('Schwarz/Rot/Weiß behält Rot', () => {
    const img = thresholdRedBlack(px(230, 20, 20, 255, 20, 20, 20, 255, 200, 200, 200, 255));
    expect([...img.data]).toEqual([255, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255]);
  });
});

describe('Vorlagen', () => {
  const b1pro = PRINTER_PROFILES['niimbot-b1-pro']!;
  it.each(BUILTIN_TEMPLATES)('$title passt auf den Druckkopf des B1 Pro', (t: LabelTemplate) => {
    expect(headPixels(t)).toBeLessThanOrEqual(b1pro.printheadPixels);
    expect(parseTemplate(t).id).toBe(t.id);
  });
  it('erkennt Rot in der Vorlage', () => {
    expect(BUILTIN_TEMPLATES.some(templateUsesRed)).toBe(true);
    expect(BUILTIN_TEMPLATES.some((t) => !templateUsesRed(t))).toBe(true);
  });
  it('lehnt Unsinn beim Import ab', () => {
    expect(() => parseTemplate({ foo: 1 })).toThrow(/Vorlage/);
  });
});
