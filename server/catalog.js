// Filament-Katalog aus SpoolmanDB (github.com/Donkie/SpoolmanDB, MIT): ~8 000 Filamente mit Hersteller,
// Material, Farbe (Hex), Nettogewicht und Leerspule. Die Datei ist ~4,6 MB – der Server lädt sie einmal
// am Tag und liefert dem Handy nur schlanke Auszüge. Wird in server/index.js und im Vite-Dev-Server genutzt.

const SOURCE = process.env.FILAMENT_DB_URL || 'https://donkie.github.io/SpoolmanDB/filaments.json';
const TTL_MS = 24 * 60 * 60 * 1000;

let cache = { at: 0, data: /** @type {any[] | null} */ (null), loading: /** @type {Promise<any[]> | null} */ (null) };

async function load() {
  if (cache.data && Date.now() - cache.at < TTL_MS) return cache.data;
  cache.loading ??= (async () => {
    try {
      const res = await fetch(SOURCE, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`SpoolmanDB HTTP ${res.status}`);
      const raw = await res.json();
      cache = { at: Date.now(), data: raw.filter((f) => (f.diameter ?? 1.75) === 1.75).map(slim), loading: null };
      return cache.data;
    } catch (e) {
      cache.loading = null;
      // Alte Daten weiter nutzen, wenn die Quelle kurz nicht erreichbar ist
      if (cache.data) return cache.data;
      throw e;
    }
  })();
  return cache.loading;
}

/** Nur was die App braucht. */
function slim(f) {
  return {
    id: f.id,
    manufacturer: f.manufacturer,
    name: f.name,
    material: f.material,
    color_hex: normHex(f.color_hex ?? f.color_hexes?.[0] ?? null),
    weight: f.weight ?? null,
    spool_weight: f.spool_weight ?? null,
    spool_type: f.spool_type ?? null,
    finish: f.finish ?? null,
    translucent: !!f.translucent,
  };
}

function normHex(h) {
  if (!h) return null;
  const v = String(h).replace('#', '').toUpperCase();
  return /^[0-9A-F]{6}([0-9A-F]{2})?$/.test(v) ? v.slice(0, 6) : null;
}

const uniqSorted = (list) => [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
const eq = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();

/** Antwort für einen Katalog-Pfad (ohne /catalog-Präfix). */
export async function catalogResponse(path, query) {
  const data = await load();
  if (path === '/manufacturers') return uniqSorted(data.map((f) => f.manufacturer));
  if (path === '/materials') {
    const m = query.get('manufacturer');
    return uniqSorted(data.filter((f) => !m || eq(f.manufacturer, m)).map((f) => f.material));
  }
  if (path === '/filaments') {
    const m = query.get('manufacturer');
    const mat = query.get('material');
    if (!m && !mat) return [];
    return data.filter((f) => (!m || eq(f.manufacturer, m)) && (!mat || eq(f.material, mat))).slice(0, 400);
  }
  return null;
}

/** Fastify-Routen unter /catalog (Cache-Header: Handy darf 1 h zwischenspeichern). */
export async function registerCatalog(app) {
  app.get('/catalog/*', async (req, reply) => {
    const url = new URL(req.url, 'http://x');
    try {
      const body = await catalogResponse(url.pathname.replace(/^\/catalog/, ''), url.searchParams);
      if (body === null) return reply.code(404).send({ detail: 'Not found' });
      return reply.header('cache-control', 'public, max-age=3600').send(body);
    } catch (e) {
      return reply.code(502).send({ detail: `Filament-Katalog nicht erreichbar: ${e.message}` });
    }
  });
}

/** Connect-Middleware für den Vite-Dev-Server. */
export function catalogMiddleware() {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/catalog/')) return next();
    const url = new URL(req.url, 'http://x');
    try {
      const body = await catalogResponse(url.pathname.replace(/^\/catalog/, ''), url.searchParams);
      res.statusCode = body === null ? 404 : 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(body ?? { detail: 'Not found' }));
    } catch (e) {
      res.statusCode = 502;
      res.end(JSON.stringify({ detail: e.message }));
    }
  };
}
