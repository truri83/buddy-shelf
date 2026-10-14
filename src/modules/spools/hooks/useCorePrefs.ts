import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bambuddy } from '@/core/api';

/** Standard-Leerspule je Hersteller: brandKey(Hersteller) → Katalog-ID (gilt für alle Geräte). */
export interface CorePrefs {
  defaults: Record<string, number>;
}
const KEY = ['prefs', 'cores'] as const;
const EMPTY: CorePrefs = { defaults: {} };

const normalize = (v: unknown): CorePrefs => {
  const d = (v as Partial<CorePrefs> | null)?.defaults;
  const defaults: Record<string, number> = {};
  if (d && typeof d === 'object') for (const [k, id] of Object.entries(d)) if (typeof id === 'number') defaults[k] = id;
  return { defaults };
};

export function useCorePrefsQuery() {
  return useQuery({ queryKey: KEY, queryFn: async () => normalize(await bambuddy.prefs.get<CorePrefs>('cores')), staleTime: 5 * 60_000 });
}
export const useCorePrefs = (): CorePrefs => useCorePrefsQuery().data ?? EMPTY;

/** Ändern auf dem frischen Server-Stand. */
export function useSaveCorePrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (change: (p: CorePrefs) => CorePrefs) => {
      const next = change(normalize(await bambuddy.prefs.get<CorePrefs>('cores')));
      await bambuddy.prefs.put('cores', next);
      return next;
    },
    onSuccess: (p) => qc.setQueryData(KEY, p),
  });
}
