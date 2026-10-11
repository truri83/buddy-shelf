import { http, HttpResponse } from 'msw';
import type { SpoolAssignmentCreate, SpoolCreate } from '../src/core/api/types';
import { assignments, catalog, colors, locations, printers, printerStatus, spools } from './data';

const api = (p: string) => `*/api/v1${p}`;

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
  http.get(api('/inventory/colors/search'), ({ request }) => {
    const q = new URL(request.url).searchParams;
    const m = (q.get('manufacturer') ?? '').toLowerCase();
    const mat = (q.get('material') ?? '').toLowerCase();
    return HttpResponse.json(colors.filter((c) => c.manufacturer.toLowerCase().includes(m) && (c.material ?? '').toLowerCase().includes(mat)));
  }),
  http.get(api('/auth/me'), () =>
    HttpResponse.json({ username: 'mock', permissions: ['inventory:read', 'inventory:update', 'inventory:view_assignments', 'printers:read'] }),
  ),
  http.get(api('/updates/version'), () => HttpResponse.json({ version: '1.2.5.7', repo: 'maziggy/bambuddy' })),
];
