// Admin-API für das Selbst-Update auf Unraid – übernommen aus SeestarManager
// (src/server/admin-api.ts, self-recreate), gleicher Ablauf, gleiche Absicherungen.
//
//   GET  /api/admin/info                          Anmeldung prüfen, laufende Version
//   POST /api/admin/self-recreate?tag=latest      neues Image ziehen und Container ersetzen
//        &digest=sha256:…  &dryRun=1
//
// Aktiv nur mit BUDDY_SHELF_ADMIN_TOKEN. Braucht /var/run/docker.sock im Container.
// Ablauf: Image ziehen → eigenen Container per docker inspect klonen → abgekoppelter
// Helfer-Container (curl) ersetzt ihn nach ~2 s. Der Helfer prüft vorher, dass das neue
// Image da ist; sonst bleibt der alte Container unangetastet.
import { request as httpRequest } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';

const IMAGE_REF = 'ghcr.io/truri83/buddy-shelf:latest';
const HELPER_NAME = 'buddy-shelf-recreate-helper';

/** Konstant-Zeit-Vergleich (gegen Timing-Angriffe auf den Token). */
function safeEqual(a, b) {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** HTTP-Aufruf gegen den Docker-Socket. */
function dockerCall({ method = 'GET', path, body }) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        socketPath: '/var/run/docker.sock',
        method,
        path,
        headers: body ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body, 'utf8')) } : undefined,
        timeout: 60000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('docker-socket timeout')));
    if (body) req.write(body);
    req.end();
  });
}

/** Eigenen Container finden: BUDDY_SHELF_SELF_CONTAINER, sonst HOSTNAME (= Container-ID). */
async function resolveSelfContainer() {
  const candidates = [process.env.BUDDY_SHELF_SELF_CONTAINER, process.env.HOSTNAME].map((c) => (c ?? '').trim()).filter(Boolean);
  for (const cand of candidates) {
    const r = await dockerCall({ path: `/containers/${encodeURIComponent(cand)}/json` });
    if (r.status === 200) {
      try {
        const inspect = JSON.parse(r.body);
        if (inspect?.Id) return { ok: true, inspect };
      } catch {
        /* nächster Kandidat */
      }
    }
  }
  return { ok: false, reason: `Eigener Container nicht auffindbar (probiert: ${candidates.join(', ') || '–'}). BUDDY_SHELF_SELF_CONTAINER setzen.` };
}

/** Pinnt einen Image-Ref auf ein Digest. */
function applyImageDigest(imageRef, digest) {
  const d = /^sha256:/.test(digest) ? digest : `sha256:${digest}`;
  const slash = imageRef.lastIndexOf('/');
  const last = imageRef.slice(slash + 1);
  const at = last.indexOf('@');
  const colon = last.lastIndexOf(':');
  const cut = at >= 0 ? at : colon;
  return `${cut >= 0 ? imageRef.slice(0, slash + 1 + cut) : imageRef}@${d}`;
}

// Was das Image selbst setzt, darf nicht vom alten Container in den neuen wandern
// (Seestar-Lehre „buildSha lügt“).
const IMAGE_OWNED_ENV = ['PATH', 'NODE_VERSION', 'YARN_VERSION', 'NODE_ENV', 'BUILD_SHA', 'BUILD_AT'];

/** Create-Payload aus dem eigenen docker inspect; ersetzt nur das Image. */
function buildCreatePayload(inspect, newImage) {
  const cfg = inspect.Config ?? {};
  const host = inspect.HostConfig ?? {};
  const payload = {
    Image: newImage,
    Env: (cfg.Env ?? []).filter((e) => !IMAGE_OWNED_ENV.includes(e.split('=', 1)[0])),
    Labels: cfg.Labels ?? {},
    ExposedPorts: cfg.ExposedPorts ?? {},
    HostConfig: {
      Binds: host.Binds ?? [],
      Mounts: host.Mounts ?? [],
      PortBindings: host.PortBindings ?? {},
      RestartPolicy: host.RestartPolicy ?? { Name: 'no' },
      NetworkMode: host.NetworkMode ?? 'default',
      Privileged: host.Privileged ?? false,
      CapAdd: host.CapAdd ?? [],
      Devices: host.Devices ?? [],
      ExtraHosts: host.ExtraHosts ?? [],
      Dns: host.Dns ?? [],
    },
  };
  // Netzwerk-Aliase und feste IP erhalten (Unraid br0/custom networks).
  const nets = inspect.NetworkSettings?.Networks;
  if (nets && Object.keys(nets).length > 0) {
    const endpointsConfig = {};
    for (const [name, net] of Object.entries(nets)) {
      const ep = {};
      if (net.Aliases?.length) ep.Aliases = net.Aliases;
      if (net.IPAMConfig) ep.IPAMConfig = net.IPAMConfig;
      endpointsConfig[name] = ep;
    }
    payload.NetworkingConfig = { EndpointsConfig: endpointsConfig };
  }
  return payload;
}

/** Schwärzt alle Env-Werte (Trockenlauf darf keine Geheimnisse zeigen). */
function withRedactedEnv(payload) {
  return { ...payload, Env: (payload.Env ?? []).map((e) => (e.includes('=') ? `${e.split('=', 1)[0]}=<geschwaerzt>` : e)) };
}

/** Skript für den Helfer: Image prüfen → stoppen → löschen → neu anlegen → starten → Netze → aufräumen. */
function buildHelperScript(selfId, selfName, createPayloadJson, networks, newImage) {
  const b64 = Buffer.from(createPayloadJson, 'utf8').toString('base64');
  const name = selfName.replace(/^\//, '');
  const S = 'curl -s --unix-socket /var/run/docker.sock';
  const H = 'http://localhost';
  const slash = newImage.lastIndexOf('/');
  const at = newImage.indexOf('@');
  const colon = newImage.indexOf(':', slash + 1);
  const cut = at > -1 ? at : colon;
  const repo = cut > -1 ? newImage.slice(0, cut) : newImage;
  const tag = cut > -1 ? newImage.slice(cut + 1) : 'latest';
  const steps = [
    'set -e',
    'sleep 2',
    `echo "${b64}" | base64 -d > /tmp/create.json`,
    `echo "pull ${newImage}"`,
    `${S} -X POST "${H}/images/create?fromImage=${repo}&tag=${encodeURIComponent(tag)}" > /tmp/pull.log 2>&1 || true`,
    // Absicherung: alter Container wird nur angefasst, wenn das neue Image wirklich da ist.
    `if ! ${S} "${H}/images/${newImage}/json" | grep -q '"Id"'; then echo "ABBRUCH: Image ${newImage} fehlt – alter Container bleibt."; exit 1; fi`,
    `${S} -X POST "${H}/containers/${selfId}/stop?t=10" || true`,
    `${S} -X DELETE "${H}/containers/${selfId}?force=1" || true`,
    `NEWID=$(${S} -X POST -H "Content-Type: application/json" --data @/tmp/create.json "${H}/containers/create?name=${name}" | sed -n 's/.*"Id":"\\([a-f0-9]*\\)".*/\\1/p')`,
    'echo "created: $NEWID"',
    `${S} -X POST "${H}/containers/$NEWID/start" || true`,
    'echo "started: $NEWID"',
  ];
  // create hängt nur das primäre Netz an → weitere Netze danach verbinden.
  for (const net of networks.filter((n) => n !== 'host' && n !== 'none')) {
    steps.push(`${S} -X POST -H "Content-Type: application/json" -d "{\\"Container\\":\\"$NEWID\\"}" "${H}/networks/${net}/connect" || true`);
  }
  // Verwaiste Layer der alten Version entfernen.
  steps.push(`${S} -X POST "${H}/images/prune" || true`);
  return steps.join('\n');
}

/** @param {import('fastify').FastifyInstance} app */
export async function registerAdmin(app, { version = null } = {}) {
  const token = (process.env.BUDDY_SHELF_ADMIN_TOKEN ?? '').trim();
  if (!token) {
    app.log.info('Admin-API aus (BUDDY_SHELF_ADMIN_TOKEN nicht gesetzt)');
    return;
  }
  if (token.length < 24) app.log.warn('BUDDY_SHELF_ADMIN_TOKEN ist kurz – bitte stark wählen');

  await app.register(async (admin) => {
    // Body wird nie gebraucht – jeder oder kein Content-Type ist ok (sonst 415, Seestar-Lehre).
    admin.removeAllContentTypeParsers();
    admin.addContentTypeParser('*', (_req, payload, done) => {
      payload.resume();
      done(null, undefined);
    });
    admin.addHook('onRequest', async (req, reply) => {
      if (!safeEqual(req.headers.authorization ?? '', `Bearer ${token}`)) {
        return reply.code(401).send({ error: 'admin auth required' });
      }
    });

    admin.get('/info', async () => ({
      adminApiEnabled: true,
      imageRef: IMAGE_REF,
      version,
      sha: process.env.BUILD_SHA || null,
      builtAt: process.env.BUILD_AT || null,
      hostname: process.env.HOSTNAME ?? null,
      uptime: process.uptime(),
    }));

    admin.post('/self-recreate', async (req, reply) => {
      const q = req.query ?? {};
      const dryRun = q.dryRun === '1' || q.dryRun === 'true';
      const base = IMAGE_REF.replace(/:[^/]+$/, '');
      const newImage = q.digest ? applyImageDigest(base, q.digest) : `${base}:${q.tag ?? 'latest'}`;
      if (!/^[a-z0-9][a-z0-9._\-/:@]*$/.test(newImage)) return reply.code(400).send({ error: 'ungültiges Tag/Digest' });
      const helperImage = (process.env.BUDDY_SHELF_RECREATE_HELPER_IMAGE ?? 'curlimages/curl:8.16.0').trim();

      try {
        const self = await resolveSelfContainer();
        if (!self.ok) return reply.code(409).send({ error: 'Recreate abgebrochen', detail: self.reason });
        const inspect = self.inspect;

        // Lieber nichts tun als Daten verlieren: Laufzeit-Mounts ohne Binds/Mounts in der Config.
        const runtimeMounts = inspect.Mounts ?? [];
        if (runtimeMounts.length > 0 && !(inspect.HostConfig?.Binds?.length || inspect.HostConfig?.Mounts?.length)) {
          return reply.code(409).send({ error: 'Mounts nicht klonbar – Recreate abgebrochen' });
        }

        const payload = buildCreatePayload(inspect, newImage);
        const summary = {
          container: inspect.Name.replace(/^\//, ''),
          oldImage: inspect.Config?.Image ?? null,
          newImage,
          binds: inspect.HostConfig?.Binds ?? [],
          portBindings: inspect.HostConfig?.PortBindings ?? {},
          networks: Object.keys(inspect.NetworkSettings?.Networks ?? {}),
        };
        if (dryRun) return { dryRun: true, wouldRecreate: true, helperImage, summary, createPayload: withRedactedEnv(payload) };

        const pull = await dockerCall({ method: 'POST', path: `/images/create?fromImage=${encodeURIComponent(helperImage)}` });
        if (pull.status !== 200) return reply.code(502).send({ error: 'Helfer-Image nicht ladbar – nichts verändert', helperImage });

        const script = buildHelperScript(inspect.Id, inspect.Name, JSON.stringify(payload), summary.networks, newImage);
        await dockerCall({ method: 'DELETE', path: `/containers/${HELPER_NAME}?force=1` }).catch(() => undefined);
        const created = await dockerCall({
          method: 'POST',
          path: `/containers/create?name=${HELPER_NAME}`,
          body: JSON.stringify({
            Image: helperImage,
            Entrypoint: ['/bin/sh', '-c'],
            Cmd: [script],
            User: '0:0',
            HostConfig: { Binds: ['/var/run/docker.sock:/var/run/docker.sock'], AutoRemove: true, NetworkMode: 'bridge' },
          }),
        });
        if (created.status !== 201) return reply.code(502).send({ error: 'Helfer nicht erstellbar – nichts verändert', detail: created.body.slice(0, 300) });
        const helperId = JSON.parse(created.body).Id;
        const started = await dockerCall({ method: 'POST', path: `/containers/${helperId}/start` });
        if (started.status !== 204) {
          await dockerCall({ method: 'DELETE', path: `/containers/${helperId}?force=1` }).catch(() => undefined);
          return reply.code(502).send({ error: 'Helfer-Start fehlgeschlagen – nichts verändert' });
        }
        return { recreating: true, hint: 'Container wird in ~2 s ersetzt; /healthz zeigt danach die neue sha.', summary };
      } catch (e) {
        return reply.code(503).send({ error: 'docker-socket nicht erreichbar', detail: e.message });
      }
    });
  }, { prefix: '/api/admin' });
}
