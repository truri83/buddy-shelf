import { describe, expect, it } from 'vitest';
import { encodeSlotCode, encodeSpoolCode, parseScan } from './codes';

describe('parseScan', () => {
  it('liest eigene Etiketten', () => {
    expect(parseScan('bm:s:42')).toEqual({ kind: 'spool', spoolId: 42, source: 'buddy-shelf' });
    expect(parseScan('  BM:S:7 ')).toEqual({ kind: 'spool', spoolId: 7, source: 'buddy-shelf' });
  });

  it('lehnt kaputte eigene Codes ab', () => {
    expect(parseScan('bm:s:abc').kind).toBe('unknown');
    expect(parseScan('bm:s:0').kind).toBe('unknown');
  });

  it('liest Bambuddy-Etiketten', () => {
    expect(parseScan('https://tower.example.ts.net/inventory?spool=16')).toEqual({ kind: 'spool', spoolId: 16, source: 'bambuddy-label' });
  });

  it('liest den Einrichtungs-QR von Bambuddy', () => {
    const raw = `bambuddy://config?v=1&url=${encodeURIComponent('http://100.101.172.117:8008/')}&key=${encodeURIComponent('bb_abc123')}`;
    expect(parseScan(raw)).toEqual({ kind: 'config', url: 'http://100.101.172.117:8008', apiKey: 'bb_abc123', version: 1 });
  });

  it('erkennt Fremdes als unbekannt', () => {
    expect(parseScan('https://spooly.eu/inventory/140ae81f').kind).toBe('unknown');
    expect(parseScan('hallo').kind).toBe('unknown');
  });

  it('kodiert Spulen-IDs', () => {
    expect(encodeSpoolCode(4)).toBe('bm:s:4');
    expect(() => encodeSpoolCode(0)).toThrow();
  });

  it('liest Slot-Etiketten am AMS', () => {
    expect(parseScan('bm:t:1:0:2')).toEqual({ kind: 'slot', printerId: 1, amsId: 0, trayId: 2 });
    expect(parseScan('bm:t:1:255:0')).toEqual({ kind: 'slot', printerId: 1, amsId: 255, trayId: 0 });
    expect(parseScan('bm:t:1:0:4').kind).toBe('unknown');
    expect(parseScan('bm:t:0:0:1').kind).toBe('unknown');
    expect(parseScan('bm:t:1:256:0').kind).toBe('unknown');
  });

  it('kodiert Slots', () => {
    expect(encodeSlotCode(1, 1, 3)).toBe('bm:t:1:1:3');
    expect(() => encodeSlotCode(1, 0, 4)).toThrow();
  });
});

describe('Lagerort-Etikett', async () => {
  const { encodeLocationCode } = await import('./codes');
  it('hin und zurück', () => {
    expect(parseScan(encodeLocationCode(3))).toEqual({ kind: 'location', locationId: 3 });
    expect(parseScan('BM:L:12')).toEqual({ kind: 'location', locationId: 12 });
  });
  it('kaputt = unbekannt', () => {
    expect(parseScan('bm:l:0').kind).toBe('unknown');
    expect(parseScan('bm:l:x').kind).toBe('unknown');
    expect(() => encodeLocationCode(0)).toThrow();
  });
});

describe('Packungs-Barcode', async () => {
  const { parseScan, isValidGtin } = await import('./codes');
  it('erkennt EAN-13/UPC-A mit gültiger Prüfziffer', () => {
    expect(parseScan('6975337031390')).toEqual({ kind: 'gtin', code: '6975337031390' });
    expect(parseScan('191314034277')).toEqual({ kind: 'gtin', code: '191314034277' });
    expect(isValidGtin('96385074')).toBe(true);
  });
  it('falsche Prüfziffer oder Länge ist kein Barcode', () => {
    expect(parseScan('6975337031391').kind).toBe('unknown');
    expect(parseScan('12345').kind).toBe('unknown');
  });
});

describe('Barcode von Hand', async () => {
  const { parseScan } = await import('./codes');
  it('Leerzeichen und Striche sind erlaubt', () => {
    expect(parseScan('4 006381 333931')).toEqual({ kind: 'gtin', code: '4006381333931' });
    expect(parseScan('6975337-031390')).toEqual({ kind: 'gtin', code: '6975337031390' });
  });
});
