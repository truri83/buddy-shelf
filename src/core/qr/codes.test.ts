import { describe, expect, it } from 'vitest';
import { encodeSpoolCode, parseScan } from './codes';

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
});
