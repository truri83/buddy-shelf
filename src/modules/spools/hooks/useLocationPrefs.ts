import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bambuddy } from '@/core/api';
import { EMPTY_LOCATION_PREFS, normalizeLocationPrefs, type LocationPrefs } from '../locationPrefs';

const KEY = ['prefs', 'locations'] as const;

/** Symbole und Standard-Ort der Lagerorte. Ohne Server: keine Symbole, kein Standard. */
export function useLocationPrefs(): LocationPrefs {
  const q = useQuery({
    queryKey: KEY,
    queryFn: async () => normalizeLocationPrefs(await bambuddy.prefs.get<LocationPrefs>('locations')),
    staleTime: 5 * 60_000,
  });
  return q.data ?? EMPTY_LOCATION_PREFS;
}

export function useSaveLocationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: LocationPrefs) => bambuddy.prefs.put('locations', p),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}
