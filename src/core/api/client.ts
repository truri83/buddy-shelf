import type { Location, Spool, SpoolAssignment, SpoolAssignmentCreate, SpoolUpdate } from './types';

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
    throw new ApiError(res.status, `${method} ${path} → ${res.status}`, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const bambuddy = {
  // TODO(Regel 14): Endpunkt für die Bambuddy-Version klären (siehe docs/BAMBUDDY-API.md, offene Fragen).
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
  },
  locations: {
    list: () => request<Location[]>('GET', '/inventory/locations'),
  },
  assignments: {
    list: () => request<SpoolAssignment[]>('GET', '/inventory/assignments'),
    create: (a: SpoolAssignmentCreate) => request<SpoolAssignment>('POST', '/inventory/assignments', a),
  },
};
