import { useMemo } from 'react';
import type { Spool } from '@/core/api';
import { LabelPrintSheet, useLabelTemplates } from '@/core/printing';
import { todayIso } from '@/core/filament';
import { useSetExtras } from '../hooks/useSpools';
import { labelFileName, spoolLabelVariables } from '../labels';

interface Props {
  /** Eine oder mehrere Spulen (Stapeldruck) */
  spools: Spool[];
  isOpen: boolean;
  onDismiss: () => void;
}

/** SP-06: Spulen-Etiketten über das allgemeine Druck-Sheet. */
export function LabelSheet({ spools, isOpen, onDismiss }: Props) {
  const records = useMemo(() => spools.map(spoolLabelVariables), [spools]);
  const { templates } = useLabelTemplates('spool');
  const setExtras = useSetExtras();
  // SP-16: gedruckt/gespeichert = Spule hat ein Etikett (Fehler hier stören den Druck nicht)
  const markPrinted = () =>
    void setExtras.mutateAsync({ ids: spools.map((s) => s.id), patch: { label_printed_at: todayIso() } }).catch(() => undefined);
  return (
    <LabelPrintSheet
      templates={templates}
      records={records}
      fileName={labelFileName}
      storageKey="label.template"
      isOpen={isOpen}
      onDismiss={onDismiss}
      onPrinted={markPrinted}
    />
  );
}
