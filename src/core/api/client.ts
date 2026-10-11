import { t } from '@/core/i18n';
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

/** Bambuddy/FastAPI-Fehler lesbar machen: `{ detail: "…" }` oder Validierungsliste `{ detail: [{ msg, loc }] }`. */
export function describeError(status: number, body: unknown): string | null {
  const d = (body as { detail?: unknown } | undefined)?.detail;
  if (typeof d === 'string' && d.trim()) return d;
  if (Array.isArray(d)) {
    const parts = d.map((x: { msg?: string; loc?: unknown[] }) => [x.loc?.slice(1).join('.'), x.msg].filter(Boolean).join(': ')).filter(Boolean);
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

export const bambuddy = {
  spools: {
    list: () => request<Spool[]>('GET', '/inventory/spools'),
    get: (id: number) => request<Spool>('GET', `/inventory/spools/${id}`),
    /** Dublettenprüfung per NFC: tag_uid und/oder tray_uuid (Bambu-RFID). */
    byTag: (q: { tagUid?: string; trayUuid?: string }) => {
      const p = new URLSearchParams();
      if (q.tagUid) p.set('tag_uid', q.tagUid);
      if (q.trayUuid) p.set('tray_uuid', q.trayUuid);
      return request<Spool>('GET', `/inventory/spools/by-tag?${p}`);
    },
    update: (id: number, patch: SpoolUpdate) => request<Spool>('PATCH', `/inventory/spools/${id}`, patch),
    /** Mehrere gleiche Spulen in einem Schritt (quantity 1–100). */
    createMany: (spool: SpoolCreate, quantity: number) => request<Spool[]>('POST', '/inventory/spools/bulk', { spool, quantity }),
    /**
     * Waagenwert (brutto) übernehmen – Bambuddys eigener Waagen-Weg (SpoolBuddy): rechnet
     * weight_used = label_weight − (brutto − core_weight) und setzt last_scale_weight/last_weighed_at.
     */
    archive: (id: number) => request<Spool>('POST', `/inventory/spools/${id}/archive`),
    /** Spule aus dem RFID-Chip im AMS-Slot anlegen und dem Slot zuweisen (ohne Chip: 400) */
    fromSlot: (s: { printer_id: number; ams_id: number; tray_id: number }) => request<Spool>('POST', '/inventory/spools/from-slot', s),
    /** Gleiche Änderung für viele Spulen; unbekannte IDs kommen in not_found zurück */
    bulkUpdate: (ids: number[], update: SpoolUpdate) =>
      request<{ updated: number; not_found: number[] }>('POST', '/inventory/spools/bulk-update', { ids, update }),
    bulkArchive: (ids: number[]) =>
      request<{ archived: number; already_archived: number[]; not_found: number[] }>('POST', '/inventory/spools/bulk-archive', { ids }),
    weigh: (spoolId: number, grossGrams: number) =>
      request<{ status: string; weight_used: number }>('POST', '/spoolbuddy/scale/update-spool-weight', { spool_id: spoolId, weight_grams: grossGrams }),
  },
  locations: {
    list: () => request<Location[]>('GET', '/inventory/locations'),
    /** 409 bei gleichem Namen */
    create: (l: LocationCreate) => request<Location>('POST', '/inventory/locations', l),
  },
  assignments: {
    list: () => request<SpoolAssignment[]>('GET', '/inventory/assignments'),
    /** Belegter Slot wird von Bambuddy ersetzt (kein 409). */
    create: (a: SpoolAssignmentCreate) => request<SpoolAssignment>('POST', '/inventory/assignments', a),
    remove: (printerId: number, amsId: number, trayId: number) =>
      request<{ status: string }>('DELETE', `/inventory/assignments/${printerId}/${amsId}/${trayId}`),
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
