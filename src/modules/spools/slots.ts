import { slotLabel, type Printer, type PrinterStatus, type Spool, type SpoolAssignment } from '@/core/api';
import { cleanSubtype, materialFamily, materialVariant } from '@/core/filament';
import { EXTERNAL_AMS_ID, encodeSlotCode, labelCode } from '@/core/qr/codes';

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
  /** z. B. „PLA Basic“ (vom Drucker gemeldet) */
  traySubBrand: string | null;
  tagUid: string | null;
  trayUuid: string | null;
  assignment: SpoolAssignment | null;
}

export { slotLabel };

export const slotKey = (s: Pick<Slot, 'printerId' | 'amsId' | 'trayId'>) => `${s.printerId}:${s.amsId}:${s.trayId}`;

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
          traySubBrand: tray.tray_sub_brands,
          tagUid: tray.tag_uid ?? null,
          trayUuid: tray.tray_uuid ?? null,
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
        traySubBrand: vt.tray_sub_brands,
        tagUid: vt.tag_uid ?? null,
        trayUuid: vt.tray_uuid ?? null,
        assignment: find(p.id, EXTERNAL_AMS_ID, trayId),
      });
    }
  }
  return out;
}

/** Gültiger Chip: vorhanden und nicht nur Nullen (wie Bambuddys is_valid_tag). */
export const validTag = (v: string | null | undefined) => !!v && /[1-9a-f]/i.test(v);

/**
 * SP-13: Slot mit einer Bambu-Spule, die Bambuddy noch nicht kennt – Chip vorhanden,
 * keine Spule mit diesem Chip im Bestand, Slot ohne Zuweisung. Nur die kann `from-slot` anlegen.
 */
export function isNewRfid(slot: Slot, spools: Pick<Spool, 'tag_uid' | 'tray_uuid'>[]): boolean {
  if (slot.assignment || !slot.trayType) return false;
  const tag = validTag(slot.tagUid) ? slot.tagUid!.toUpperCase() : null;
  const uuid = validTag(slot.trayUuid) ? slot.trayUuid!.toUpperCase() : null;
  if (!tag && !uuid) return false;
  return !spools.some((s) => (tag && s.tag_uid?.toUpperCase() === tag) || (uuid && s.tray_uuid?.toUpperCase() === uuid));
}

/** Abstand zweier Farben (RRGGBB…), 0 = gleich; ohne Farbe unendlich. */
function colorDistance(a: string | null | undefined, b: string | null | undefined): number {
  const rgb = (h: string | null | undefined) =>
    h && /^[0-9a-f]{6}/i.test(h) ? [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) : null;
  const x = rgb(a);
  const y = rgb(b);
  return x && y ? Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!, x[2]! - y[2]!) : Infinity;
}

/**
 * Lager-Spulen, die zu einer neu erkannten Bambu-Spule passen könnten (Chip verknüpfen statt Dublette anlegen):
 * gleiche Materialfamilie, noch ohne Chip, in keinem Slot, nicht archiviert. Beste zuerst – Sorte, Marke, Farbe.
 */
export function linkCandidates<S extends Pick<Spool, 'id' | 'material' | 'subtype' | 'brand' | 'color_name' | 'rgba' | 'archived_at' | 'tag_uid' | 'tray_uuid'>>(
  slot: Pick<Slot, 'trayType' | 'traySubBrand' | 'trayColor'>,
  spools: S[],
  assignments: Pick<SpoolAssignment, 'spool_id'>[],
): S[] {
  const fam = materialFamily(slot.trayType);
  if (!fam) return [];
  const variant = materialVariant(slot.traySubBrand ?? slot.trayType ?? '').toLowerCase();
  const inSlot = new Set(assignments.map((x) => x.spool_id));
  const score = (sp: S) => {
    const sub = materialVariant(sp.material, cleanSubtype(sp)).toLowerCase();
    const d = colorDistance(slot.trayColor, sp.rgba);
    return (variant && sub === variant ? 3 : 0) + (/bambu/i.test(sp.brand ?? '') ? 2 : 0) + (d < 40 ? 3 : d < 100 ? 1 : 0);
  };
  return spools
    .filter((sp) => !sp.archived_at && !validTag(sp.tag_uid) && !validTag(sp.tray_uuid) && !inSlot.has(sp.id) && materialFamily(sp.material) === fam)
    .map((sp) => ({ sp, n: score(sp) }))
    .sort((x, y) => y.n - x.n || x.sp.id - y.sp.id)
    .map((x) => x.sp);
}

/** Platzhalter für Slot-Etiketten (Vorlagen der Art „slot“). */
export function slotLabelVariables(s: Slot) {
  return { code: labelCode(encodeSlotCode(s.printerId, s.amsId, s.trayId)), printer: s.printerName, ams: s.label.split(' · ')[0]!, slot: s.amsId === EXTERNAL_AMS_ID ? (s.trayId === 0 ? 'L' : 'R') : String(s.trayId + 1) };
}

/** Kurzbeschreibung einer Spule für Rückfragen. */
export const spoolTitle = (s: Pick<Spool, 'id' | 'material' | 'subtype' | 'color_name'>) =>
  `#${s.id} ${[s.material, s.subtype].filter(Boolean).join(' ')}${s.color_name ? ` · ${s.color_name}` : ''}`;
