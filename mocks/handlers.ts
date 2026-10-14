import { http, HttpResponse } from 'msw';
import type { SpoolAssignmentCreate, SpoolCreate } from '../src/core/api/types';
import { assignments, catalog, colors, extras, filamentDb, locations, printers, printerStatus, spools } from './data';

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
  // Filamentprofil je Slot (wie Bambuddy: Schlüssel = laufende Nummer)
  http.get(api('/printers/:id/slot-presets'), () =>
    HttpResponse.json({
      0: { ams_id: 0, tray_id: 0, preset_id: 'GFA00', preset_name: 'PLA Basic', tray_info_idx: 'GFA00' },
      2: { ams_id: 0, tray_id: 2, preset_id: 'P38d16be', preset_name: 'ASA', tray_info_idx: 'P38d16be' },
      3: { ams_id: 0, tray_id: 3, preset_id: 'GFSNL03', preset_name: 'PLA+', tray_info_idx: 'GFSNL03' },
      5: { ams_id: 1, tray_id: 1, preset_id: 'GFA00', preset_name: 'PLA Basic', tray_info_idx: 'GFA00' },
    }),
  ),
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
  http.patch(api('/inventory/locations/:id'), async ({ params, request }) => {
    const l = locations.find((x) => x.id === Number(params.id));
    if (!l) return HttpResponse.json({ detail: 'Location not found' }, { status: 404 });
    const body = (await request.json()) as { name?: string };
    if (body.name && locations.some((x) => x !== l && x.name.toLowerCase() === body.name!.toLowerCase())) {
      return HttpResponse.json({ detail: 'Location already exists' }, { status: 409 });
    }
    if (body.name) l.name = body.name;
    return HttpResponse.json(l);
  }),
  // Wie Bambuddy: nur ohne zugeordnete Spulen
  http.delete(api('/inventory/locations/:id'), ({ params }) => {
    const id = Number(params.id);
    if (spools.some((s) => s.location_id === id && !s.archived_at)) {
      return HttpResponse.json({ detail: 'Location still has spools assigned' }, { status: 409 });
    }
    locations.splice(locations.findIndex((x) => x.id === id), 1);
    return HttpResponse.json({ ok: true });
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
    const code = String(params.code).replace(/^0+(?=\d{12})/, '');
    return HttpResponse.json(hits[code] ?? []);
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
  http.post(api('/inventory/spools/bulk-update'), async ({ request }) => {
    const { ids, update } = (await request.json()) as { ids: number[]; update: object };
    const hit = spools.filter((s) => ids.includes(s.id));
    hit.forEach((s) => Object.assign(s, update, { updated_at: new Date().toISOString() }));
    return HttpResponse.json({ updated: hit.length, not_found: ids.filter((id) => !hit.some((s) => s.id === id)) });
  }),
  http.post(api('/inventory/spools/bulk-archive'), async ({ request }) => {
    const { ids } = (await request.json()) as { ids: number[] };
    const hit = spools.filter((s) => ids.includes(s.id) && !s.archived_at);
    hit.forEach((s) => (s.archived_at = new Date().toISOString()));
    return HttpResponse.json({ archived: hit.length, already_archived: [], not_found: ids.filter((id) => !spools.some((s) => s.id === id)) });
  }),
  // Bambuddy: Spule aus dem RFID im Slot anlegen + zuweisen
  http.post(api('/inventory/spools/from-slot'), async ({ request }) => {
    const r = (await request.json()) as { printer_id: number; ams_id: number; tray_id: number };
    const unit = printerStatus[r.printer_id]?.ams.find((a) => a.id === r.ams_id);
    const t = unit?.tray.find((x) => x.id === r.tray_id);
    if (!t?.tray_type) return HttpResponse.json({ detail: 'Slot is empty or has no readable tray data' }, { status: 400 });
    if (!t.tag_uid) return HttpResponse.json({ detail: 'Slot has no RFID tag' }, { status: 400 });
    const stamp = new Date().toISOString();
    const s = {
      ...spools[0]!,
      id: Math.max(...spools.map((x) => x.id)) + 1,
      material: t.tray_type,
      subtype: t.tray_sub_brands?.replace(t.tray_type, '').trim() || null,
      color_name: null,
      rgba: t.tray_color,
      brand: 'Bambu Lab',
      weight_used: 0,
      tag_uid: t.tag_uid,
      tray_uuid: t.tray_uuid ?? null,
      location_id: null,
      archived_at: null,
      created_at: stamp,
      updated_at: stamp,
    };
    spools.push(s);
    assignments.push({ id: Math.max(0, ...assignments.map((x) => x.id)) + 1, spool_id: s.id, printer_id: r.printer_id, printer_name: 'X2D', ams_id: r.ams_id, tray_id: r.tray_id, ams_label: null, configured: true, pending_config: false });
    return HttpResponse.json(s);
  }),
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
  // ---------- Spoolman-Modus von Bambuddy. Alter Weg im Mock: localStorage „bs:mock.spoolman“ = "false"
  http.get(api('/spoolman/status'), () =>
    HttpResponse.json({ enabled: spoolmanOn(), connected: spoolmanOn(), url: spoolmanOn() ? 'http://mock-spoolman:7912' : null }),
  ),
  http.get(api('/spoolman/inventory/spools'), () => HttpResponse.json(spools.filter((x) => !x.archived_at).map(asSpoolman))),
  http.get(api('/spoolman/inventory/spools/:id'), ({ params }) => {
    const s = spools.find((x) => x.id === Number(params.id));
    return s ? HttpResponse.json(asSpoolman(s)) : HttpResponse.json({ detail: 'Spool not found' }, { status: 404 });
  }),
  // Gespeicherte K-Werte je Düse (wie Bambuddy nach Kalibrierung im AMS)
  http.get(api('/spoolman/inventory/spools/:id/k-profiles'), ({ params }) =>
    HttpResponse.json(
      Number(params.id) === 4
        ? [
            { id: 1, spool_id: 4, printer_id: 1, extruder: 1, nozzle_diameter: '0.4', nozzle_type: 'HH', k_value: 0.019, name: 'L_HF_Bambu PLA Basic', cali_idx: 10 },
            { id: 2, spool_id: 4, printer_id: 1, extruder: 0, nozzle_diameter: '0.4', nozzle_type: 'HS', k_value: 0.028, name: 'R_Std_Bambu PLA Basic', cali_idx: 13 },
          ]
        : [],
    ),
  ),
  // Chip an vorhandene Spule hängen (wie Bambuddy: nur eines von beiden)
  http.patch(api('/spoolman/inventory/spools/:id/tag'), async ({ params, request }) => {
    const s = spools.find((x) => x.id === Number(params.id));
    if (!s) return HttpResponse.json({ detail: 'Spool not found' }, { status: 404 });
    const b = (await request.json()) as { tag_uid?: string; tray_uuid?: string };
    if (b.tray_uuid) s.tray_uuid = b.tray_uuid;
    if (b.tag_uid) s.tag_uid = b.tag_uid;
    return HttpResponse.json(asSpoolman(s));
  }),
  http.patch(api('/spoolman/inventory/spools/:id/weight'), async ({ params, request }) => {
    const s = spools.find((x) => x.id === Number(params.id));
    if (!s) return HttpResponse.json({ detail: 'Spool not found' }, { status: 404 });
    const { weight_grams } = (await request.json()) as { weight_grams: number };
    s.weight_used = Math.max(0, s.label_weight - Math.max(0, weight_grams - s.core_weight));
    return HttpResponse.json({ status: 'ok', weight_used: s.weight_used });
  }),
  http.patch(api('/spoolman/inventory/spools/:id'), async ({ params, request }) => {
    const s = spools.find((x) => x.id === Number(params.id));
    if (!s) return HttpResponse.json({ detail: 'Spool not found' }, { status: 404 });
    const body = (await request.json()) as Record<string, unknown>;
    delete body.category; // kennt Bambuddys Spoolman-Weg nicht
    delete body.material_number;
    Object.assign(s, body);
    return HttpResponse.json(asSpoolman(s));
  }),
  http.post(api('/spoolman/inventory/spools/bulk'), async ({ request }) => {
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
      note: null,
      label_weight: 1000,
      core_weight: 250,
      weight_used: 0,
      last_scale_weight: null,
      last_weighed_at: null,
      ...spool,
      category: null,
      material_number: null,
      id: first + k,
      tag_uid: null,
      tray_uuid: null,
      storage_location: null,
      archived_at: null,
      created_at: stamp,
      updated_at: stamp,
    }));
    spools.push(...created);
    return HttpResponse.json(created.map(asSpoolman));
  }),
  http.post(api('/spoolman/inventory/spools/:id/archive'), ({ params }) => {
    const s = spools.find((x) => x.id === Number(params.id));
    if (!s) return HttpResponse.json({ detail: 'Spool not found' }, { status: 404 });
    s.archived_at = new Date().toISOString();
    return HttpResponse.json(asSpoolman(s));
  }),
  http.post(api('/spoolman/inventory/spools/bulk-update'), async ({ request }) => {
    const { ids, update } = (await request.json()) as { ids: number[]; update: object };
    const hit = spools.filter((s) => ids.includes(s.id));
    hit.forEach((s) => Object.assign(s, update));
    return HttpResponse.json({ updated: hit.length, errors: ids.filter((id) => !hit.some((s) => s.id === id)).map((id) => ({ id, status: 404 })) });
  }),
  http.post(api('/spoolman/inventory/spools/bulk-archive'), async ({ request }) => {
    const { ids } = (await request.json()) as { ids: number[] };
    const hit = spools.filter((s) => ids.includes(s.id));
    hit.forEach((s) => (s.archived_at = new Date().toISOString()));
    return HttpResponse.json({ archived: hit.length, errors: [] });
  }),
  http.get(api('/spoolman/inventory/slot-assignments/all'), () =>
    HttpResponse.json(
      assignments.map((a) => ({ printer_id: a.printer_id, printer_name: a.printer_name, ams_id: a.ams_id, tray_id: a.tray_id, spoolman_spool_id: a.spool_id, ams_label: a.ams_label })),
    ),
  ),
  // Wie Bambuddy: Slot wird überschrieben (ON CONFLICT Slot)
  http.post(api('/spoolman/inventory/slot-assignments'), async ({ request }) => {
    const a = (await request.json()) as { spoolman_spool_id: number; printer_id: number; ams_id: number; tray_id: number };
    if (!printers.some((p) => p.id === a.printer_id)) return HttpResponse.json({ detail: 'Printer not found' }, { status: 404 });
    if (!spools.some((s) => s.id === a.spoolman_spool_id)) return HttpResponse.json({ detail: 'Spool not found' }, { status: 404 });
    const i = assignments.findIndex((x) => x.printer_id === a.printer_id && x.ams_id === a.ams_id && x.tray_id === a.tray_id);
    if (i >= 0) assignments.splice(i, 1);
    assignments.push({ id: Math.max(0, ...assignments.map((x) => x.id)) + 1, spool_id: a.spoolman_spool_id, printer_id: a.printer_id, printer_name: 'X2D', ams_id: a.ams_id, tray_id: a.tray_id, ams_label: null, configured: true, pending_config: false });
    return HttpResponse.json({ ok: true });
  }),
  // Wie Bambuddy: löscht alle Zuweisungen dieser Spule
  http.delete(api('/spoolman/inventory/slot-assignments/:spoolId'), ({ params }) => {
    for (let i = assignments.length - 1; i >= 0; i--) if (assignments[i]!.spool_id === Number(params.spoolId)) assignments.splice(i, 1);
    return HttpResponse.json({ id: Number(params.spoolId) });
  }),
  http.post(api('/spoolman/spools/from-slot'), async ({ request }) => {
    const r = (await request.json()) as { printer_id: number; ams_id: number; tray_id: number };
    const t = printerStatus[r.printer_id]?.ams.find((a) => a.id === r.ams_id)?.tray.find((x) => x.id === r.tray_id);
    if (!t?.tray_type || !t.tag_uid) return HttpResponse.json({ detail: 'Slot has no RFID tag' }, { status: 400 });
    const stamp = new Date().toISOString();
    const s = {
      ...spools[0]!,
      id: Math.max(...spools.map((x) => x.id)) + 1,
      material: t.tray_type,
      subtype: t.tray_sub_brands?.replace(t.tray_type, '').trim() || null,
      color_name: null,
      rgba: t.tray_color,
      brand: 'Bambu Lab',
      weight_used: 0,
      tag_uid: t.tag_uid,
      tray_uuid: t.tray_uuid ?? null,
      location_id: null,
      category: null,
      archived_at: null,
      created_at: stamp,
      updated_at: stamp,
    };
    spools.push(s);
    assignments.push({ id: Math.max(0, ...assignments.map((x) => x.id)) + 1, spool_id: s.id, printer_id: r.printer_id, printer_name: 'X2D', ams_id: r.ams_id, tray_id: r.tray_id, ams_label: null, configured: true, pending_config: false });
    return HttpResponse.json({ success: true, spool_id: s.id });
  }),
  // ---------- Zusatzdaten (server/extras.js), im Mock im Speicher
  http.get('*/extras/spools', () => HttpResponse.json({ backend: spoolmanOn() ? 'spoolman' : 'file', spools: extras })),
  http.patch('*/extras/spools/:id', async ({ params, request }) => {
    applyExtras([Number(params.id)], (await request.json()) as Record<string, string | null>);
    return HttpResponse.json({ updated: 1 });
  }),
  http.post('*/extras/spools/bulk', async ({ request }) => {
    const { ids, patch } = (await request.json()) as { ids: number[]; patch: Record<string, string | null> };
    applyExtras(ids, patch);
    return HttpResponse.json({ updated: ids.length });
  }),
  http.get(api('/auth/status'), () => HttpResponse.json({ auth_enabled: true })),
  http.get(api('/updates/version'), () => HttpResponse.json({ version: '1.2.5.7', repo: 'maziggy/bambuddy' })),
];

function spoolmanOn() {
  try {
    return localStorage.getItem('bs:mock.spoolman') !== 'false';
  } catch {
    return true;
  }
}

/** Wie Bambuddys Spoolman-Abbild: keine Kategorie (die liegt in den Zusatzfeldern). */
function asSpoolman<T extends { category?: string | null }>(s: T) {
  const copy: Partial<T> = { ...s };
  delete copy.category;
  return copy;
}

function applyExtras(ids: number[], patch: Record<string, string | null>) {
  for (const id of ids) {
    const cur: Record<string, string> = { ...extras[id] };
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'article_number') {
        const s = spools.find((x) => x.id === id);
        if (s) s.material_number = v;
      } else if (v === null) delete cur[k];
      else cur[k] = v;
    }
    extras[id] = cur;
  }
}
