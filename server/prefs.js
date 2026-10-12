// Gemeinsame Einstellungen der App (gelten für alle Geräte), z. B. Trocknungswerte je Materialfamilie.
// Datei im Datenordner (Unraid appdata/buddy-shelf/prefs.json); nur bekannte Bereiche, begrenzte Größe.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const FILE = process.env.BUDDY_SHELF_PREFS_FILE || join(process.env.BUDDY_SHELF_DATA_DIR || join(process.cwd(), 'data'), 'prefs.json');
const NAMES = ['drying', 'display', 'locations'];
const MAX_BYTES = 64 * 1024;

let chain = Promise.resolve();
const serial = (fn) => (chain = chain.then(fn, fn));

async function readAll(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}

const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

export function prefsStore(file = FILE) {
  return {
    get: async (name) => (await readAll(file))[name] ?? null,
    put: (name, value) =>
      serial(async () => {
        if (!NAMES.includes(name)) throw bad(`Unbekannter Bereich: ${name}`);
        if (value === null) {
          // null = zurück auf Standard
        } else if (typeof value !== 'object' || Array.isArray(value)) throw bad('Objekt erwartet');
        if (JSON.stringify(value).length > MAX_BYTES) throw bad('Zu groß');
        const all = await readAll(file);
        if (value === null) delete all[name];
        else all[name] = value;
        await mkdir(dirname(file), { recursive: true });
        await writeFile(`${file}.tmp`, JSON.stringify(all, null, 2));
        await rename(`${file}.tmp`, file);
        return all[name] ?? null;
      }),
  };
}

export async function handlePrefs(store, method, path, body) {
  const m = /^\/([a-z]+)$/.exec(path);
  if (!m || !NAMES.includes(m[1])) return { status: 404, body: { detail: 'Not found' } };
  if (method === 'GET') return { status: 200, body: { value: await store.get(m[1]) } };
  if (method === 'PUT') return { status: 200, body: { value: await store.put(m[1], body?.value ?? null) } };
  return { status: 405, body: { detail: 'Method not allowed' } };
}

const fail = (e) => ({ status: e.status ?? 500, body: { detail: e.message } });

export async function registerPrefs(app) {
  const store = prefsStore();
  app.route({
    method: ['GET', 'PUT'],
    url: '/prefs/*',
    bodyLimit: MAX_BYTES,
    handler: async (req, reply) => {
      const path = new URL(req.url, 'http://x').pathname.replace(/^\/prefs/, '');
      const r = await handlePrefs(store, req.method, path, req.body).catch(fail);
      return reply.code(r.status).header('cache-control', 'no-store').send(r.body);
    },
  });
}

/** Connect-Middleware für den Vite-Dev-Server (./data/prefs.json). */
export function prefsMiddleware() {
  const store = prefsStore();
  return async (req, res, next) => {
    if (!req.url?.startsWith('/prefs/')) return next();
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let r;
    try {
      r = await handlePrefs(
        store,
        req.method,
        new URL(req.url, 'http://x').pathname.replace(/^\/prefs/, ''),
        raw ? JSON.parse(raw) : undefined,
      );
    } catch (e) {
      r = fail(e);
    }
    res.statusCode = r.status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(r.body));
  };
}
