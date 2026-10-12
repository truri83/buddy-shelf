import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bambuddy } from '@/core/api';
import { DEFAULT_DRYING, mergeDrying, type DryingConfig } from './drying';

const KEY = ['prefs', 'drying'] as const;

/** Trocknungswerte (Standard + eigene Anpassungen vom Server). Ohne Server: Standardwerte. */
export function useDryingConfig(): DryingConfig {
  return useDryingConfigQuery().data ?? DEFAULT_DRYING;
}

/** Für die Einstellungsseite: erst bearbeiten, wenn geladen – sonst würden Standardwerte die eigenen überschreiben. */
export function useDryingConfigQuery() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => mergeDrying(await bambuddy.prefs.get<Partial<DryingConfig>>('drying')),
    staleTime: 5 * 60_000,
  });
}

/** Eigene Werte speichern (null = alles zurück auf Standard). */
export function useSaveDryingConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cfg: DryingConfig | null) => bambuddy.prefs.put('drying', cfg),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}
