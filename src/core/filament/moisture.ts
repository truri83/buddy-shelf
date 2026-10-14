import { t, tn } from '@/core/i18n';
import { daysSince, dryingDue, type DryingConfig } from './drying';

export type MoistureLevel = 'dry' | 'soon' | 'due' | 'none';

export interface MoistureState {
  level: MoistureLevel;
  /** kurz fürs Abzeichen („in 8 T.“, „fällig“) */
  short: string;
  /** ausführlich für Hover/Screenreader */
  detail: string;
  /** lohnt die Anzeige? (nicht bei unbekannter Lagerung/Material – das wäre nur ein grauer Strich) */
  show: boolean;
}

/** Ab diesem Rest des Intervalls wird die Ampel gelb (letztes Viertel). */
const SOON_SHARE = 0.25;

/**
 * Feuchtigkeits-Ampel aus „zuletzt getrocknet“ (sonst Anlage) und Lagerungsart: grün trocken, gelb bald,
 * rot fällig; grau ohne Aussage (OVP versiegelt, Lagerungsart oder Material unbekannt).
 */
export function moistureState(
  s: { material: string; storage_type?: string | null; dried_at?: string | null; created_at: string },
  cfg: DryingConfig,
  now = new Date(),
): MoistureState {
  if (s.storage_type === 'sealed') return { level: 'none', short: t('moist.sealed'), detail: t('moist.sealedDetail'), show: true };
  const due = dryingDue(s, cfg, now);
  if (!due) return { level: 'none', short: '', detail: t(s.storage_type ? 'moist.noFamily' : 'moist.noStorage'), show: false };
  const since = daysSince(s.dried_at ?? s.created_at.slice(0, 10), now);
  const last = s.dried_at ? tn('moist.driedAgo', since) : tn('moist.neverDried', since);
  const where = t(`storage.${s.storage_type}`);
  const level: MoistureLevel = due.due ? 'due' : due.dueInDays <= due.intervalDays * SOON_SHARE ? 'soon' : 'dry';
  const next = due.due ? tn('moist.overdue', -due.dueInDays) : tn('moist.nextIn', due.dueInDays);
  return {
    level,
    short: due.due ? t('moist.dueShort') : t('moist.inDays', { n: due.dueInDays }),
    detail: `${last} · ${where} · ${next}`,
    show: true,
  };
}
