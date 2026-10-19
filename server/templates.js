// Eigene Etikett-Vorlagen (NiimBlue-JSON) als Dateien im Datenordner – auf Unraid
// appdata/buddy-shelf/templates. Überleben Updates und gelten für alle Geräte gleich.
// Eingebaute Vorlagen liefert die App selbst mit (templates/*.json im Repo).
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = process.env.BUDDY_SHELF_TEMPLATES_DIR || join(process.cwd(), 'data', 'templates');
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_BYTES = 2 * 1024 * 1024;

/** Nur was eine Vorlage braucht; Vorschaubild u. Ä. aus NiimBlue-Exporten fällt weg. */
export function cleanTemplate(id, t) {
  const size = t?.label?.size;
  if (!t?.canvas || !Array.isArray(t.canvas.objects) || !(size?.width > 0) || !(size?.height > 0)) {
    throw new Error('Keine gültige Etiketten-Vorlage (NiimBlue-Export erwartet).');
  }
  return {
    id,
    title: String(t.title ?? id).slice(0, 60),
    ...(['spool', 'slot', 'location', 'dried'].includes(t.kind) ? { kind: t.kind } : {}),
    label: { printDirection: t.label.printDirection === 'left' ? 'left' : 'top', size: { width: size.width, height: size.height } },
    canvas: { version: String(t.canvas.version ?? '7.0.0'), objects: t.canvas.objects },
  };
}

export async function listTemplates(dir = DIR) {
  let names;
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith('.json')).sort();
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  const out = [];
  for (const n of names) {
    try {
      out.push(JSON.parse(await readFile(join(dir, n), 'utf8')));
    } catch {
      // kaputte Datei überspringen statt die ganze Liste zu verlieren
    }
  }
  return out;
}

export async function saveTemplate(id, body, dir = DIR) {
  if (!ID.test(id)) throw Object.assign(new Error('Ungültige Vorlagen-ID'), { status: 400 });
  const tpl = cleanTemplate(id, body);
  await mkdir(dir, { recursive: true });
  // erst temporär schreiben, dann umbenennen: nie halbe Dateien
  const tmp = join(dir, `.${id}.tmp`);
  await writeFile(tmp, JSON.stringify(tpl, null, 2));
  await rename(tmp, join(dir, `${id}.json`));
  return tpl;
}

export async function deleteTemplate(id, dir = DIR) {
  if (!ID.test(id)) throw Object.assign(new Error('Ungültige Vorlagen-ID'), { status: 400 });
  await rm(join(dir, `${id}.json`), { force: true });
}

/** Antwort für Methode + Pfad unter /labels (gemeinsam für Fastify und Vite-Dev-Server). */
async function handle(method, path, body) {
  if (path === '/templates' && method === 'GET') return { status: 200, body: await listTemplates() };
  const m = /^\/templates\/([^/]+)$/.exec(path);
  if (m && method === 'PUT') return { status: 200, body: await saveTemplate(decodeURIComponent(m[1]), body) };
  if (m && method === 'DELETE') return (await deleteTemplate(decodeURIComponent(m[1])), { status: 204 });
  return { status: 404, body: { detail: 'Not found' } };
}

const fail = (e) => ({
  status: e.status ?? (e instanceof SyntaxError || /Vorlage/.test(e.message) ? 400 : 500),
  body: { detail: e.message },
});

export async function registerTemplates(app) {
  app.route({
    method: ['GET', 'PUT', 'DELETE'],
    url: '/labels/*',
    bodyLimit: MAX_BYTES,
    handler: async (req, reply) => {
      const path = new URL(req.url, 'http://x').pathname.replace(/^\/labels/, '');
      const r = await handle(req.method, path, req.body).catch(fail);
      reply.code(r.status).header('cache-control', 'no-store');
      return r.status === 204 ? reply.send() : reply.send(r.body);
    },
  });
}

/** Connect-Middleware für den Vite-Dev-Server. */
export function templatesMiddleware() {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/labels/')) return next();
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let r;
    try {
      r = await handle(req.method, new URL(req.url, 'http://x').pathname.replace(/^\/labels/, ''), raw ? JSON.parse(raw) : undefined);
    } catch (e) {
      r = fail(e);
    }
    res.statusCode = r.status;
    if (r.status === 204) return res.end();
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(r.body));
  };
}
