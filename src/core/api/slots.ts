import type { SpoolAssignment } from './types';

/** Externe Halterung in Bambuddy (vt_tray 254/255 → ams_id 255, tray_id 0/1). */
export const EXTERNAL_AMS = 255;

/** Lesbare Slot-Bezeichnung: „AMS 1 · 3“, „AMS HT 1“, „Extern L/R“. */
export function slotLabel(amsId: number, trayId: number, isHt = false): string {
  if (amsId === EXTERNAL_AMS) return trayId === 0 ? 'Extern L' : 'Extern R';
  if (isHt || amsId >= 128) return `AMS HT ${amsId - 127}`;
  return `AMS ${amsId + 1} · ${trayId + 1}`;
}

/** Slot einer Zuweisung mit Druckername, z. B. „X2D · AMS 1 · 3“. */
export function assignmentLabel(a: Pick<SpoolAssignment, 'printer_name' | 'ams_id' | 'tray_id' | 'ams_label'>): string {
  const slot = a.ams_label ?? slotLabel(a.ams_id, a.tray_id);
  return a.printer_name ? `${a.printer_name} · ${slot}` : slot;
}
