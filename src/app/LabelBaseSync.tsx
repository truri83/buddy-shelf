import { useEffect } from 'react';
import { useAppPrefsQuery } from '@/core/api';
import { setLabelBase } from '@/core/qr/codes';

/** Feste Etiketten-Adresse aus den Einstellungen an die QR-Erzeugung geben. */
export function LabelBaseSync() {
  const base = useAppPrefsQuery().data?.labelBaseUrl ?? null;
  useEffect(() => setLabelBase(base), [base]);
  return null;
}
