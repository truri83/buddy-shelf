import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bambuddy } from '@/core/api';
import { DEFAULT_DISPLAY, mergeDisplay, type DisplayConfig } from './display';

const KEY = ['prefs', 'display'] as const;

/** Spulen-Anzeige (Standard + eigene Anpassungen vom Server). Ohne Server: Standardwerte. */
export function useDisplayConfig(): DisplayConfig {
  const q = useQuery({
    queryKey: KEY,
    queryFn: async () => mergeDisplay(await bambuddy.prefs.get<Partial<DisplayConfig>>('display')),
    staleTime: 5 * 60_000,
  });
  return q.data ?? DEFAULT_DISPLAY;
}

/** Eigene Werte speichern (null = alles zurück auf Standard). */
export function useSaveDisplayConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cfg: DisplayConfig | null) => bambuddy.prefs.put('display', cfg),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}
