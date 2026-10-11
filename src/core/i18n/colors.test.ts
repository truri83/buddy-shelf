import { describe, expect, it } from 'vitest';
import { colorFamily, colorSearchText, colorToEnglish, colorToGerman, foldGerman, otherLanguageName } from './colors';

describe('Farbnamen englisch → deutsch', () => {
  it.each([
    ['Black', 'Schwarz'],
    ['Light Gray', 'Hellgrau'],
    ['Dark Blue', 'Dunkelblau'],
    ['Jade White', 'Jadeweiß'],
    ['Bambu Green', 'Bambugrün'],
    ['Ash Grey', 'Aschgrau'],
    ['Titan Gray', 'Titangrau'],
    ['Ice Blue', 'Eisblau'],
    ['Jet Black', 'Tiefschwarz'],
    ['Matte Charcoal', 'Matt Anthrazit'],
    ['Rainbow 01', 'Regenbogen 01'],
    ['Cocoa Brown', 'Kakaobraun'],
    ['Hot Pink', 'Knallpink'],
    ['Lemon Yellow', 'Zitronengelb'],
    ['Midnight Blue', 'Mitternachtsblau'],
    ['Mistletoe Green', 'Mistelgrün'],
    ['Navy Blue', 'Marineblau'],
    ['Bone White', 'Knochenweiß'],
    ['Ivory White', 'Elfenbeinweiß'],
    ['Blue Grey', 'Blaugrau'],
    ['Olive Green', 'Olivgrün'],
    ['Lime Green', 'Limettengrün'],
    ['Black & White', 'Schwarz & Weiß'],
  ])('%s → %s', (en, de) => expect(colorToGerman(en)).toBe(de));

  it.each(['Arctic Whisper', 'Burnt Titanium', 'Ash', 'Silk+ Gold', 'Desert Tan Special'])('unbekannt bleibt unverändert: %s', (n) => {
    expect(colorToGerman(n)).toBe(n);
  });
});

describe('Farbnamen deutsch → englisch', () => {
  it.each([
    ['Grau', 'Gray'],
    ['Hellgrau', 'Light Gray'],
    ['Weiß', 'White'],
    ['Weiss', 'White'],
    ['Gruen', 'Green'],
    ['Jadeweiß', 'Jade White'],
    ['Rotbraun', 'Red Brown'],
    ['Weinrot', 'Wine Red'],
    ['Dunkel Grau', 'Dark Gray'],
    ['Schwarz Matt', 'Black Matte'],
  ])('%s → %s', (de, en) => expect(colorToEnglish(de)).toBe(en));

  it('andere Sprache nur, wenn sicher', () => {
    expect(otherLanguageName('Jade White')).toBe('Jadeweiß');
    expect(otherLanguageName('Grau')).toBe('Gray');
    expect(otherLanguageName('Seide Gold')).toBe('Silk Gold');
    expect(otherLanguageName('Galaxy')).toBe(null);
    expect(otherLanguageName('Reinweiß')).toBe(null);
    expect(otherLanguageName(null)).toBe(null);
  });
});

describe('Farbfamilie aus Hex', () => {
  it.each([
    ['000000', 'schwarz'],
    ['F5F5F0', 'weiß'],
    ['8A8D91', 'grau'],
    ['00AE42', 'grün'],
    ['C12E1F', 'rot'],
    ['F5547C', 'rosa'],
    ['6B4226', 'braun'],
    ['5E43B7', 'lila'],
    ['F7E6DE', 'beige'],
    ['D3B7A7', 'beige'],
    ['AE835B', 'braun'],
    ['E8DBB7', 'beige'],
    ['847D48', 'braun'],
    ['808000', 'grün'],
    ['800020', 'rot'],
    ['5A1A2A', 'rot'],
  ])('%s → %s', (hex, fam) => expect(colorFamily(`${hex}FF`)).toBe(fam));
  it('ohne Farbe', () => expect(colorFamily(null)).toBe(null));
});

describe('Suche', () => {
  it('beide Sprachen, Familie, ohne Sonderzeichen', () => {
    const s = colorSearchText('Bambu Green', '00AE42FF');
    expect(s).toContain('gruen');
    expect(s).toContain('green');
    expect(colorSearchText('Grau', '8A8D91FF')).toContain('gray');
    expect(colorSearchText('White', 'FFFFFFFF')).toContain(foldGerman('weiß'));
  });
});
