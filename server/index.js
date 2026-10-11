// Produktionsserver: liefert die gebaute App aus und leitet /api (inkl. WebSocket /api/v1/ws)
// an Bambuddy weiter. Kein Generalschlüssel – Auth kommt vom Client (X-API-Key bzw. Login).
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import proxy from '@fastify/http-proxy';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const BAMBUDDY_URL = process.env.BAMBUDDY_URL;
const PORT = Number(process.env.PORT ?? 8080);

if (!BAMBUDDY_URL) {
  console.error('BAMBUDDY_URL fehlt (z. B. http://bambuddy:8000).');
  process.exit(1);
}

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

await app.register(proxy, { upstream: BAMBUDDY_URL, prefix: '/api', rewritePrefix: '/api', websocket: true });

// Phase 2: Druckdienst (niimblue-node) für den Etikettendruck vom iPhone.
if (process.env.NIIMBLUE_URL) {
  await app.register(proxy, { upstream: process.env.NIIMBLUE_URL, prefix: '/print', rewritePrefix: '' });
}

app.get('/healthz', async () => ({ ok: true }));

await app.register(fastifyStatic, { root, wildcard: false });
// SPA-Fallback: alle unbekannten Pfade → index.html
app.setNotFoundHandler((req, reply) => {
  if (req.raw.url?.startsWith('/api')) return reply.code(404).send({ detail: 'Not found' });
  return reply.sendFile('index.html');
});

await app.listen({ host: '0.0.0.0', port: PORT });
