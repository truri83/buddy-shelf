import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { bambuddy } from '@/core/api';
import { parseTemplate, templateData, type LabelTemplate, type TemplateKind } from './template';
import { BUILTIN_TEMPLATES } from './templates';

const KEY = ['label-templates'] as const;

/** Eingebaute + eigene Vorlagen (eigene vom Server; offline bleiben die eingebauten). */
export function useLabelTemplates(kind?: TemplateKind) {
  const query = useQuery({
    queryKey: KEY,
    queryFn: async () =>
      (await bambuddy.labelTemplates.list()).flatMap((x) => {
        try {
          return [parseTemplate(x)];
        } catch {
          return []; // kaputte Datei im Ordner überspringen statt alles zu verlieren
        }
      }),
    staleTime: 5 * 60_000,
  });
  const templates = useMemo<LabelTemplate[]>(() => {
    const all = [...BUILTIN_TEMPLATES, ...(query.data ?? [])];
    return kind ? all.filter((x) => x.kind === kind) : all;
  }, [query.data, kind]);
  return { templates, query };
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tpl: LabelTemplate) => bambuddy.labelTemplates.save({ ...templateData(tpl) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bambuddy.labelTemplates.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}
