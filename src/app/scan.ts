import { configureApi } from '@/core/api';
import { storage } from '@/core/platform';
import { parseScan } from '@/core/qr/codes';
import { modules } from './registry';

export type ScanOutcome = { route: string } | { config: { url: string; apiKey: string } } | { unknown: string };

/** Scan-Verteiler der Shell: Einrichtungs-QR erkennen (Übernahme erst nach Rückfrage), Rest an die Module. */
export function dispatchScan(raw: string): ScanOutcome {
  const result = parseScan(raw);
  if (result.kind === 'config') return { config: { url: result.url, apiKey: result.apiKey } };
  for (const m of modules) {
    const route = m.scan?.(result);
    if (route) return { route };
  }
  return { unknown: raw };
}

/**
 * Einrichtungs-QR übernehmen. Im Browser (PWA) bleibt die Adresse leer: Wir gehen immer über den
 * eigenen Server, eine direkte Bambuddy-Adresse würde der Browser blockieren (CORS/Mixed Content).
 * Nur außerhalb des Browsers (native App) zählt die Adresse aus dem QR.
 */
export function applyConfig(c: { url: string; apiKey: string }): void {
  const inBrowser = location.protocol === 'http:' || location.protocol === 'https:';
  const cfg = { baseUrl: inBrowser ? '' : c.url, apiKey: c.apiKey };
  configureApi(cfg);
  storage.set('api', cfg);
}
