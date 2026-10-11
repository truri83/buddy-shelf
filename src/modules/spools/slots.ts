import type { Printer, PrinterStatus, Spool, SpoolAssignment } from '@/core/api';
import { EXTERNAL_AMS_ID, encodeSlotCode } from '@/core/qr/codes';

/** Ein Platz für eine Spule: AMS-Slot oder externe Halterung (Bambuddy-Adressierung). */
export interface Slot {
  printerId: number;
  printerName: string;
  amsId: number;
  trayId: number;
  /** z. B. „AMS 1 · 3“ oder „Extern L“ */
  label: string;
  /** Was der Drucker im Slot meldet (RRGGBBAA, Material) */
  trayColor: string | null;
  trayType: string | null;
  assignment: SpoolAssignment | null;
}

export const slotKey = (s: Pick<Slot, 'printerId' | 'amsId' | 'trayId'>) => `${s.printerId}:${s.amsId}:${s.trayId}`;

export function slotLabel(amsId: number, trayId: number, isHt = false): string {
  if (amsId === EXTERNAL_AMS_ID) return trayId === 0 ? 'Extern L' : 'Extern R';
  // AMS-HT (ID ab 128) hat nur einen Slot
  if (isHt || amsId >= 128) return `AMS HT ${amsId - 127}`;
  return `AMS ${amsId + 1} · ${trayId + 1}`;
}

/** Alle Slots aller Drucker, mit aktueller Zuweisung. Externe Halterungen: vt_tray 254/255 → ams 255, tray 0/1. */
export function buildSlots(printers: Printer[], statuses: Record<number, PrinterStatus | undefined>, assignments: SpoolAssignment[]): Slot[] {
  const find = (p: number, a: number, t: number) => assignments.find((x) => x.printer_id === p && x.ams_id === a && x.tray_id === t) ?? null;
  const out: Slot[] = [];
  for (const p of printers) {
    const st = statuses[p.id];
    for (const unit of st?.ams ?? []) {
      for (const tray of unit.tray) {
        out.push({
          printerId: p.id,
          printerName: p.name,
          amsId: unit.id,
          trayId: tray.id,
          label: slotLabel(unit.id, tray.id, unit.is_ams_ht),
          trayColor: tray.tray_color,
          trayType: tray.tray_type,
          assignment: find(p.id, unit.id, tray.id),
        });
      }
    }
    for (const vt of st?.vt_tray ?? []) {
      const trayId = vt.id - 254;
      if (trayId < 0 || trayId > 1) continue;
      out.push({
        printerId: p.id,
        printerName: p.name,
        amsId: EXTERNAL_AMS_ID,
        trayId,
        label: slotLabel(EXTERNAL_AMS_ID, trayId),
        trayColor: vt.tray_color,
        trayType: vt.tray_type,
        assignment: find(p.id, EXTERNAL_AMS_ID, trayId),
      });
    }
  }
  return out;
}

/** Zuweisungen, die vor dem Einlegen in einen neuen Slot weg müssen (eine Spule liegt nur an einem Ort). */
export function staleAssignments(spoolId: number, target: Pick<Slot, 'printerId' | 'amsId' | 'trayId'>, assignments: SpoolAssignment[]) {
  return assignments.filter((a) => a.spool_id === spoolId && slotKey({ printerId: a.printer_id, amsId: a.ams_id, trayId: a.tray_id }) !== slotKey(target));
}

/** Platzhalter für Slot-Etiketten (Vorlage SLOT_TEMPLATE). */
export function slotLabelVariables(s: Slot) {
  return { code: encodeSlotCode(s.printerId, s.amsId, s.trayId), printer: s.printerName, ams: s.label.split(' · ')[0]!, slot: s.amsId === EXTERNAL_AMS_ID ? (s.trayId === 0 ? 'L' : 'R') : String(s.trayId + 1) };
}

/** Kurzbeschreibung einer Spule für Rückfragen. */
export const spoolTitle = (s: Pick<Spool, 'id' | 'material' | 'subtype' | 'color_name'>) =>
  `#${s.id} ${[s.material, s.subtype].filter(Boolean).join(' ')}${s.color_name ? ` · ${s.color_name}` : ''}`;
