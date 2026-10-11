import { configureApi } from '@/core/api';
import { storage } from '@/core/platform';
import { parseScan } from '@/core/qr/codes';
import { modules } from './registry';

export type ScanOutcome = { route: string } | { configured: true } | { notYet: 'slot' } | { unknown: string };

/** Scan-Verteiler der Shell: Einrichtungs-QR selbst behandeln, Rest an die Module. */
export function dispatchScan(raw: string): ScanOutcome {
  const result = parseScan(raw);
  if (result.kind === 'config') {
    const cfg = { baseUrl: result.url, apiKey: result.apiKey };
    configureApi(cfg);
    storage.set('api', cfg);
    return { configured: true };
  }
  for (const m of modules) {
    const route = m.scan?.(result);
    if (route) return { route };
  }
  // Slot-Etiketten sind erkannt, der Doppelscan-Ablauf folgt mit Steckbrief SP-08.
  if (result.kind === 'slot') return { notYet: 'slot' };
  return { unknown: raw };
}
