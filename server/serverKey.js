// Wann der Proxy den Bambuddy-Schlüssel des Servers ergänzen darf (nur bei Anfragen ohne eigenen Schlüssel):
// 1) die Anfrage kommt von der App selbst – nicht von einer fremden Webseite im selben Netz (CSRF, WebSocket),
// 2) sie zielt auf einen Bereich, den die App braucht – nicht auf Einstellungen, Archive oder Druckersteuerung.

/** Bereiche unter /api/v1 mit erlaubten Methoden (null = alle). */
const ALLOWED = [
  ['inventory/', null],
  ['spoolman/', null],
  ['printers', ['GET']],
  ['updates/version', ['GET']],
  ['spoolbuddy/scale/', ['POST']],
  ['auth/status', ['GET']],
  ['auth/me', ['GET']],
];

function sameOrigin(headers) {
  const site = headers['sec-fetch-site'];
  if (site) return site === 'same-origin' || site === 'none';
  const origin = headers.origin;
  if (!origin) return true; // kein Browser (curl, Server) – CSRF braucht einen Browser
  try {
    const host = new URL(origin).host;
    return host === headers.host || host === headers['x-forwarded-host'];
  } catch {
    return false;
  }
}

/** @param {{ method: string; url: string; headers: Record<string, string | undefined> }} req */
export function serverKeyAllowed(req) {
  if (!sameOrigin(req.headers)) return false;
  const path = new URL(req.url, 'http://x').pathname;
  if (path.includes('..') || !path.startsWith('/api/v1/')) return false;
  const rest = path.slice('/api/v1/'.length);
  return ALLOWED.some(
    ([prefix, methods]) =>
      (prefix.endsWith('/') ? rest.startsWith(prefix) : rest === prefix || rest.startsWith(`${prefix}/`)) &&
      (!methods || methods.includes(req.method.toUpperCase())),
  );
}
