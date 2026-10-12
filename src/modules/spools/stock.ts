import type { StockLevel } from '@/core/filament';

/** Textfarbe für Prozent-Angaben je Füllstand-Stufe. */
export const LEVEL_TEXT: Record<StockLevel, string> = {
  ok: 'var(--bs-text-2)',
  low: 'var(--bs-warn)',
  empty: 'var(--bs-critical)',
};

/** 19,9 → „19,90“ */
export const fmtMoney = (eur: number) => eur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
