import { useMemo } from 'react';
import type { Spool } from '@/core/api';
import { LabelPrintSheet, useLabelTemplates } from '@/core/printing';
import { driedLabelVariables } from '../labels';

/** Trocknungs-Etikett („Getrocknet am …“) für eine oder mehrere Spulen; eigene Vorlagen der Art „Trocknung“. */
export function DriedLabelSheet({ spools, date, onDismiss }: { spools: Spool[] | null; date?: string; onDismiss: () => void }) {
  const { templates } = useLabelTemplates('dried');
  const records = useMemo(() => (spools ?? []).map((s) => driedLabelVariables(s, date)), [spools, date]);
  return (
    <LabelPrintSheet
      templates={templates}
      records={records}
      fileName={(r) => `getrocknet-${r.id}.png`}
      storageKey="label.driedTemplate"
      isOpen={!!spools?.length}
      onDismiss={onDismiss}
    />
  );
}
