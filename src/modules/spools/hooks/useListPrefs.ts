import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bambuddy } from '@/core/api';
import { EMPTY_LIST_PREFS, normalizeListPrefs, updateListPrefs, type ListPrefs } from '../listPrefs';

const KEY = ['prefs', 'lists'] as const;

/** Ausgeblendete Hersteller/Materialien. Ohne Server: nichts ausgeblendet. */
export function useListPrefsQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => normalizeListPrefs(await bambuddy.prefs.get<ListPrefs>('lists')),
    staleTime: 5 * 60_000,
  });
}

export const useListPrefs = (): ListPrefs => useListPrefsQuery().data ?? EMPTY_LIST_PREFS;

/** Ändern per Funktion auf dem frischen Server-Stand. */
export function useSaveListPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (change: (p: ListPrefs) => ListPrefs) =>
      updateListPrefs(
        () => bambuddy.prefs.get<ListPrefs>('lists'),
        (p) => bambuddy.prefs.put('lists', p),
        change,
      ),
    onSuccess: (p) => qc.setQueryData(KEY, p),
  });
}
