import type { Location, Spool, SpoolAssignment } from '../src/core/api/types';

/** Beispieldaten im Bambuddy-Format für npm run dev:mock und Tests. */
const now = '2026-10-11T12:00:00Z';
const spool = (id: number, material: string, subtype: string | null, color: string, rgba: string, brand: string, used: number, extra: Partial<Spool> = {}): Spool => ({
  id, material, subtype, color_name: color, rgba, brand,
  label_weight: 1000, core_weight: brand === 'Bambu Lab' ? 237 : 180, weight_used: used,
  note: null, tag_uid: null, tray_uuid: null, storage_location: null, location_id: 1,
  material_number: null, low_stock_threshold_pct: null, last_scale_weight: null, last_weighed_at: null,
  archived_at: null, created_at: now, updated_at: now, ...extra,
});

export const locations: Location[] = [
  { id: 1, name: 'Flur – Regal', identifier: 'R1', spool_count: 0 },
  { id: 2, name: 'Drybox 1', identifier: 'D1', spool_count: 0 },
];

export const spools: Spool[] = [
  spool(2, 'PLA', 'Basic', 'Jade White', 'F5F5F0FF', 'Bambu Lab', 875, { location_id: null }),
  spool(4, 'PLA', 'Basic', 'Black', '000000FF', 'Bambu Lab', 546, { location_id: null, material_number: '10101' }),
  spool(5, 'PETG', 'HF', 'Grau', '8A8D91FF', 'Sunlu', 346, { location_id: 2 }),
  spool(10, 'ASA', null, 'Weiß', 'FFFFFFFF', 'Anycubic', 0, { location_id: null }),
  spool(16, 'PETG', 'Basic', 'Gray', '9B9EA2FF', 'Bambu Lab', 688, { material_number: '30107' }),
  spool(17, 'ASA', null, 'Ivory', 'F2EBDAFF', 'Anycubic', 480),
  spool(21, 'PLA', 'Basic', 'Bambu Green', '00AE42FF', 'Bambu Lab', 425, { material_number: '10501' }),
  spool(22, 'PLA', 'Basic', 'Rainbow 01', 'C2187AFF', 'Sunlu', 225),
  spool(27, 'PLA', 'Matte', 'Charcoal', '3B3B3BFF', 'Bambu Lab', 152, { material_number: '11101' }),
  spool(35, 'PLA', 'Basic', 'Hot Pink', 'F5547CFF', 'Bambu Lab', 0, { material_number: '10204' }),
];

export const assignments: SpoolAssignment[] = [
  { id: 1, spool_id: 4, printer_id: 1, printer_name: 'X2D', ams_id: 1, tray_id: 1, ams_label: null, configured: true, pending_config: false },
  { id: 2, spool_id: 10, printer_id: 1, printer_name: 'X2D', ams_id: 0, tray_id: 2, ams_label: null, configured: true, pending_config: false },
];
