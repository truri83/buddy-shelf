import { useMemo } from 'react';
import { LabelPrintSheet, useLabelTemplates } from '@/core/printing';
import { slotLabelVariables, type Slot } from '../slots';

/** Etiketten für einen oder mehrere AMS-Slots (Vorlagen der Art „slot“, QR bm:t:…). */
export function SlotLabelSheet({ slots, onDismiss }: { slots: Slot[] | null; onDismiss: () => void }) {
  const { templates } = useLabelTemplates('slot');
  const records = useMemo(() => (slots ?? []).map(slotLabelVariables), [slots]);
  return (
    <LabelPrintSheet
      templates={templates}
      records={records}
      fileName={(r) => `slot-${r.code?.replace(/[^0-9]+/g, '-')}.png`}
      storageKey="label.slotTemplate"
      isOpen={!!slots?.length}
      onDismiss={onDismiss}
    />
  );
}
