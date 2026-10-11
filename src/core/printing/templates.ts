import type { LabelTemplate } from './template';

/**
 * Eingebaute Vorlagen, 50×30-mm-Rolle am B1 Pro (300 dpi): bedruckbar 48 mm = 567 px quer,
 * 30 mm = 354 px Länge. Format = NiimBlue-Export, also auf niim.blue weiterbearbeitbar.
 */

const W = 567;
const H = 354;
const FONT = 'Arial';
const TEXT_X = 312;

const qr = (text: string) => ({
  type: 'QRCode',
  version: '7.4.0',
  originX: 'left',
  originY: 'top',
  // 21 Module × 12 px = 252 px QR in 270-px-Box: ≥ 2 Module Ruhezone zum Text (sicher scannbar)
  left: 16,
  top: 42,
  width: 270,
  height: 270,
  text,
  ecl: 'M',
  mode: 'Byte',
  qrVersion: 0,
});

interface TextOpts {
  bold?: boolean;
  fill?: string;
  left?: number;
  width?: number;
  align?: 'left' | 'center';
}

const text = (t: string, top: number, fontSize: number, opts: TextOpts = {}) => ({
  type: 'Textbox',
  version: '7.4.0',
  originX: 'left',
  originY: 'top',
  left: opts.left ?? TEXT_X,
  top,
  width: opts.width ?? W - (opts.left ?? TEXT_X) - 12,
  text: t,
  fontSize,
  fontFamily: FONT,
  fontWeight: opts.bold ? 'bold' : 'normal',
  fill: opts.fill ?? '#000000',
  textAlign: opts.align ?? 'left',
  lineHeight: 1,
  // NiimBlue: Schrift schrumpft, bis der Text in die Breite passt
  fontAutoSize: true,
});

function spool(id: string, title: string, idFill: string): LabelTemplate {
  return {
    id,
    title,
    label: { printDirection: 'top', size: { width: W, height: H } },
    canvas: {
      version: '7.4.0',
      objects: [
        qr('bm:s:{id}'),
        text('#{id}', 24, 76, { bold: true, fill: idFill }),
        text('{material}', 116, 46, { bold: true }),
        text('{color}', 176, 40),
        text('{brand}', 230, 36),
        text('{weight}', 284, 34),
      ],
    },
  };
}

export const SPOOL_TEMPLATE = spool('spool-standard', 'Standard', '#000000');
export const SPOOL_TEMPLATE_RED = spool('spool-red', 'Nummer rot', '#ff0000');

/** Slot-Etikett am AMS (SP-08): QR `bm:t:…` + Drucker, AMS, Slot. */
export const SLOT_TEMPLATE: LabelTemplate = {
  id: 'slot-standard',
  title: 'AMS-Slot',
  label: { printDirection: 'top', size: { width: W, height: H } },
  canvas: {
    version: '7.4.0',
    objects: [qr('{code}'), text('{printer}', 40, 48, { bold: true }), text('{ams}', 120, 60, { bold: true }), text('Slot {slot}', 210, 76, { bold: true })],
  },
};

/**
 * Nach Vorbild Bambu-Etikett (bambu-labelgen.socuul.dev): links Material groß, Farbe, kleine
 * Datentabelle, Hersteller als Schriftzug unten; rechts QR mit Spulennummer statt Farbkreis.
 */
const ROW = { label: { left: 16, width: 150 }, value: { left: 170, width: 170 } };
const row = (label: string, value: string, top: number) => [
  text(label, top, 26, ROW.label),
  text(value, top, 26, { ...ROW.value, bold: true }),
];
export const SPOOL_TEMPLATE_BAMBU: LabelTemplate = {
  id: 'spool-bambu',
  title: 'Bambu-Stil',
  label: { printDirection: 'top', size: { width: W, height: H } },
  canvas: {
    version: '7.4.0',
    objects: [
      text('{material}', 10, 56, { bold: true, left: 16, width: 330 }),
      text('{color}', 76, 32, { left: 16, width: 330 }),
      ...row('Netto', '{weight}', 128),
      ...row('Leerspule', '{core}', 162),
      ...row('Art.-Nr.', '{article}', 196),
      text('{brand}', 262, 64, { bold: true, left: 16, width: 330 }),
      // 21 Module × 9 px = 189 px in 205-px-Box (Ruhezone ≥ 1 Modul, ~0,8 mm je Modul)
      { ...qr('bm:s:{id}'), left: 350, top: 12, width: 205, height: 205 },
      text('#{id}', 236, 72, { bold: true, left: 350, width: 205, align: 'center' }),
    ],
  },
};

export const SPOOL_TEMPLATES = [SPOOL_TEMPLATE, SPOOL_TEMPLATE_RED, SPOOL_TEMPLATE_BAMBU];
export const BUILTIN_TEMPLATES = [...SPOOL_TEMPLATES, SLOT_TEMPLATE];
