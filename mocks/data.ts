import type { CatalogEntry, ColorEntry, Location, Printer, PrinterStatus, Spool, SpoolAssignment } from '../src/core/api/types';

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

export const printers: Printer[] = [{ id: 1, name: 'X2D', model: 'X2D', is_active: true }];

const tray = (id: number, type: string | null, sub: string | null, color: string | null, remain: number | null) => ({
  id, tray_type: type, tray_sub_brands: sub, tray_color: color, remain, state: type ? 11 : 9,
});

/** X2D mit zwei AMS (je 4 Slots) und zwei externen Halterungen (254/255). */
export const printerStatus: Record<number, PrinterStatus> = {
  1: {
    id: 1,
    name: 'X2D',
    connected: true,
    ams: [
      { id: 0, is_ams_ht: false, tray: [tray(0, 'PLA', 'PLA Basic', 'FFFFFFFF', 80), tray(1, null, null, null, null), tray(2, 'ASA', 'ASA', 'FFFFFFFF', 100), tray(3, 'PETG', 'PETG HF', '8A8D91FF', 65)] },
      { id: 1, is_ams_ht: false, tray: [tray(0, null, null, null, null), tray(1, 'PLA', 'PLA Basic', '000000FF', 45), tray(2, null, null, null, null), tray(3, null, null, null, null)] },
    ],
    vt_tray: [tray(254, null, null, null, null), tray(255, null, null, null, null)],
  },
};

export const catalog: CatalogEntry[] = [
  { id: 24, name: 'Bambu Lab - Plastic', weight: 237, is_default: true },
  { id: 30, name: 'Sunlu - Plastic', weight: 180, is_default: true },
  { id: 41, name: 'Pappspule (allgemein)', weight: 140, is_default: true },
];

export const colors: ColorEntry[] = [
  { id: 1, manufacturer: 'Bambu Lab', color_name: 'Jade White', hex_color: '#FFFFFF', material: 'PLA' },
  { id: 2, manufacturer: 'Bambu Lab', color_name: 'Black', hex_color: '#000000', material: 'PLA' },
  { id: 3, manufacturer: 'Bambu Lab', color_name: 'Bambu Green', hex_color: '#00AE42', material: 'PLA' },
  { id: 4, manufacturer: 'Bambu Lab', color_name: 'Gray', hex_color: '#8E9089', material: 'PETG' },
  { id: 5, manufacturer: 'Sunlu', color_name: 'Grau', hex_color: '#8A8D91', material: 'PETG' },
];
