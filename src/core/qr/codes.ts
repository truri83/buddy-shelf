/**
 * Scan-Inhalte, die die App versteht. Reihenfolge der Erkennung ist fest,
 * Module beanspruchen Treffer über `scan` im Manifest.
 *
 *  bm:s:<id>                         eigenes Etikett (stabil, ohne Serveradresse), Version 1
 *  <beliebig>/inventory?spool=<id>   Etikett aus Bambuddy selbst
 *  bambuddy://config?v=1&url=…&key=… Einrichtungs-QR aus Bambuddy (API-Schlüssel)
 */

export type ScanResult =
  | { kind: 'spool'; spoolId: number; source: 'buddy-shelf' | 'bambuddy-label' }
  | { kind: 'config'; url: string; apiKey: string; version: number }
  | { kind: 'unknown'; raw: string };

export const SPOOL_CODE_PREFIX = 'bm:s:';

export function encodeSpoolCode(spoolId: number): string {
  if (!Number.isInteger(spoolId) || spoolId <= 0) throw new Error(`Ungültige Spulen-ID: ${spoolId}`);
  return `${SPOOL_CODE_PREFIX}${spoolId}`;
}

function positiveInt(v: string | null | undefined): number | null {
  if (!v || !/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n > 0 && Number.isSafeInteger(n) ? n : null;
}

export function parseScan(raw: string): ScanResult {
  const text = raw.trim();

  if (text.toLowerCase().startsWith(SPOOL_CODE_PREFIX)) {
    const id = positiveInt(text.slice(SPOOL_CODE_PREFIX.length));
    if (id) return { kind: 'spool', spoolId: id, source: 'buddy-shelf' };
    return { kind: 'unknown', raw: text };
  }

  if (text.toLowerCase().startsWith('bambuddy://config')) {
    try {
      const q = new URL(text.replace(/^bambuddy:\/\/config/i, 'https://x/config')).searchParams;
      const url = q.get('url');
      const key = q.get('key');
      const version = positiveInt(q.get('v')) ?? 1;
      if (url && key && /^https?:\/\//i.test(url)) return { kind: 'config', url: url.replace(/\/+$/, ''), apiKey: key, version };
    } catch {
      /* fällt durch auf unknown */
    }
    return { kind: 'unknown', raw: text };
  }

  try {
    const u = new URL(text);
    if (/\/inventory\/?$/.test(u.pathname)) {
      const id = positiveInt(u.searchParams.get('spool'));
      if (id) return { kind: 'spool', spoolId: id, source: 'bambuddy-label' };
    }
  } catch {
    /* keine URL */
  }

  return { kind: 'unknown', raw: text };
}
