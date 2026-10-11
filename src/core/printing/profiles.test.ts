import { describe, expect, it } from 'vitest';
import { PRINTER_PROFILES, mmToPx, printWidthMm, resolveInk } from './profiles';

const b1pro = PRINTER_PROFILES['niimbot-b1-pro']!;
const b1 = PRINTER_PROFILES['niimbot-b1']!;

describe('Druckerprofile', () => {
  it('B1 Pro druckt 48 mm breit', () => {
    expect(printWidthMm(b1pro)).toBe(48);
    expect(printWidthMm(b1)).toBe(48);
  });

  it('rechnet mm in Pixel', () => {
    expect(mmToPx(30, 300)).toBe(354);
    expect(mmToPx(48, 203)).toBe(384);
  });

  it('Rot wird auf einfarbigen Druckern schwarz', () => {
    expect(resolveInk('red', b1pro)).toBe('red');
    expect(resolveInk('red', b1)).toBe('black');
  });
});
