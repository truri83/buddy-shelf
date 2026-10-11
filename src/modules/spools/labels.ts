import type { Spool } from '@/core/api';
import type { LabelVariables } from '@/core/printing';
import { encodeSpoolCode } from '@/core/qr/codes';

/** Platzhalter für Spulen-Etiketten: {id} {code} {material} {color} {brand} {weight}. */
export function spoolLabelVariables(s: Spool): LabelVariables {
  return {
    id: String(s.id),
    code: encodeSpoolCode(s.id),
    material: [s.material, s.subtype].filter(Boolean).join(' '),
    color: s.color_name ?? '',
    brand: s.brand ?? '',
    weight: `${s.label_weight} g`,
  };
}

/** Dateiname für den PNG-Ersatzweg. */
export const labelFileName = (v: LabelVariables) => `spule-${v.id}.png`;
