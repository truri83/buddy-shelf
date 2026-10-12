// Produktionsserver: liefert die gebaute App aus und leitet /api (inkl. WebSocket /api/v1/ws)
// an Bambuddy weiter. Ist BAMBUDDY_API_KEY gesetzt, ergänzt der Proxy ihn bei Anfragen ohne eigenen
// Schlüssel – dann muss kein Gerät einen Schlüssel eintragen (ein Schlüssel im Gerät geht vor).
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import proxy from '@fastify/http-proxy';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { registerAdmin } from './admin.js';
import { registerCatalog } from './catalog.js';
import { registerTemplates } from './templates.js';
import { registerExtras } from './extras.js';
import { registerPrefs } from './prefs.js';
import { serverKeyAllowed } from './serverKey.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const BAMBUDDY_URL = process.env.BAMBUDDY_URL;
const PORT = Number(process.env.PORT ?? 8080);
const BAMBUDDY_API_KEY = (process.env.BAMBUDDY_API_KEY ?? '').trim();
const VERSION = JSON.parse(readFileSync(join(root, '..', 'package.json'), 'utf8')).version;

if (!BAMBUDDY_URL) {
  console.error('BAMBUDDY_URL fehlt (z. B. http://bambuddy:8000).');
  process.exit(1);
}

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

// Selbst-Update auf Unraid (nur mit BUDDY_SHELF_ADMIN_TOKEN). Statische Routen gehen vor den Proxy.
await registerAdmin(app, { version: VERSION });

// Filament-Katalog (SpoolmanDB) für Hersteller-/Material-/Farblisten
await registerCatalog(app);

// Eigene Etikett-Vorlagen im Datenordner (BUDDY_SHELF_TEMPLATES_DIR)
await registerTemplates(app);

// Zusatzdaten je Spule (getrocknet, Etikett, Refill): in Spoolman, wenn Bambuddy darauf steht, sonst Datei
// Gemeinsame Einstellungen (Trocknungswerte u. a.) im Datenordner
await registerPrefs(app);

await registerExtras(app, { bambuddyUrl: BAMBUDDY_URL, apiKey: BAMBUDDY_API_KEY, spoolmanUrl: process.env.SPOOLMAN_URL });

/**
 * Server-Schlüssel nur einsetzen, wenn das Gerät keinen eigenen mitschickt – und nur für die App selbst und die
 * Bereiche, die sie braucht (serverKey.js): keine fremden Webseiten im Netz, keine Einstellungen/Steuerung.
 */
const withServerKey = (req, headers = {}) =>
  BAMBUDDY_API_KEY &&
  !req.headers['x-api-key'] &&
  !req.headers.authorization &&
  serverKeyAllowed({ method: req.method ?? 'GET', url: req.url ?? '', headers: req.headers })
    ? { ...headers, 'x-api-key': BAMBUDDY_API_KEY }
    : headers;

await app.register(proxy, {
  upstream: BAMBUDDY_URL,
  prefix: '/api',
  rewritePrefix: '/api',
  websocket: true,
  replyOptions: { rewriteRequestHeaders: (req, headers) => withServerKey(req, headers) },
  wsClientOptions: { rewriteRequestHeaders: (headers, req) => withServerKey(req, headers) },
});

// Phase 2: Druckdienst (niimblue-node) für den Etikettendruck vom iPhone.
if (process.env.NIIMBLUE_URL) {
  await app.register(proxy, { upstream: process.env.NIIMBLUE_URL, prefix: '/print', rewritePrefix: '' });
}

// sha zeigt, welcher Build läuft – daran erkennt das Deploy, dass das Update angekommen ist.
app.get('/healthz', async () => ({ ok: true, version: VERSION, sha: process.env.BUILD_SHA || null }));

await app.register(fastifyStatic, { root, wildcard: false });
// SPA-Fallback: alle unbekannten Pfade → index.html
app.setNotFoundHandler((req, reply) => {
  if (req.raw.url?.startsWith('/api')) return reply.code(404).send({ detail: 'Not found' });
  return reply.sendFile('index.html');
});

// Node als PID 1 ignoriert SIGTERM – sonst wartet jedes docker stop den Timeout ab.
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => void app.close().then(() => process.exit(0)));

await app.listen({ host: '0.0.0.0', port: PORT });
