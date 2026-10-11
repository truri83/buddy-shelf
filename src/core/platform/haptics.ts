import { can } from './capabilities';

/** Kurze Rückmeldung (Treffer, gespeichert). Ohne Fähigkeit: nichts. */
export function haptic(kind: 'success' | 'warning' = 'success'): void {
  if (!can('haptics')) return;
  navigator.vibrate(kind === 'success' ? 30 : [40, 60, 40]);
}
