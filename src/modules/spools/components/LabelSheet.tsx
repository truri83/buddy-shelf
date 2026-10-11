import { useMemo } from 'react';
import type { Spool } from '@/core/api';
import { LabelPrintSheet, SPOOL_TEMPLATES } from '@/core/printing';
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
  return <LabelPrintSheet templates={SPOOL_TEMPLATES} records={records} fileName={labelFileName} storageKey="label.template" isOpen={isOpen} onDismiss={onDismiss} />;
}
