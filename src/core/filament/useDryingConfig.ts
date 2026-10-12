import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bambuddy } from '@/core/api';
import { DEFAULT_DRYING, mergeDrying, type DryingConfig } from './drying';

const KEY = ['prefs', 'drying'] as const;

/** Trocknungswerte (Standard + eigene Anpassungen vom Server). Ohne Server: Standardwerte. */
export function useDryingConfig(): DryingConfig {
  const q = useQuery({
    queryKey: KEY,
    queryFn: async () => mergeDrying(await bambuddy.prefs.get<Partial<DryingConfig>>('drying')),
    staleTime: 5 * 60_000,
  });
  return q.data ?? DEFAULT_DRYING;
}

/** Eigene Werte speichern (null = alles zurück auf Standard). */
export function useSaveDryingConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cfg: DryingConfig | null) => bambuddy.prefs.put('drying', cfg),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}
