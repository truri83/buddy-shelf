import { useSyncExternalStore } from 'react';

/** Passt die Ansicht zur Bildschirmbreite (z. B. Liste + Detail nebeneinander ab Tablet quer). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Ab hier Liste und Detail nebeneinander (Tablet quer, Desktop). */
export const SPLIT_QUERY = '(min-width: 1000px)';
