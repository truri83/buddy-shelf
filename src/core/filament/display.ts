/**
 * Spulen-Anzeige: Warnschwellen (Niedrig / Fast leer), je Materialfamilie überschreibbar, plus Anzeige-Schalter.
 * Gemeinsame Einstellung (/prefs/display), gilt für alle Geräte.
 */
import { fillRatio, type Spool } from '@/core/api';
import { materialFamily } from './material';

export interface StockThresholds {
  /** unter diesem Füllstand (%) gilt die Spule als niedrig (gelb) */
  lowPct: number;
  /** ab diesem Füllstand (%) abwärts fast leer (rot, nachkaufen) */
  emptyPct: number;
}

export interface DisplayConfig extends StockThresholds {
  /** Familie → eigene Schwellen */
  materials: Record<string, StockThresholds>;
  /** Füllbalken grün/gelb/rot; aus = einheitlich in Akzentfarbe */
  signalColors: boolean;
  /** Etikettgewicht neuer Spulen (g) */
  defaultWeight: number;
  /** Preis je Spule in Karten */
  showPrice: boolean;
  /** Trocknungs-Hinweise in Karten */
  showDrying: boolean;
}

export type StockLevel = 'ok' | 'low' | 'empty';

export const DEFAULT_DISPLAY: DisplayConfig = {
  lowPct: 25,
  emptyPct: 8,
  materials: {},
  signalColors: true,
  defaultWeight: 1000,
  showPrice: false,
  showDrying: true,
};

const pct = (v: unknown): number | null => (typeof v === 'number' && v >= 0 && v <= 100 ? v : null);

/** Gültig: 0 ≤ Fast leer < Niedrig ≤ 100. */
export const thresholdsValid = (t: { lowPct: number | null; emptyPct: number | null }) =>
  t.lowPct != null && t.emptyPct != null && t.emptyPct >= 0 && t.lowPct <= 100 && t.emptyPct < t.lowPct;

/** Gespeicherte Werte über die Standards legen; Ungültiges fällt auf den Standard zurück. */
export function mergeDisplay(saved: Partial<DisplayConfig> | null | undefined): DisplayConfig {
  const s = saved ?? {};
  const base = { lowPct: pct(s.lowPct) ?? DEFAULT_DISPLAY.lowPct, emptyPct: pct(s.emptyPct) ?? DEFAULT_DISPLAY.emptyPct };
  const global = thresholdsValid(base) ? base : { lowPct: DEFAULT_DISPLAY.lowPct, emptyPct: DEFAULT_DISPLAY.emptyPct };
  const materials: Record<string, StockThresholds> = {};
  for (const [fam, v] of Object.entries(s.materials ?? {})) {
    const m = { lowPct: pct(v?.lowPct), emptyPct: pct(v?.emptyPct) };
    if (thresholdsValid(m)) materials[fam] = m as StockThresholds;
  }
  const weight = typeof s.defaultWeight === 'number' && s.defaultWeight > 0 && s.defaultWeight <= 10000 ? s.defaultWeight : null;
  return {
    ...global,
    materials,
    signalColors: typeof s.signalColors === 'boolean' ? s.signalColors : DEFAULT_DISPLAY.signalColors,
    defaultWeight: weight ?? DEFAULT_DISPLAY.defaultWeight,
    showPrice: typeof s.showPrice === 'boolean' ? s.showPrice : DEFAULT_DISPLAY.showPrice,
    showDrying: typeof s.showDrying === 'boolean' ? s.showDrying : DEFAULT_DISPLAY.showDrying,
  };
}

/** Schwellen für eine Spule: Familie überschreibt global; Bambuddys Spulen-Schwelle überschreibt „Niedrig“. */
export function thresholdsFor(s: Pick<Spool, 'material' | 'low_stock_threshold_pct'>, cfg: DisplayConfig): StockThresholds {
  const fam = materialFamily(s.material);
  const base = (fam && cfg.materials[fam]) || cfg;
  const low = s.low_stock_threshold_pct ?? base.lowPct;
  return { lowPct: low, emptyPct: Math.min(base.emptyPct, low) };
}

/** Füllstand-Stufe: ok · niedrig · fast leer. */
export function stockLevel(
  s: Pick<Spool, 'material' | 'low_stock_threshold_pct' | 'label_weight' | 'weight_used'>,
  cfg: DisplayConfig,
): StockLevel {
  const p = fillRatio(s) * 100;
  const th = thresholdsFor(s, cfg);
  if (p <= th.emptyPct) return 'empty';
  return p < th.lowPct ? 'low' : 'ok';
}
