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

/** Häufigstes Leerspulen-Gewicht je Hersteller + Spulenart. */
function spoolWeights(data) {
  const counts = new Map();
  for (const f of data) {
    if (!f.spool_weight) continue;
    const key = `${f.manufacturer}|${f.spool_type ?? ''}`;
    const m = counts.get(key) ?? new Map();
    m.set(f.spool_weight, (m.get(f.spool_weight) ?? 0) + 1);
    counts.set(key, m);
  }
  return [...counts.entries()]
    .map(([key, m]) => {
      const [manufacturer, type] = key.split('|');
      const [weight, count] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
      return { manufacturer, spool_type: type || null, weight, count };
    })
    .sort((a, b) => a.manufacturer.localeCompare(b.manufacturer, 'de'));
}

// ---------- Packungs-Barcodes: Open Filament Database (MIT) ----------
// Barcode-Index (~5 600 GTIN, ~3,5 MB) einmal am Tag; Varianten (Farbe, Refill, Artikelnummer) bei Bedarf.
const OFD = process.env.OFD_API_URL || 'https://api.openfilamentdatabase.org/api/v1';
let gtinCache = { at: 0, codes: /** @type {Record<string, any[]> | null} */ (null), loading: /** @type {Promise<any> | null} */ (null) };
const variantCache = new Map();

const FAIL_MS = 5 * 60_000;
let gtinFailedAt = 0;

/** Index laden; ist er älter als 24 h, im Hintergrund erneuern und solange den alten liefern. */
async function loadGtinIndex() {
  const fresh = gtinCache.codes && Date.now() - gtinCache.at < TTL_MS;
  if (fresh) return gtinCache.codes;
  if (!gtinCache.loading && Date.now() - gtinFailedAt > FAIL_MS) {
    gtinCache.loading = (async () => {
      try {
        const res = await fetch(`${OFD}/gtin-index.json`, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error(`Open Filament Database HTTP ${res.status}`);
        const j = await res.json();
        gtinCache = { at: Date.now(), codes: j.codes ?? {}, loading: null };
        return gtinCache.codes;
      } catch (e) {
        gtinFailedAt = Date.now(); // Ausfall 5 min merken – sonst wartet jeder Scan erneut
        gtinCache.loading = null;
        throw e;
      }
    })();
  }
  if (gtinCache.codes) return gtinCache.codes; // alter Index, während der neue lädt
  if (gtinCache.loading) return gtinCache.loading;
  throw new Error('Open Filament Database gerade nicht erreichbar');
}

async function loadVariant(href) {
  const hit = variantCache.get(href);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const res = await fetch(`${OFD}/${href}`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return null;
  const data = await res.json();
  if (variantCache.size > 2000) variantCache.delete(variantCache.keys().next().value);
  variantCache.set(href, { at: Date.now(), data });
  return data;
}

/** EAN-8/13, UPC-A, GTIN-14 → 14-stellig (wie der Index). */
export function normalizeGtin(code) {
  const d = String(code ?? '').replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(d.length)) return null;
  return d.padStart(14, '0');
}

async function gtinLookup(code) {
  const key = normalizeGtin(code);
  if (!key) return [];
  const codes = await loadGtinIndex();
  const entries = codes[key] ?? [];
  // Varianten parallel; fehlt eine, ist das Ergebnis unvollständig (partial) und wird nicht zwischengespeichert
  const variants = await Promise.all(entries.map((e) => loadVariant(e.href).catch(() => null)));
  const out = [];
  for (const [i, e] of entries.entries()) {
    const v = variants[i];
    const size = v?.sizes?.find((s) => s.uuid === e.size_uuid) ?? null;
    out.push({
      gtin: key,
      brand: e.brand_name,
      material: e.material_slug,
      filament: e.filament_name,
      color: e.variant_name,
      color_hex: normHex(v?.color_hex ?? null),
      weight: e.filament_weight ?? size?.filament_weight ?? null,
      spool_weight: size?.empty_spool_weight ?? null,
      refill: !!size?.spool_refill,
      article_number: size?.article_number ?? null,
      partial: !v,
    });
  }
  return out;
}

const uniqSorted = (list) => [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
const eq = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();

/** Antwort für einen Katalog-Pfad (ohne /catalog-Präfix). */
export async function catalogResponse(path, query) {
  const gtin = /^\/gtin\/([0-9]{8,14})$/.exec(path);
  if (gtin) return gtinLookup(gtin[1]);
  const data = await load();
  if (path === '/manufacturers') return uniqSorted(data.map((f) => f.manufacturer));
  if (path === '/materials') {
    const m = query.get('manufacturer');
    return uniqSorted(data.filter((f) => !m || eq(f.manufacturer, m)).map((f) => f.material));
  }
  if (path === '/spools') return spoolWeights(data);
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
      // unvollständige Barcode-Treffer (Variante nicht geladen) nicht zwischenspeichern
      const partial = Array.isArray(body) && body.some((x) => x?.partial);
      return reply.header('cache-control', partial ? 'no-store' : 'public, max-age=3600').send(body);
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
