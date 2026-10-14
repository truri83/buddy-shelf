/**
 * Scan-Inhalte, die die App versteht. Reihenfolge der Erkennung ist fest,
 * Module beanspruchen Treffer über `scan` im Manifest.
 *
 *  bm:s:<id>                         eigenes Spulen-Etikett (stabil, ohne Serveradresse), Version 1
 *  bm:t:<druckerId>:<amsId>:<slot>   Slot-Etikett am AMS (Bambuddy-IDs, 0-basiert; amsId 255 = externe Spule)
 *  bm:l:<id>                         Lagerort-Etikett (Bambuddy-Lagerort-ID) – startet „Einräumen“
 *  <App-Adresse>/s/<id> · /l/<id> · /t/<drucker>/<ams>/<slot>
 *                                    dasselbe als Adresse: die normale Handy-Kamera öffnet die Seite direkt
 *  <beliebig>/inventory?spool=<id>   Etikett aus Bambuddy selbst
 *  bambuddy://config?v=1&url=…&key=… Einrichtungs-QR aus Bambuddy (API-Schlüssel)
 *  8/12/13/14 Ziffern mit Prüfziffer   Packungs-Barcode (EAN-8/13, UPC-A, GTIN-14)
 */

export type ScanResult =
  | { kind: 'spool'; spoolId: number; source: 'buddy-shelf' | 'bambuddy-label' }
  | { kind: 'slot'; printerId: number; amsId: number; trayId: number }
  | { kind: 'location'; locationId: number }
  | { kind: 'config'; url: string; apiKey: string; version: number }
  | { kind: 'gtin'; code: string }
  | { kind: 'unknown'; raw: string };

export const SPOOL_CODE_PREFIX = 'bm:s:';

/** Prüfziffer nach GS1 (gilt für EAN-8/13, UPC-A, GTIN-14). */
export function isValidGtin(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
export const SLOT_CODE_PREFIX = 'bm:t:';
export const LOCATION_CODE_PREFIX = 'bm:l:';

/** Externe Spulenhalterung in Bambuddy: ams_id 255, tray_id 0/1. */
export const EXTERNAL_AMS_ID = 255;

export function encodeSpoolCode(spoolId: number): string {
  if (!Number.isInteger(spoolId) || spoolId <= 0) throw new Error(`Ungültige Spulen-ID: ${spoolId}`);
  return `${SPOOL_CODE_PREFIX}${spoolId}`;
}

export function encodeSlotCode(printerId: number, amsId: number, trayId: number): string {
  const ok = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;
  if (!ok(printerId, 1, Number.MAX_SAFE_INTEGER) || !ok(amsId, 0, 255) || !ok(trayId, 0, 3)) {
    throw new Error(`Ungültiger Slot: ${printerId}/${amsId}/${trayId}`);
  }
  return `${SLOT_CODE_PREFIX}${printerId}:${amsId}:${trayId}`;
}

export function encodeLocationCode(locationId: number): string {
  if (!Number.isInteger(locationId) || locationId <= 0) throw new Error(`Ungültiger Lagerort: ${locationId}`);
  return `${LOCATION_CODE_PREFIX}${locationId}`;
}

/** Feste Adresse für Etiketten (Einstellung „Adresse für Etiketten“); null = aktuelle Adresse der Seite. */
let configuredBase: string | null = null;
export function setLabelBase(url: string | null): void {
  configuredBase = url?.trim().replace(/\/+$/, '') || null;
}

/**
 * Etiketten-Inhalt als Adresse der App (bm:s:3 → <app>/s/3): Die normale Handy-Kamera öffnet dann direkt das
 * Schnellmenü bzw. „Einräumen“/Slot – ohne App-Scanner. Ohne Browser (Tests, Server) bleibt der kurze Code.
 */
export function labelCode(code: string, base: string | undefined = configuredBase ?? globalThis.location?.origin): string {
  if (!base) return code;
  const root = base.replace(/\/+$/, '');
  if (code.startsWith(SPOOL_CODE_PREFIX)) return `${root}/s/${code.slice(SPOOL_CODE_PREFIX.length)}`;
  if (code.startsWith(LOCATION_CODE_PREFIX)) return `${root}/l/${code.slice(LOCATION_CODE_PREFIX.length)}`;
  if (code.startsWith(SLOT_CODE_PREFIX)) return `${root}/t/${code.slice(SLOT_CODE_PREFIX.length).replaceAll(':', '/')}`;
  return code;
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

  if (text.toLowerCase().startsWith(LOCATION_CODE_PREFIX)) {
    const id = positiveInt(text.slice(LOCATION_CODE_PREFIX.length));
    return id ? { kind: 'location', locationId: id } : { kind: 'unknown', raw: text };
  }

  if (text.toLowerCase().startsWith(SLOT_CODE_PREFIX)) {
    const m = /^(\d+):(\d{1,3}):(\d)$/.exec(text.slice(SLOT_CODE_PREFIX.length));
    if (m) {
      const [printerId, amsId, trayId] = [Number(m[1]), Number(m[2]), Number(m[3])];
      if (printerId > 0 && amsId <= 255 && trayId <= 3) return { kind: 'slot', printerId, amsId, trayId };
    }
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
    // eigene Etiketten als Adresse (jede Adresse der App – Tailscale oder Heimnetz)
    const own = /^\/(s|l|t)\/([^?#]+?)\/?$/.exec(u.pathname);
    if (own) {
      const short = own[1] === 's' ? SPOOL_CODE_PREFIX : own[1] === 'l' ? LOCATION_CODE_PREFIX : SLOT_CODE_PREFIX;
      return parseScan(short + own[2]!.replaceAll('/', ':'));
    }
    if (/\/inventory\/?$/.test(u.pathname)) {
      const id = positiveInt(u.searchParams.get('spool'));
      if (id) return { kind: 'spool', spoolId: id, source: 'bambuddy-label' };
    }
  } catch {
    /* keine URL */
  }

  // Packungs-Barcode, auch von Hand mit Leerzeichen/Strichen eingegeben („4 006381 333931“)
  const digits = text.replace(/[\s-]/g, '');
  if (/^\d+$/.test(digits) && isValidGtin(digits)) return { kind: 'gtin', code: digits };

  return { kind: 'unknown', raw: text };
}
