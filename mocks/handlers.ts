import { http, HttpResponse } from 'msw';
import type { SpoolAssignmentCreate, SpoolCreate } from '../src/core/api/types';
import { assignments, catalog, colors, filamentDb, locations, printers, printerStatus, spools } from './data';

const api = (p: string) => `*/api/v1${p}`;
const uniq = (l: string[]) => [...new Set(l)].sort((a, b) => a.localeCompare(b, 'de'));

export const handlers = [
  http.get(api('/inventory/spools'), () => HttpResponse.json(spools)),
  http.get(api('/inventory/spools/:id'), ({ params }) => {
    const s = spools.find((x) => x.id === Number(params.id));
    return s ? HttpResponse.json(s) : HttpResponse.json({ detail: 'Spool not found' }, { status: 404 });
  }),
  http.patch(api('/inventory/spools/:id'), async ({ params, request }) => {
    const s = spools.find((x) => x.id === Number(params.id));
    if (!s) return HttpResponse.json({ detail: 'Spool not found' }, { status: 404 });
    Object.assign(s, (await request.json()) as object, { updated_at: new Date().toISOString() });
    return HttpResponse.json(s);
  }),
  http.get(api('/inventory/locations'), () =>
    HttpResponse.json(locations.map((l) => ({ ...l, spool_count: spools.filter((s) => s.location_id === l.id && !s.archived_at).length }))),
  ),
  http.post(api('/inventory/locations'), async ({ request }) => {
    const body = (await request.json()) as { name: string; identifier?: string | null };
    if (locations.some((l) => l.name.toLowerCase() === body.name.toLowerCase())) {
      return HttpResponse.json({ detail: 'Location already exists' }, { status: 409 });
    }
    const l = { id: Math.max(0, ...locations.map((x) => x.id)) + 1, name: body.name, identifier: body.identifier ?? null, spool_count: 0 };
    locations.push(l);
    return HttpResponse.json(l, { status: 201 });
  }),
  http.get(api('/inventory/assignments'), () => HttpResponse.json(assignments)),
  // Wie Bambuddy: belegter Slot wird ersetzt
  http.post(api('/inventory/assignments'), async ({ request }) => {
    const a = (await request.json()) as SpoolAssignmentCreate;
    const spool = spools.find((s) => s.id === a.spool_id);
    if (!spool) return HttpResponse.json({ detail: 'Spool not found' }, { status: 404 });
    if (spool.archived_at) return HttpResponse.json({ detail: 'Cannot assign an archived spool' }, { status: 400 });
    const i = assignments.findIndex((x) => x.printer_id === a.printer_id && x.ams_id === a.ams_id && x.tray_id === a.tray_id);
    if (i >= 0) assignments.splice(i, 1);
    const created = { id: Math.max(0, ...assignments.map((x) => x.id)) + 1, ...a, printer_name: 'X2D', ams_label: null, configured: true, pending_config: false };
    assignments.push(created);
    return HttpResponse.json(created);
  }),
  http.delete(api('/inventory/assignments/:printer/:ams/:tray'), ({ params }) => {
    const i = assignments.findIndex(
      (x) => x.printer_id === Number(params.printer) && x.ams_id === Number(params.ams) && x.tray_id === Number(params.tray),
    );
    if (i < 0) return HttpResponse.json({ detail: 'Assignment not found' }, { status: 404 });
    assignments.splice(i, 1);
    return HttpResponse.json({ status: 'deleted' });
  }),
  http.post(api('/inventory/spools/bulk'), async ({ request }) => {
    const { spool, quantity } = (await request.json()) as { spool: SpoolCreate; quantity: number };
    const first = Math.max(...spools.map((x) => x.id)) + 1;
    const stamp = new Date().toISOString();
    const created = Array.from({ length: quantity }, (_, k) => ({
      ...spools[0]!,
      subtype: null,
      color_name: null,
      rgba: null,
      brand: null,
      location_id: null,
      material_number: null,
      note: null,
      label_weight: 1000,
      core_weight: 250,
      weight_used: 0,
      last_scale_weight: null,
      last_weighed_at: null,
      ...spool,
      id: first + k,
      storage_location: null,
      archived_at: null,
      created_at: stamp,
      updated_at: stamp,
    }));
    spools.push(...created);
    return HttpResponse.json(created);
  }),
  // Bambuddys Waagen-Weg (SpoolBuddy)
  http.post(api('/spoolbuddy/scale/update-spool-weight'), async ({ request }) => {
    const { spool_id, weight_grams } = (await request.json()) as { spool_id: number; weight_grams: number };
    const s = spools.find((x) => x.id === spool_id);
    if (!s) return HttpResponse.json({ detail: 'Spool not found' }, { status: 404 });
    s.weight_used = Math.max(0, s.label_weight - Math.max(0, weight_grams - s.core_weight));
    Object.assign(s, { last_scale_weight: weight_grams, last_weighed_at: new Date().toISOString() });
    return HttpResponse.json({ status: 'ok', weight_used: s.weight_used });
  }),
  http.get(api('/printers/'), () => HttpResponse.json(printers)),
  http.get(api('/printers/:id/status'), ({ params }) => {
    const st = printerStatus[Number(params.id)];
    return st ? HttpResponse.json(st) : HttpResponse.json({ detail: 'Printer not found' }, { status: 404 });
  }),
  http.get(api('/inventory/catalog'), () => HttpResponse.json(catalog)),
  http.post(api('/inventory/catalog'), async ({ request }) => {
    const e = (await request.json()) as { name: string; weight: number };
    const row = { id: Math.max(0, ...catalog.map((c) => c.id)) + 1, name: e.name, weight: e.weight, is_default: false };
    catalog.push(row);
    return HttpResponse.json(row);
  }),
  http.put(api('/inventory/catalog/:id'), async ({ params, request }) => {
    const row = catalog.find((c) => c.id === Number(params.id));
    if (!row) return HttpResponse.json({ detail: 'Entry not found' }, { status: 404 });
    Object.assign(row, (await request.json()) as object);
    return HttpResponse.json(row);
  }),
  http.delete(api('/inventory/catalog/:id'), ({ params }) => {
    const i = catalog.findIndex((c) => c.id === Number(params.id));
    if (i < 0) return HttpResponse.json({ detail: 'Entry not found' }, { status: 404 });
    catalog.splice(i, 1);
    return HttpResponse.json({ status: 'deleted' });
  }),
  // Packungs-Barcodes (server/catalog.js → Open Filament Database)
  http.get('*/catalog/gtin/:code', ({ params }) => {
    const hits: Record<string, object[]> = {
      '6975337031390': [
        { gtin: '06975337031390', brand: 'Bambu Lab', material: 'PLA', filament: 'PLA Basic', color: 'Silver', color_hex: 'A6A9AA', weight: 1000, spool_weight: null, refill: false, article_number: null },
        { gtin: '06975337031390', brand: 'Bambu Lab', material: 'PLA', filament: 'PLA Basic', color: 'Silver', color_hex: 'A6A9AA', weight: 1000, spool_weight: null, refill: true, article_number: '10102' },
      ],
      '191314034277': [
        { gtin: '00191314034277', brand: 'Hatchbox', material: 'PLA', filament: 'PLA Matte', color: 'Terracotta', color_hex: 'A46A62', weight: 1000, spool_weight: 244, refill: false, article_number: null },
      ],
    };
    return HttpResponse.json(hits[String(params.code)] ?? []);
  }),
  // Leerspulen-Vorschläge aus der Filament-Datenbank (server/catalog.js)
  http.get('*/catalog/spools', () =>
    HttpResponse.json([
      { manufacturer: 'Polymaker', spool_type: 'cardboard', weight: 140, count: 120 },
      { manufacturer: 'Sunlu', spool_type: 'plastic', weight: 160, count: 80 },
      { manufacturer: 'Bambu Lab', spool_type: null, weight: 250, count: 287 },
    ]),
  ),
  http.get(api('/inventory/colors/search'), ({ request }) => {
    const q = new URL(request.url).searchParams;
    const m = (q.get('manufacturer') ?? '').toLowerCase();
    const mat = (q.get('material') ?? '').toLowerCase();
    return HttpResponse.json(colors.filter((c) => c.manufacturer.toLowerCase().includes(m) && (c.material ?? '').toLowerCase().includes(mat)));
  }),
  http.get(api('/auth/me'), () =>
    HttpResponse.json({ username: 'mock', permissions: ['inventory:read', 'inventory:update', 'inventory:view_assignments', 'printers:read'] }),
  ),
  http.post(api('/inventory/spools/:id/archive'), ({ params }) => {
    const s = spools.find((x) => x.id === Number(params.id));
    if (!s) return HttpResponse.json({ detail: 'Spool not found' }, { status: 404 });
    s.archived_at = new Date().toISOString();
    return HttpResponse.json(s);
  }),
  // Filament-Datenbank (server/catalog.js)
  http.get('*/catalog/manufacturers', () => HttpResponse.json(uniq(filamentDb.map((f) => f.manufacturer)))),
  http.get('*/catalog/materials', ({ request }) => {
    const m = new URL(request.url).searchParams.get('manufacturer');
    return HttpResponse.json(uniq(filamentDb.filter((f) => !m || f.manufacturer === m).map((f) => f.material)));
  }),
  http.get('*/catalog/filaments', ({ request }) => {
    const q = new URL(request.url).searchParams;
    const m = q.get('manufacturer');
    const mat = q.get('material');
    return HttpResponse.json(filamentDb.filter((f) => (!m || f.manufacturer === m) && (!mat || f.material === mat)));
  }),
  http.get(api('/updates/version'), () => HttpResponse.json({ version: '1.2.5.7', repo: 'maziggy/bambuddy' })),
];
