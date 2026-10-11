import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetInventorySource, bambuddy, inventorySource } from './client';

/** Nachgebauter Server: Antworten je „METHODE Pfad“, mitgeschriebene Aufrufe. */
function fakeServer(routes: Record<string, (body: unknown) => unknown>) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace(/^.*?(\/api\/v1|\/extras)/, '$1');
    const key = `${init?.method ?? 'GET'} ${path}`;
    calls.push(key);
    const handler = routes[key];
    if (!handler) return new Response(JSON.stringify({ detail: `kein Mock für ${key}` }), { status: 404 });
    const out = handler(init?.body ? JSON.parse(String(init.body)) : undefined);
    if (out instanceof Response) return out;
    return new Response(JSON.stringify(out ?? {}), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

const spool = (id: number, extra: object = {}) => ({ id, material: 'PLA', category: null, material_number: null, ...extra });

/** localStorage-Ersatz (Tests laufen in Node) */
function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), clear: () => m.clear() };
}

beforeEach(() => {
  _resetInventorySource();
  vi.stubGlobal('localStorage', memoryStorage());
});
afterEach(() => vi.unstubAllGlobals());

describe('Datenquelle', () => {
  it('Spoolman an → Spoolman-Pfade, Kategorie aus den Zusatzfeldern', async () => {
    const calls = fakeServer({
      'GET /api/v1/spoolman/status': () => ({ enabled: true, url: 'http://sm:7912' }),
      'GET /api/v1/spoolman/inventory/spools': () => [spool(1), spool(2, { category: 'stale' })],
      'GET /extras/spools': () => ({ spools: { 1: { category: 'Refill', dried_at: '2026-10-11' } } }),
    });
    const list = await bambuddy.spools.list();
    expect(list[0]).toMatchObject({ id: 1, category: 'Refill', dried_at: '2026-10-11', label_printed_at: null });
    expect(list[1]).toMatchObject({ id: 2, category: null });
    expect(calls).toContain('GET /api/v1/spoolman/inventory/spools');
  });

  it('Spoolman aus → bisherige Pfade, Kategorie bleibt von Bambuddy', async () => {
    fakeServer({
      'GET /api/v1/spoolman/status': () => ({ enabled: false, url: null }),
      'GET /api/v1/inventory/spools': () => [spool(1, { category: 'Refill' })],
      'GET /extras/spools': () => ({ spools: { 1: { label_printed_at: '2026-10-11' } } }),
    });
    expect((await bambuddy.spools.list())[0]).toMatchObject({ category: 'Refill', label_printed_at: '2026-10-11' });
  });

  it('ohne Zusatzdaten-Server laufen die Spulen trotzdem', async () => {
    fakeServer({
      'GET /api/v1/spoolman/status': () => ({ enabled: false, url: null }),
      'GET /api/v1/inventory/spools': () => [spool(1)],
    });
    expect(await bambuddy.spools.list()).toHaveLength(1);
  });

  it('Bambuddy kurz weg: letzter bekannter Stand statt raten', async () => {
    fakeServer({ 'GET /api/v1/spoolman/status': () => ({ enabled: true, url: null }) });
    await inventorySource();
    _resetInventorySource();
    const store = localStorage;
    fakeServer({});
    vi.stubGlobal('localStorage', store);
    expect(await inventorySource()).toEqual({ spoolman: true, url: null });
    localStorage.clear();
    _resetInventorySource();
    await expect(inventorySource()).rejects.toThrow();
  });
});

describe('Spoolman: Schreiben', () => {
  it('Bearbeiten trennt Refill/Artikelnummer in die Zusatzfelder', async () => {
    const seen: Record<string, unknown> = {};
    fakeServer({
      'GET /api/v1/spoolman/status': () => ({ enabled: true, url: null }),
      'PATCH /api/v1/spoolman/inventory/spools/4': (b) => ((seen.patch = b), spool(4)),
      'POST /extras/spools/bulk': (b) => ((seen.extras = b), { updated: 1 }),
      'GET /api/v1/spoolman/inventory/spools/4': () => spool(4),
      'GET /extras/spools': () => ({ spools: {} }),
    });
    await bambuddy.spools.update(4, { color_name: 'Black', category: 'Refill', material_number: '10101' });
    expect(seen.patch).toEqual({ color_name: 'Black' });
    expect(seen.extras).toEqual({ ids: [4], patch: { category: 'Refill', article_number: '10101' } });
  });

  it('Ins AMS: erst alten Slot lösen, dann belegen', async () => {
    const calls = fakeServer({
      'GET /api/v1/spoolman/status': () => ({ enabled: true, url: null }),
      'GET /api/v1/spoolman/inventory/slot-assignments/all': () => [
        { printer_id: 1, printer_name: 'X2D', ams_id: 0, tray_id: 1, spoolman_spool_id: 4, ams_label: null },
      ],
      'DELETE /api/v1/spoolman/inventory/slot-assignments/4': () => ({ id: 4 }),
      'POST /api/v1/spoolman/inventory/slot-assignments': () => ({ ok: true }),
    });
    await bambuddy.assignments.place({ spool_id: 4, printer_id: 1, ams_id: 1, tray_id: 0 });
    const writes = calls.filter((c) => !c.startsWith('GET'));
    expect(writes).toEqual(['DELETE /api/v1/spoolman/inventory/slot-assignments/4', 'POST /api/v1/spoolman/inventory/slot-assignments']);
  });

  it('Ins AMS scheitert → Spule kommt in den alten Slot zurück', async () => {
    const posted: unknown[] = [];
    let first = true;
    fakeServer({
      'GET /api/v1/spoolman/status': () => ({ enabled: true, url: null }),
      'GET /api/v1/spoolman/inventory/slot-assignments/all': () => [
        { printer_id: 1, printer_name: 'X2D', ams_id: 0, tray_id: 1, spoolman_spool_id: 4, ams_label: null },
      ],
      'DELETE /api/v1/spoolman/inventory/slot-assignments/4': () => ({}),
      'POST /api/v1/spoolman/inventory/slot-assignments': (b) => {
        posted.push(b);
        if (first) {
          first = false;
          return new Response(JSON.stringify({ detail: 'Printer not found' }), { status: 404 });
        }
        return {};
      },
    });
    await expect(bambuddy.assignments.place({ spool_id: 4, printer_id: 9, ams_id: 0, tray_id: 0 })).rejects.toThrow(/Printer not found/);
    expect(posted[1]).toEqual({ spoolman_spool_id: 4, printer_id: 1, ams_id: 0, tray_id: 1 });
  });

  it('Bambuddy lokal: erst belegen, dann alten Slot lösen', async () => {
    const calls = fakeServer({
      'GET /api/v1/spoolman/status': () => ({ enabled: false, url: null }),
      'GET /api/v1/inventory/assignments': () => [{ id: 1, spool_id: 4, printer_id: 1, ams_id: 0, tray_id: 1 }],
      'POST /api/v1/inventory/assignments': () => ({ id: 2 }),
      'DELETE /api/v1/inventory/assignments/1/0/1': () => ({ status: 'ok' }),
    });
    await bambuddy.assignments.place({ spool_id: 4, printer_id: 1, ams_id: 1, tray_id: 0 });
    expect(calls.filter((c) => !c.startsWith('GET'))).toEqual(['POST /api/v1/inventory/assignments', 'DELETE /api/v1/inventory/assignments/1/0/1']);
  });

  it('Wiegen nutzt bei Spoolman dessen Gewichts-Endpunkt (brutto)', async () => {
    let body: unknown;
    fakeServer({
      'GET /api/v1/spoolman/status': () => ({ enabled: true, url: null }),
      'PATCH /api/v1/spoolman/inventory/spools/4/weight': (b) => ((body = b), { status: 'ok', weight_used: 100 }),
    });
    await bambuddy.spools.weigh(4, 1137);
    expect(body).toEqual({ weight_grams: 1137 });
  });
});
