import { useIonToast, type ToastButton } from '@ionic/react';
import { useMemo } from 'react';
import { t } from '@/core/i18n';

/** „Speichern fehlgeschlagen: …“ aus einem beliebigen Fehler (auch für Fehlerzeilen in Blättern). */
export const errorText = (e: unknown) => t('common.failed', { msg: e instanceof Error ? e.message : String(e) });

/**
 * Einheitliche Rückmeldungen oben am Rand: ok (kurz), warn (gelb), fail (rot, länger).
 * Ersetzt kopierte useIonToast-Aufrufe – gleiche Position, Dauer und Farben überall.
 */
export function useNotify() {
  const [present] = useIonToast();
  return useMemo(
    () => ({
      ok: (message: string, opts?: { duration?: number; buttons?: ToastButton[] }) =>
        void present({ message, duration: opts?.duration ?? 2000, position: 'top', buttons: opts?.buttons }),
      warn: (message: string) => void present({ message, duration: 3000, position: 'top', color: 'warning' }),
      /** Fehler; `message` ersetzt den Standardtext (z. B. „Name gibt es schon“) */
      fail: (e: unknown, message?: string) => void present({ message: message ?? errorText(e), duration: 3500, position: 'top', color: 'danger' }),
    }),
    [present],
  );
}
