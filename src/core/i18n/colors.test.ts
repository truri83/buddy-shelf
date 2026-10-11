import { describe, expect, it } from 'vitest';
import { colorFamily, colorSearchText, colorToEnglish, colorToGerman, otherLanguageName } from './colors';

describe('Farbnamen de ⇄ en', () => {
  it('englisch → deutsch mit Komposita', () => {
    expect(colorToGerman('Black')).toBe('Schwarz');
    expect(colorToGerman('Light Gray')).toBe('Hellgrau');
    expect(colorToGerman('Dark Blue')).toBe('Dunkelblau');
    expect(colorToGerman('Jade White')).toBe('Jadeweiß');
    expect(colorToGerman('Bambu Green')).toBe('Bambugrün');
    expect(colorToGerman('Matte Charcoal')).toBe('Matt Anthrazit');
    expect(colorToGerman('Rainbow 01')).toBe('Regenbogen 01');
  });
  it('deutsch → englisch', () => {
    expect(colorToEnglish('Grau')).toBe('Gray');
    expect(colorToEnglish('Hellgrau')).toBe('Light Gray');
    expect(colorToEnglish('Weiß')).toBe('White');
    expect(colorToEnglish('Jadeweiß')).toBe('Jade White');
  });
  it('andere Sprache nur, wenn sich etwas ändert', () => {
    expect(otherLanguageName('Jade White')).toBe('Jadeweiß');
    expect(otherLanguageName('Grau')).toBe('Gray');
    expect(otherLanguageName('Galaxy')).toBe(null);
    expect(otherLanguageName(null)).toBe(null);
  });
  it('Farbfamilie aus Hex', () => {
    expect(colorFamily('000000FF')).toBe('schwarz');
    expect(colorFamily('F5F5F0FF')).toBe('weiß');
    expect(colorFamily('8A8D91FF')).toBe('grau');
    expect(colorFamily('00AE42FF')).toBe('grün');
    expect(colorFamily('C12E1FFF')).toBe('rot');
    expect(colorFamily('F5547CFF')).toBe('rosa');
    expect(colorFamily('6B4226FF')).toBe('braun');
    expect(colorFamily(null)).toBe(null);
  });
  it('Suche findet beide Sprachen und die Familie', () => {
    const s = colorSearchText('Bambu Green', '00AE42FF');
    expect(s).toContain('grün');
    expect(s).toContain('green');
    expect(colorSearchText('Grau', '8A8D91FF')).toContain('gray');
    expect(colorSearchText('Rainbow 01', 'C2187AFF')).toContain('rosa');
  });
});
