import { describe, expect, it } from 'vitest';
import { readBarcodes, writeBarcode } from 'zxing-wasm/full';
import { parseScan } from '@/core/qr/codes';
import { BARCODES_ONLY, QR_AND_BARCODES, type ScanFormat } from './scanner';

// BarcodeDetector-Namen → zxing-Namen (so übersetzt es auch der Ponyfill)
const ZXING: Record<ScanFormat, string> = { qr_code: 'QRCode', ean_13: 'EAN-13', ean_8: 'EAN-8', upc_a: 'UPC-A', code_128: 'Code128' };

async function scan(text: string, symbology: string, formats: ScanFormat[]) {
  const { image } = await writeBarcode(text, { format: symbology as never, scale: 3 });
  const hits = await readBarcodes(image!, { formats: formats.map((f) => ZXING[f]) as never });
  return hits.map((h) => h.text);
}

describe('Packungs-Barcodes', () => {
  // Bambu-Lab-Kartons drucken die EAN als Code-128 (Foto vom 12.10.: 6975337030072, PLA Matte Sakura Pink)
  it('Code-128 mit EAN-Ziffern wird erkannt und als Produktcode gelesen', async () => {
    for (const formats of [QR_AND_BARCODES, BARCODES_ONLY]) {
      const texts = await scan('6975337030072', 'Code128', formats);
      expect(texts).toEqual(['6975337030072']);
      expect(parseScan(texts[0]!)).toEqual({ kind: 'gtin', code: '6975337030072' });
    }
  });

  it('Losnummer als Code-128 wird erkannt, ist aber kein Produktcode', async () => {
    const texts = await scan('04960109A', 'Code128', QR_AND_BARCODES);
    expect(texts).toEqual(['04960109A']);
    expect(parseScan('04960109A').kind).toBe('unknown');
  });

  it('klassische EAN-13 geht weiterhin', async () => {
    expect(await scan('6975337030072', 'EAN-13', BARCODES_ONLY)).toEqual(['6975337030072']);
  });
});
