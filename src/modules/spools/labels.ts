import type { Spool } from '@/core/api';
import type { LabelVariables } from '@/core/printing';
import { colorToGerman, fmtDate } from '@/core/i18n';
import { encodeSpoolCode, labelCode } from '@/core/qr/codes';

/** Platzhalter für Spulen-Etiketten: {id} {code} {material} {color} {color_de} {brand} {weight} {core} {article} {dried}. */
export function spoolLabelVariables(s: Spool): LabelVariables {
  return {
    id: String(s.id),
    code: labelCode(encodeSpoolCode(s.id)),
    material: [s.material, s.subtype].filter(Boolean).join(' '),
    color: s.color_name ?? '',
    color_de: s.color_name ? colorToGerman(s.color_name) : '',
    brand: s.brand ?? '',
    weight: `${s.label_weight} g`,
    core: `${s.core_weight} g`,
    article: s.material_number ?? '–',
    dried: s.dried_at ? fmtDate(s.dried_at.slice(0, 10)) : '–',
  };
}

/** Dateiname für den PNG-Ersatzweg. */
export const labelFileName = (v: LabelVariables) => `spule-${v.id}.png`;

/** Trocknungs-Etikett: wie die Spule, Datum ausdrücklich (gerade erst gebucht → Spule evtl. noch ohne dried_at). */
export const driedLabelVariables = (s: Spool, date?: string): LabelVariables => {
  const iso = (date ?? s.dried_at ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const [y, m, d] = iso.split('-');
  // auf dem Aufkleber immer zweistellig: 02.10.2026
  return { ...spoolLabelVariables(s), dried: `${d}.${m}.${y}` };
};
