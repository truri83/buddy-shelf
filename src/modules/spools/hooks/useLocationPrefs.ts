import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bambuddy } from '@/core/api';
import { EMPTY_LOCATION_PREFS, normalizeLocationPrefs, updateLocationPrefs, type LocationPrefs } from '../locationPrefs';

const KEY = ['prefs', 'locations'] as const;

/** Symbole und Standard-Ort der Lagerorte. Ohne Server: keine Symbole, kein Standard. */
export function useLocationPrefs(): LocationPrefs {
  return useLocationPrefsQuery().data ?? EMPTY_LOCATION_PREFS;
}

/** Mit Ladezustand: Symbol/Standard erst bearbeitbar, wenn die echten Angaben da sind. */
export function useLocationPrefsQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => normalizeLocationPrefs(await bambuddy.prefs.get<LocationPrefs>('locations')),
    staleTime: 5 * 60_000,
  });
}

/** Ändern per Funktion auf dem frischen Server-Stand (nie auf dem evtl. leeren Zwischenspeicher). */
export function useSaveLocationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (change: (p: LocationPrefs) => LocationPrefs) =>
      updateLocationPrefs(
        () => bambuddy.prefs.get<LocationPrefs>('locations'),
        (p) => bambuddy.prefs.put('locations', p),
        change,
      ),
    onSuccess: (p) => qc.setQueryData(KEY, p),
  });
}
