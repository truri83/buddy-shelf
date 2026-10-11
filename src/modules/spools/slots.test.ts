import { describe, expect, it } from 'vitest';
import type { PrinterStatus, SpoolAssignment } from '@/core/api';
import { fillVariables, SLOT_TEMPLATE } from '@/core/printing';
import { parseScan } from '@/core/qr/codes';
import { buildSlots, slotLabel, slotLabelVariables, staleAssignments } from './slots';

const status: PrinterStatus = {
  id: 1,
  name: 'X2D',
  connected: true,
  ams: [{ id: 0, is_ams_ht: false, tray: [0, 1, 2, 3].map((id) => ({ id, tray_color: null, tray_type: null, tray_sub_brands: null, remain: null, state: 9 })) }],
  vt_tray: [254, 255].map((id) => ({ id, tray_color: null, tray_type: null, tray_sub_brands: null, remain: null, state: 9 })),
};
const a = (spool_id: number, ams_id: number, tray_id: number): SpoolAssignment => ({
  id: spool_id * 10 + tray_id, spool_id, printer_id: 1, printer_name: 'X2D', ams_id, tray_id, ams_label: null, configured: true, pending_config: false,
});

describe('Slots', () => {
  it('baut AMS- und externe Slots mit Bambuddy-Adressen', () => {
    const slots = buildSlots([{ id: 1, name: 'X2D', model: 'X2D', is_active: true }], { 1: status }, [a(4, 0, 2), a(7, 255, 1)]);
    expect(slots.map((s) => s.label)).toEqual(['AMS 1 · 1', 'AMS 1 · 2', 'AMS 1 · 3', 'AMS 1 · 4', 'Extern L', 'Extern R']);
    expect(slots[2]!.assignment?.spool_id).toBe(4);
    expect(slots[5]).toMatchObject({ amsId: 255, trayId: 1 });
    expect(slots[5]!.assignment?.spool_id).toBe(7);
  });
  it('Drucker ohne Status liefert keine Slots', () => {
    expect(buildSlots([{ id: 2, name: 'P1S', model: null, is_active: true }], {}, [])).toEqual([]);
  });
  it('alte Zuweisungen derselben Spule werden gefunden, die Ziel-Zuweisung nicht', () => {
    const all = [a(4, 0, 2), a(4, 1, 0), a(5, 0, 1)];
    expect(staleAssignments(4, { printerId: 1, amsId: 0, trayId: 2 }, all).map((x) => x.ams_id)).toEqual([1]);
  });
  it('Slot-Etikett: QR wird wieder als derselbe Slot erkannt', () => {
    const [slot] = buildSlots([{ id: 1, name: 'X2D', model: 'X2D', is_active: true }], { 1: status }, []);
    const vars = slotLabelVariables(slot!);
    const qr = SLOT_TEMPLATE.canvas.objects.find((o) => o.type === 'QRCode')!;
    expect(parseScan(fillVariables(String(qr.text), vars))).toEqual({ kind: 'slot', printerId: 1, amsId: 0, trayId: 0 });
    expect(vars).toMatchObject({ printer: 'X2D', ams: 'AMS 1', slot: '1' });
    expect(slotLabel(255, 0)).toBe('Extern L');
  });
});
