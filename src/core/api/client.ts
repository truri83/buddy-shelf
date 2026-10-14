import { t } from '@/core/i18n';
import { storage } from '@/core/platform';
import type {
  CatalogEntry,
  ColorEntry,
  DbSpoolWeight,
  GtinHit,
  FilamentEntry,
  Location,
  LocationCreate,
  Me,
  Printer,
  PrinterStatus,
  Spool,
  SpoolAssignment,
  SpoolAssignmentCreate,
  SpoolCreate,
  SpoolUpdate,
} from './types';

/**
 * Einziger Zugang zu Bambuddy (Regel 3). Module rufen nur diese Funktionen bzw.
 * die Query-Hooks ihres Moduls auf, nie fetch direkt.
 *
 * Basis-URL: leer = gleicher Ursprung (Dev-Proxy bzw. server/index.js leitet /api weiter).
 * Auth: X-API-Key (Bambuddy akzeptiert auch "Authorization: Bearer bb_…").
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiConfig {
  baseUrl: string;
  apiKey: string | null;
}

let config: ApiConfig = { baseUrl: '', apiKey: null };

export function configureApi(next: Partial<ApiConfig>): void {
  config = { ...config, ...next };
}

export function getApiConfig(): Readonly<ApiConfig> {
  return config;
}

/** Filament-Datenbank (SpoolmanDB) über unseren eigenen Server – gleicher Ursprung, ohne Schlüssel. */
async function catalogRequest<T>(path: string): Promise<T> {
  const res = await fetch(`/catalog${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new ApiError(res.status, `GET /catalog${path} → ${res.status}`);
  return (await res.json()) as T;
}

/** Eigene Etikett-Vorlagen auf unserem Server (gleicher Ursprung, ohne Schlüssel). */
async function labelsRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/labels${path}`, {
    method,
    headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data: unknown = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(res.status, describeError(res.status, data) ?? `${method} /labels${path} → ${res.status}`, data);
  return data as T;
}

/** Bereiche der gemeinsamen Einstellungen (server/prefs.js NAMES). */
export type PrefsName = 'drying' | 'display' | 'locations' | 'lists' | 'app' | 'cores';

/** Gemeinsame App-Einstellungen auf unserem Server (gelten für alle Geräte). */
async function prefsRequest<T>(method: 'GET' | 'PUT', name: string, value?: unknown): Promise<T | null> {
  const res = await fetch(`/prefs/${name}`, {
    method,
    headers: { Accept: 'application/json', ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}) },
    body: method === 'PUT' ? JSON.stringify({ value }) : undefined,
  });
  const data = (await res.json().catch(() => undefined)) as { value?: T | null } | undefined;
  if (!res.ok) throw new ApiError(res.status, describeError(res.status, data) ?? `${method} /prefs/${name} → ${res.status}`, data);
  return data?.value ?? null;
}

/** Bambuddy/FastAPI-Fehler lesbar machen: `{ detail: "…" }` oder Validierungsliste `{ detail: [{ msg, loc }] }`. */
export function describeError(status: number, body: unknown): string | null {
  const d = (body as { detail?: unknown } | undefined)?.detail;
  if (typeof d === 'string' && d.trim()) return d;
  if (Array.isArray(d)) {
    const parts = d
      .map((x: { msg?: string; loc?: unknown[] }) => [x.loc?.slice(1).join('.'), x.msg].filter(Boolean).join(': '))
      .filter(Boolean);
    if (parts.length) return parts.join('; ');
  }
  if (status === 401) return t('error.401');
  if (status === 403) return t('error.403');
  return null;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (config.apiKey) headers['X-API-Key'] = config.apiKey;

  const res = await fetch(`${config.baseUrl}/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text().catch(() => undefined);
    }
    throw new ApiError(res.status, describeError(res.status, detail) ?? `${method} ${path} → ${res.status}`, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------- Datenquelle: Bambuddy selbst oder Spoolman (Einstellung in Bambuddy)

export interface InventorySource {
  /** Bambuddy führt den Bestand in Spoolman (Pfade /spoolman/inventory/…) */
  spoolman: boolean;
  url: string | null;
}

let source: { value: InventorySource; at: number } | null = null;
let sourcePending: Promise<InventorySource> | null = null;

/**
 * Fragt Bambuddy, wo der Bestand liegt (1 Min. zwischengespeichert). Ohne Antwort gilt der zuletzt
 * bekannte Stand – nie raten, sonst landen Änderungen in der falschen Datenbank.
 */
export function inventorySource(force = false): Promise<InventorySource> {
  if (!force && source && Date.now() - source.at < 60_000) return Promise.resolve(source.value);
  sourcePending ??= request<{ enabled: boolean; url: string | null }>('GET', '/spoolman/status')
    .then((st) => {
      const value = { spoolman: !!st.enabled, url: st.url ?? null };
      source = { value, at: Date.now() };
      storage.set('inventorySource', value);
      return value;
    })
    .catch((e: unknown) => {
      const last = source?.value ?? storage.get<InventorySource | null>('inventorySource', null);
      if (last) return last;
      throw e;
    })
    .finally(() => {
      sourcePending = null;
    });
  return sourcePending;
}

/** Nur für Tests: Datenquelle vergessen. */
export function _resetInventorySource() {
  colorNames.clear();
  source = null;
  sourcePending = null;
}

const inv = async () => ((await inventorySource()).spoolman ? '/spoolman/inventory' : '/inventory');

/** Zusatzdaten je Spule (getrocknet, Etikett, bei Spoolman auch Refill/Artikelnummer) über unseren Server. */
export type ExtrasPatch = Partial<Record<'dried_at' | 'label_printed_at' | 'category' | 'article_number' | 'storage_type', string | null>>;
type ExtrasMap = Record<string, Partial<Record<'dried_at' | 'label_printed_at' | 'category' | 'storage_type', string>>>;

async function extrasRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/extras${path}`, {
    method,
    headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data: unknown = await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(res.status, describeError(res.status, data) ?? `${method} /extras${path} → ${res.status}`, data);
  return data as T;
}

/** Zusatzdaten fehlen? Dann ohne sie weiter – die Spulen selbst sind wichtiger. */
const loadExtras = () =>
  extrasRequest<{ spools: ExtrasMap }>('GET', '/spools').then(
    (r) => r.spools,
    () => null,
  );

/** Ohne Zusatzdaten (Server weg) bleiben die Felder undefined = unbekannt, nicht „nie“. */
function withExtras(s: Spool, extras: ExtrasMap | null, spoolman: boolean): Spool {
  if (!extras) return s;
  const e = extras[s.id] ?? {};
  return {
    ...s,
    dried_at: e.dried_at ?? null,
    label_printed_at: e.label_printed_at ?? null,
    storage_type: e.storage_type ?? null,
    // Spoolman kennt keine Kategorie – dort liegt „Refill“ im Zusatzfeld
    ...(spoolman ? { category: e.category ?? null } : {}),
  };
}

/** Bei Spoolman gehen Kategorie und Artikelnummer nicht über Bambuddy, sondern in die Zusatzfelder. */
function splitForSpoolman<T extends { category?: string | null; material_number?: string | null }>(data: T) {
  const { category, material_number, ...rest } = data;
  const extras: ExtrasPatch = {};
  if (category !== undefined) extras.category = category || null;
  if (material_number !== undefined) extras.article_number = material_number || null;
  return { rest, extras };
}

const setExtras = (ids: number[], patch: ExtrasPatch) =>
  Object.keys(patch).length && ids.length
    ? extrasRequest<{ updated: number }>('POST', '/spools/bulk', { ids, patch })
    : Promise.resolve({ updated: 0 });

interface SpoolmanSlot {
  printer_id: number;
  printer_name: string | null;
  ams_id: number;
  tray_id: number;
  spoolman_spool_id: number;
  ams_label: string | null;
}

const fromSpoolmanSlot = (a: SpoolmanSlot, i: number): SpoolAssignment => ({
  id: i + 1,
  spool_id: a.spoolman_spool_id,
  printer_id: a.printer_id,
  printer_name: a.printer_name,
  ams_id: a.ams_id,
  tray_id: a.tray_id,
  ams_label: a.ams_label,
  configured: true,
  pending_config: false,
});

/** Gültiger Chip-Wert: Hex, nicht nur Nullen (wie Bambuddy). */
const hexTag = (v: string | null | undefined, len: number | [number, number]) => {
  const ok = typeof len === 'number' ? v?.length === len : !!v && v.length >= len[0] && v.length <= len[1];
  return ok && /^[0-9a-f]+$/i.test(v!) && /[1-9a-f]/i.test(v!) ? v!.toUpperCase() : null;
};

/** RFID-Übernahme im Spoolman-Modus ohne filaments:update (siehe fromSlot). */
async function adoptFromSlotManually(s: { printer_id: number; ams_id: number; tray_id: number }): Promise<Spool> {
  const st = await request<PrinterStatus>('GET', `/printers/${s.printer_id}/status`);
  const tray =
    s.ams_id === 255
      ? st.vt_tray?.find((x) => x.id === 254 + s.tray_id)
      : st.ams?.find((u) => u.id === s.ams_id)?.tray.find((x) => x.id === s.tray_id);
  const tray_uuid = hexTag(tray?.tray_uuid, 32);
  const tag_uid = hexTag(tray?.tag_uid, [8, 30]);
  if (!tray?.tray_type || (!tray_uuid && !tag_uid)) throw new ApiError(400, t('rfid.noSpool'));
  const material = tray.tray_type;
  const sub = tray.tray_sub_brands ?? '';
  // „PLA Matte“ → „Matte“ (Material vorne weg; ohne Regex, „PLA+“ o. Ä. sind Sonderzeichen)
  const subtype = (sub.toUpperCase().startsWith(material.toUpperCase()) ? sub.slice(material.length) : sub).trim() || null;
  const remain = tray.remain != null && tray.remain >= 0 && tray.remain <= 100 ? tray.remain : 100;
  const created = await request<Spool[] | { created: Spool[] }>('POST', '/spoolman/inventory/spools/bulk', {
    spool: {
      material,
      subtype,
      brand: 'Bambu Lab',
      rgba: tray.tray_color,
      label_weight: 1000,
      weight_used: Math.round(10 * (100 - remain)),
    },
    quantity: 1,
  });
  const spool = (Array.isArray(created) ? created : created.created)[0];
  if (!spool) throw new ApiError(502, t('rfid.noSpool'));
  try {
    await request('PATCH', `/spoolman/inventory/spools/${spool.id}/tag`, tray_uuid ? { tray_uuid } : { tag_uid });
    await bambuddy.assignments.place({ spool_id: spool.id, printer_id: s.printer_id, ams_id: s.ams_id, tray_id: s.tray_id });
  } catch (e) {
    // Spule existiert schon – sagen, welche, statt „fehlgeschlagen“ (erneutes Übernehmen gäbe eine Dublette)
    throw new ApiError(
      e instanceof ApiError ? e.status : 500,
      t('rfid.partial', { id: spool.id, msg: e instanceof Error ? e.message : String(e) }),
    );
  }
  return bambuddy.spools.get(spool.id);
}

/**
 * Bambuddy füllt einen unbekannten Farbnamen mit der Sorte („PETG Basic“ → „Basic“). Das ist keine Farbe: solche
 * Namen gelten als fehlend, der echte kommt aus Bambuddys Farbkatalog (je Farbe + Material einmal je Sitzung).
 */
const colorNames = new Map<string, Promise<string | null>>();
const fakeColorName = (s: Pick<Spool, 'color_name' | 'color_name_is_synthesized' | 'subtype'>) =>
  !!s.color_name && (!!s.color_name_is_synthesized || s.color_name.trim().toLowerCase() === s.subtype?.trim().toLowerCase());

function lookupColorName(hex: string, material: string): Promise<string | null> {
  const key = `${hex}|${material}`;
  let p = colorNames.get(key);
  if (!p) {
    const q = new URLSearchParams({ hex, material });
    p = request<{ color_name?: string | null }>('GET', `/inventory/colors/by-material?${q}`)
      .then((r) => r.color_name?.trim() || null)
      .catch(() => (colorNames.delete(key), null));
    colorNames.set(key, p);
  }
  return p;
}

async function withRealColorNames<S extends Spool>(list: S[]): Promise<S[]> {
  return Promise.all(
    list.map(async (s) => {
      if (!fakeColorName(s)) return s;
      const hex = s.rgba && /^[0-9a-f]{6}/i.test(s.rgba) ? s.rgba.slice(0, 6).toUpperCase() : null;
      const material = [s.material, s.subtype].filter(Boolean).join(' ');
      return { ...s, color_name: hex ? await lookupColorName(hex, material) : null };
    }),
  );
}

const listSpoolmanSlots = () => request<SpoolmanSlot[]>('GET', '/spoolman/inventory/slot-assignments/all');

export const bambuddy = {
  spools: {
    list: async () => {
      const src = await inventorySource();
      const [list, extras] = await Promise.all([request<Spool[]>('GET', `${await inv()}/spools`), loadExtras()]);
      return withRealColorNames(list.map((s) => withExtras(s, extras, src.spoolman)));
    },
    get: async (id: number): Promise<Spool> => {
      const src = await inventorySource();
      const [spool, extras] = await Promise.all([request<Spool>('GET', `${await inv()}/spools/${id}`), loadExtras()]);
      return (await withRealColorNames([withExtras(spool, extras, src.spoolman)]))[0]!;
    },
    /** Dublettenprüfung per NFC: tag_uid und/oder tray_uuid (Bambu-RFID). */
    byTag: (q: { tagUid?: string; trayUuid?: string }) => {
      const p = new URLSearchParams();
      if (q.tagUid) p.set('tag_uid', q.tagUid);
      if (q.trayUuid) p.set('tray_uuid', q.trayUuid);
      return request<Spool>('GET', `/inventory/spools/by-tag?${p}`);
    },
    update: async (id: number, patch: SpoolUpdate): Promise<Spool> => {
      if (!(await inventorySource()).spoolman) return request<Spool>('PATCH', `/inventory/spools/${id}`, patch);
      const { rest, extras } = splitForSpoolman(patch);
      if (Object.keys(rest).length) await request<Spool>('PATCH', `/spoolman/inventory/spools/${id}`, rest);
      await setExtras([id], extras);
      return bambuddy.spools.get(id);
    },
    /** Mehrere gleiche Spulen in einem Schritt (quantity 1–50 bei Spoolman, 1–100 sonst). */
    /**
     * Anlegen. Was angelegt wurde, kommt IMMER zurück – auch wenn danach etwas scheitert (Zusatzdaten, Teilerfolg).
     * Sonst sähe es nach Fehlschlag aus, man speichert erneut und hat Dubletten. `incomplete` sagt, was fehlt.
     */
    createMany: async (spool: SpoolCreate, quantity: number): Promise<{ spools: Spool[]; incomplete: string | null }> => {
      if (!(await inventorySource()).spoolman) {
        return { spools: await request<Spool[]>('POST', '/inventory/spools/bulk', { spool, quantity }), incomplete: null };
      }
      const { rest, extras } = splitForSpoolman(spool);
      // 207 = nur ein Teil angelegt: { created, failed_count } – die angelegten trotzdem weiterreichen
      const r = await request<Spool[] | { created: Spool[]; failed_count?: number }>('POST', '/spoolman/inventory/spools/bulk', {
        spool: rest,
        quantity,
      });
      const created = Array.isArray(r) ? r : r.created;
      const missing = Array.isArray(r) ? 0 : (r.failed_count ?? quantity - created.length);
      let extrasError: string | null = null;
      try {
        await setExtras(
          created.map((s) => s.id),
          extras,
        );
      } catch (e) {
        extrasError = e instanceof Error ? e.message : String(e);
      }
      const notes = [
        missing > 0 ? t('new.partial', { n: missing }) : null,
        extrasError ? t('new.extrasFailed', { msg: extrasError }) : null,
      ];
      return {
        spools: created.map((s) => ({
          ...s,
          category: extrasError ? (s.category ?? null) : (extras.category ?? s.category ?? null),
          material_number: extrasError ? s.material_number : (extras.article_number ?? s.material_number),
        })),
        incomplete: notes.filter(Boolean).join(' ') || null,
      };
    },
    /**
     * Bambu-Chip an eine vorhandene Spule hängen (Lager-Spule kommt ins AMS) – danach erkennt Bambuddy sie am Chip,
     * statt eine Dublette anzulegen. Spoolman nimmt nur eines: tray_uuid bevorzugt, sonst tag_uid.
     */
    linkTag: async (spoolId: number, chip: { tagUid: string | null; trayUuid: string | null }) => {
      const tray_uuid = hexTag(chip.trayUuid, 32);
      const tag_uid = hexTag(chip.tagUid, [8, 30]);
      if (!tray_uuid && !tag_uid) throw new ApiError(400, t('rfid.noSpool'));
      if ((await inventorySource()).spoolman) {
        return request('PATCH', `/spoolman/inventory/spools/${spoolId}/tag`, tray_uuid ? { tray_uuid } : { tag_uid });
      }
      return request('PATCH', `/inventory/spools/${spoolId}/link-tag`, { tag_uid, tray_uuid });
    },
    /** Zusatzdaten setzen (null = entfernen), auch für viele Spulen auf einmal */
    setExtras: (ids: number[], patch: ExtrasPatch) => setExtras(ids, patch),
    /**
     * Waagenwert (brutto) übernehmen – Bambuddys eigener Waagen-Weg (SpoolBuddy): rechnet
     * weight_used = label_weight − (brutto − core_weight) und setzt last_scale_weight/last_weighed_at.
     */
    archive: async (id: number) => request<Spool>('POST', `${await inv()}/spools/${id}/archive`),
    /** Spule aus dem RFID-Chip im AMS-Slot anlegen und dem Slot zuweisen (ohne Chip: 400) */
    fromSlot: async (s: { printer_id: number; ams_id: number; tray_id: number }): Promise<Spool> => {
      if (!(await inventorySource()).spoolman) return request<Spool>('POST', '/inventory/spools/from-slot', s);
      try {
        const r = await request<{ success: boolean; spool_id: number | null }>('POST', '/spoolman/spools/from-slot', s);
        if (!r.spool_id) throw new ApiError(502, t('rfid.noSpool'));
        return await bambuddy.spools.get(r.spool_id);
      } catch (e) {
        // Bambuddy sperrt den Weg für jeden API-Schlüssel (filaments:update, auch bei Admins) →
        // gleiches Ergebnis aus erlaubten Schritten: anlegen, Chip verknüpfen, in den Slot legen
        if (e instanceof ApiError && e.status === 403) return adoptFromSlotManually(s);
        throw e;
      }
    },
    /** Gleiche Änderung für viele Spulen; Fehlschläge je Spule kommen in not_found zurück */
    bulkUpdate: async (ids: number[], update: SpoolUpdate): Promise<{ updated: number; not_found: number[] }> => {
      if (!(await inventorySource()).spoolman) return request('POST', '/inventory/spools/bulk-update', { ids, update });
      const r = await request<{ updated: number; errors: { id: number }[] }>('POST', '/spoolman/inventory/spools/bulk-update', {
        ids,
        update,
      });
      return { updated: r.updated, not_found: r.errors.map((e) => e.id) };
    },
    bulkArchive: async (ids: number[]): Promise<{ archived: number; already_archived: number[]; not_found: number[] }> => {
      if (!(await inventorySource()).spoolman) return request('POST', '/inventory/spools/bulk-archive', { ids });
      const r = await request<{ archived: number; errors: { id: number }[] }>('POST', '/spoolman/inventory/spools/bulk-archive', { ids });
      return { archived: r.archived, already_archived: [], not_found: r.errors.map((e) => e.id) };
    },
    /** Waagenwert brutto; Bambuddy zieht die Leerspule ab (bei Spoolman nach dessen Tara-Regel) */
    weigh: async (spoolId: number, grossGrams: number) =>
      (await inventorySource()).spoolman
        ? request<{ status: string; weight_used: number }>('PATCH', `/spoolman/inventory/spools/${spoolId}/weight`, {
            weight_grams: grossGrams,
          })
        : request<{ status: string; weight_used: number }>('POST', '/spoolbuddy/scale/update-spool-weight', {
            spool_id: spoolId,
            weight_grams: grossGrams,
          }),
  },
  locations: {
    list: () => request<Location[]>('GET', '/inventory/locations'),
    /** 409 bei gleichem Namen */
    create: (l: LocationCreate) => request<Location>('POST', '/inventory/locations', l),
    /** Umbenennen überträgt Bambuddy auf die Spulen dort */
    update: (id: number, l: Partial<LocationCreate>) => request<Location>('PATCH', `/inventory/locations/${id}`, l),
    /** nur leere Lagerorte */
    remove: (id: number) => request<void>('DELETE', `/inventory/locations/${id}`),
  },
  assignments: {
    list: async (): Promise<SpoolAssignment[]> =>
      (await inventorySource()).spoolman
        ? (await listSpoolmanSlots()).map(fromSpoolmanSlot)
        : request<SpoolAssignment[]>('GET', '/inventory/assignments'),
    /**
     * Spule in einen Slot legen; eine Spule liegt nur an einem Ort, einen belegten Ziel-Slot ersetzt Bambuddy.
     * Bambuddy lokal: erst neuen Slot belegen, dann alte lösen (scheitert es, bleibt die Spule, wo sie war).
     * Spoolman: Bambuddy löscht Zuweisungen je Spule – darum erst lösen, dann belegen, bei Fehler zurücklegen.
     */
    place: async (a: SpoolAssignmentCreate): Promise<SpoolAssignment> => {
      if (!(await inventorySource()).spoolman) {
        const current = await request<SpoolAssignment[]>('GET', '/inventory/assignments');
        const created = await request<SpoolAssignment>('POST', '/inventory/assignments', a);
        const same = (x: SpoolAssignment) => x.printer_id === a.printer_id && x.ams_id === a.ams_id && x.tray_id === a.tray_id;
        for (const old of current.filter((x) => x.spool_id === a.spool_id && !same(x))) {
          await request('DELETE', `/inventory/assignments/${old.printer_id}/${old.ams_id}/${old.tray_id}`);
        }
        return created;
      }
      const before = (await listSpoolmanSlots()).filter((x) => x.spoolman_spool_id === a.spool_id);
      if (before.length) await request('DELETE', `/spoolman/inventory/slot-assignments/${a.spool_id}`);
      const body = (x: { printer_id: number; ams_id: number; tray_id: number }) => ({
        spoolman_spool_id: a.spool_id,
        printer_id: x.printer_id,
        ams_id: x.ams_id,
        tray_id: x.tray_id,
      });
      try {
        await request('POST', '/spoolman/inventory/slot-assignments', body(a));
      } catch (e) {
        for (const old of before) await request('POST', '/spoolman/inventory/slot-assignments', body(old)).catch(() => undefined);
        throw e;
      }
      return fromSpoolmanSlot({ ...body(a), printer_name: null, ams_label: null }, 0);
    },
    remove: async (printerId: number, amsId: number, trayId: number) => {
      if (!(await inventorySource()).spoolman)
        return request<{ status: string }>('DELETE', `/inventory/assignments/${printerId}/${amsId}/${trayId}`);
      const hit = (await listSpoolmanSlots()).find((x) => x.printer_id === printerId && x.ams_id === amsId && x.tray_id === trayId);
      if (hit) await request('DELETE', `/spoolman/inventory/slot-assignments/${hit.spoolman_spool_id}`);
      return { status: 'ok' };
    },
  },
  printers: {
    list: () => request<Printer[]>('GET', '/printers/'),
    status: (id: number) => request<PrinterStatus>('GET', `/printers/${id}/status`),
  },
  catalog: {
    spools: () => request<CatalogEntry[]>('GET', '/inventory/catalog'),
    /** Leerspulen-Katalog pflegen (SP-10) */
    addSpool: (e: { name: string; weight: number }) => request<CatalogEntry>('POST', '/inventory/catalog', e),
    updateSpool: (id: number, e: { name: string; weight: number }) => request<CatalogEntry>('PUT', `/inventory/catalog/${id}`, e),
    removeSpool: (id: number) => request<{ status: string }>('DELETE', `/inventory/catalog/${id}`),
    colors: (q: { manufacturer?: string; material?: string }) => {
      const p = new URLSearchParams();
      if (q.manufacturer) p.set('manufacturer', q.manufacturer);
      if (q.material) p.set('material', q.material);
      return request<ColorEntry[]>('GET', `/inventory/colors/search?${p}`);
    },
  },
  /** Eigene Etikett-Vorlagen (NiimBlue-JSON), gespeichert im Datenordner des Servers */
  labelTemplates: {
    list: () => labelsRequest<unknown[]>('GET', '/templates'),
    save: (tpl: { id: string } & Record<string, unknown>) => labelsRequest<unknown>('PUT', `/templates/${encodeURIComponent(tpl.id)}`, tpl),
    remove: (id: string) => labelsRequest<void>('DELETE', `/templates/${encodeURIComponent(id)}`),
  },
  /** App-Einstellungen für alle Geräte (z. B. Trocknungswerte); null = Standard */
  prefs: {
    get: <T>(name: PrefsName) => prefsRequest<T>('GET', name),
    put: <T>(name: PrefsName, value: T | null) => prefsRequest<T>('PUT', name, value),
  },
  /** SpoolmanDB: Hersteller, Materialien, Filamente mit Farbe/Gewicht/Leerspule */
  filamentDb: {
    manufacturers: () => catalogRequest<string[]>('/manufacturers'),
    /** Packungs-Barcode → Filament (Open Filament Database) */
    gtin: (code: string) => catalogRequest<GtinHit[]>(`/gtin/${encodeURIComponent(code)}`),
    /** Häufigstes Leerspulen-Gewicht je Hersteller und Spulenart */
    spoolWeights: () => catalogRequest<DbSpoolWeight[]>('/spools'),
    materials: (manufacturer?: string) =>
      catalogRequest<string[]>(`/materials${manufacturer ? `?manufacturer=${encodeURIComponent(manufacturer)}` : ''}`),
    filaments: (q: { manufacturer?: string; material?: string }) => {
      const p = new URLSearchParams();
      if (q.manufacturer) p.set('manufacturer', q.manufacturer);
      if (q.material) p.set('material', q.material);
      return catalogRequest<FilamentEntry[]>(`/filaments?${p}`);
    },
  },
  auth: {
    /** Rechte des Schlüssels bzw. Nutzers */
    me: () => request<Me>('GET', '/auth/me'),
    /** Öffentlich: ist die Anmeldung in Bambuddy eingeschaltet? */
    status: () => request<{ auth_enabled: boolean }>('GET', '/auth/status'),
  },
  /** Öffentlich, ohne Schlüssel (Regel 14) */
  version: () => request<{ version: string }>('GET', '/updates/version'),
};
