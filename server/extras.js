// Zusatzdaten je Spule, die Bambuddy nicht kennt: getrocknet am, Etikett gedruckt am, Kategorie (Refill)
// und Artikelnummer. Ist Bambuddy auf Spoolman umgestellt, landen sie dort als Zusatzfelder (`extra`) –
// sichtbar in Spoolman, mitgesichert, eine Quelle. Ohne Spoolman: kleine Datei im Datenordner.
//
// Spoolman-Regeln (0.27, gegen echte Instanz geprüft): Felder vorher anlegen (POST /field/spool/{key}),
// Werte sind JSON-Text ('"2026-10-11"'), PATCH { extra } führt Schlüssel zusammen, null löscht einen.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const FILE = process.env.BUDDY_SHELF_EXTRAS_FILE || join(process.env.BUDDY_SHELF_DATA_DIR || join(process.cwd(), 'data'), 'spools.json');
const TIMEOUT = 8000;

/** Felder je Spule: Schlüssel → Spoolman-Feld. `article_number` gehört in Spoolman zum Filament. */
export const FIELDS = {
  dried_at: { name: 'Getrocknet am', field_type: 'datetime' },
  label_printed_at: { name: 'Etikett gedruckt am', field_type: 'datetime' },
  category: { name: 'Kategorie (z. B. Refill)', field_type: 'text' },
};
const KEYS = [...Object.keys(FIELDS), 'article_number'];
const DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

/** Nur bekannte Felder, Datum im ISO-Format, null = löschen. */
export function cleanPatch(body) {
  const out = {};
  for (const [k, v] of Object.entries(body ?? {})) {
    if (!KEYS.includes(k)) throw badRequest(`Unbekanntes Feld: ${k}`);
    if (v === null) out[k] = null;
    else if (typeof v !== 'string' || v.length > 64) throw badRequest(`${k}: Text bis 64 Zeichen erwartet`);
    else if (k.endsWith('_at') && !DATE.test(v)) throw badRequest(`${k}: Datum als JJJJ-MM-TT erwartet`);
    else out[k] = v.trim();
  }
  if (!Object.keys(out).length) throw badRequest('Keine Änderung');
  return out;
}

const badRequest = (msg) => Object.assign(new Error(msg), { status: 400 });

// ---------- Datei (ohne Spoolman)

let chain = Promise.resolve();
/** Schreibzugriffe nacheinander, damit sich zwei Änderungen nicht überschreiben. */
const serial = (fn) => (chain = chain.then(fn, fn));

async function readFileStore(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}

export function fileBackend(file = FILE) {
  return {
    kind: 'file',
    list: () => readFileStore(file),
    patch: (ids, patch) =>
      serial(async () => {
        const all = await readFileStore(file);
        for (const id of ids) {
          const cur = { ...all[id] };
          // Kategorie und Artikelnummer hat Bambuddy ohne Spoolman selbst
          for (const k of ['dried_at', 'label_printed_at']) {
            if (!(k in patch)) continue;
            if (patch[k] === null) delete cur[k];
            else cur[k] = patch[k];
          }
          if (Object.keys(cur).length) all[id] = cur;
          else delete all[id];
        }
        await mkdir(dirname(file), { recursive: true });
        const tmp = `${file}.tmp`;
        await writeFile(tmp, JSON.stringify(all, null, 2));
        await rename(tmp, file);
        return ids.length;
      }),
  };
}

// ---------- Spoolman

export function spoolmanBackend(base) {
  const api = `${base.replace(/\/+$/, '')}/api/v1`;
  const call = async (method, path, body) => {
    const res = await fetch(`${api}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = await res.json().catch(() => undefined);
    if (!res.ok) throw Object.assign(new Error(`Spoolman ${method} ${path}: ${data?.message ?? data?.detail ?? res.status}`), { status: 502 });
    return data;
  };
  let fieldsReady = null;
  const ensureFields = () =>
    (fieldsReady ??= (async () => {
      const have = new Set((await call('GET', '/field/spool')).map((f) => f.key));
      for (const [key, def] of Object.entries(FIELDS)) if (!have.has(key)) await call('POST', `/field/spool/${key}`, def);
    })().catch((e) => {
      fieldsReady = null; // beim nächsten Mal erneut versuchen
      throw e;
    }));
  const decode = (raw) => {
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  return {
    kind: 'spoolman',
    list: async () => {
      const out = {};
      for (const s of await call('GET', '/spool?allow_archived=true')) {
        const e = {};
        for (const k of Object.keys(FIELDS)) {
          const v = decode(s.extra?.[k]);
          if (typeof v === 'string' && v) e[k] = v;
        }
        if (Object.keys(e).length) out[s.id] = e;
      }
      return out;
    },
    patch: async (ids, patch) => {
      const { article_number, ...rest } = patch;
      const extra = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v === null ? null : JSON.stringify(v)]));
      if (Object.keys(extra).length) await ensureFields();
      for (const id of ids) {
        if (Object.keys(extra).length) await call('PATCH', `/spool/${id}`, { extra });
        if (article_number !== undefined) {
          // Artikelnummer beschreibt das Produkt → am Filament der Spule
          const s = await call('GET', `/spool/${id}`);
          await call('PATCH', `/filament/${s.filament.id}`, { article_number: article_number ?? '' });
        }
      }
      return ids.length;
    },
  };
}

// ---------- Auswahl: Spoolman genau dann, wenn Bambuddy auf Spoolman steht (sonst passen die IDs nicht)

/**
 * Bambuddy meldet Spoolman oft als „localhost:7912“ – das gilt nur in Bambuddys Container. Dann den Rechner
 * nehmen, auf dem Bambuddy läuft (Spoolman läuft im Normalfall daneben).
 */
export function reachableFromHere(spoolmanUrl, bambuddyUrl) {
  if (!spoolmanUrl) return spoolmanUrl;
  try {
    const sm = new URL(spoolmanUrl);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(sm.hostname.toLowerCase()) || !bambuddyUrl) return sm.toString().replace(/\/+$/, '');
    sm.hostname = new URL(bambuddyUrl).hostname;
    return sm.toString().replace(/\/+$/, '');
  } catch {
    return spoolmanUrl;
  }
}

/**
 * @param {{ bambuddyUrl?: string, apiKey?: string, spoolmanUrl?: string, file?: string }} opts
 *   ohne bambuddyUrl (Vite-Dev) immer Datei.
 */
export function createBackendResolver(opts = {}) {
  let cached = { at: 0, backend: /** @type {any} */ (null) };
  const file = fileBackend(opts.file);
  return async () => {
    if (!opts.bambuddyUrl) return file;
    if (cached.backend && Date.now() - cached.at < 60_000) return cached.backend;
    const res = await fetch(`${opts.bambuddyUrl.replace(/\/+$/, '')}/api/v1/spoolman/status`, {
      headers: opts.apiKey ? { 'x-api-key': opts.apiKey } : undefined,
      signal: AbortSignal.timeout(TIMEOUT),
    }).catch(() => null);
    const status = res?.ok ? await res.json().catch(() => null) : null;
    if (!status) {
      // Bambuddy nicht erreichbar: lieber den letzten Stand als raten
      if (cached.backend) return cached.backend;
      throw Object.assign(new Error('Bambuddy nicht erreichbar – Speicherort der Zusatzdaten unklar'), { status: 503 });
    }
    const url = opts.spoolmanUrl || reachableFromHere(status.url, opts.bambuddyUrl);
    const backend = status.enabled && url ? spoolmanBackend(url) : file;
    // Gleiche Instanz behalten, damit „Felder angelegt“ gemerkt bleibt
    if (!(cached.backend?.kind === backend.kind && cached.url === url)) cached = { at: 0, backend, url };
    cached.at = Date.now();
    return cached.backend;
  };
}

/** Antwort für Methode + Pfad unter /extras. */
export async function handleExtras(resolve, method, path, body) {
  if (path === '/spools' && method === 'GET') {
    const b = await resolve();
    return { status: 200, body: { backend: b.kind, spools: await b.list() } };
  }
  const one = /^\/spools\/(\d+)$/.exec(path);
  if (one && method === 'PATCH') {
    const b = await resolve();
    await b.patch([Number(one[1])], cleanPatch(body));
    return { status: 200, body: { updated: 1, backend: b.kind } };
  }
  if (path === '/spools/bulk' && method === 'POST') {
    const ids = body?.ids;
    if (!Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every((x) => Number.isInteger(x) && x > 0)) {
      throw badRequest('ids: 1–500 Spulen-Nummern erwartet');
    }
    const b = await resolve();
    return { status: 200, body: { updated: await b.patch(ids, cleanPatch(body.patch)), backend: b.kind } };
  }
  return { status: 404, body: { detail: 'Not found' } };
}

const fail = (e) => ({ status: e.status ?? 500, body: { detail: e.message } });

export async function registerExtras(app, opts) {
  const resolve = createBackendResolver(opts);
  app.route({
    method: ['GET', 'PATCH', 'POST'],
    url: '/extras/*',
    handler: async (req, reply) => {
      const path = new URL(req.url, 'http://x').pathname.replace(/^\/extras/, '');
      const r = await handleExtras(resolve, req.method, path, req.body).catch(fail);
      return reply.code(r.status).header('cache-control', 'no-store').send(r.body);
    },
  });
}

/** Connect-Middleware für den Vite-Dev-Server (immer Datei unter ./data). */
export function extrasMiddleware() {
  const resolve = createBackendResolver();
  return async (req, res, next) => {
    if (!req.url?.startsWith('/extras/')) return next();
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let r;
    try {
      r = await handleExtras(resolve, req.method, new URL(req.url, 'http://x').pathname.replace(/^\/extras/, ''), raw ? JSON.parse(raw) : undefined);
    } catch (e) {
      r = fail(e);
    }
    res.statusCode = r.status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(r.body));
  };
}
