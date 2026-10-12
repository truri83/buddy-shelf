import type { Connect } from 'vite';

export type ExtrasPatch = Partial<Record<'dried_at' | 'label_printed_at' | 'category' | 'article_number', string | null>>;
export interface ExtrasBackend {
  kind: 'file' | 'spoolman';
  list(): Promise<Record<string, Record<string, string>>>;
  patch(ids: number[], patch: ExtrasPatch): Promise<number>;
}
export const FIELDS: Record<string, { name: string; field_type: string }>;
export function reachableFromHere(spoolmanUrl: string | null, bambuddyUrl?: string): string | null;
export function cleanPatch(body: unknown): ExtrasPatch;
export function fileBackend(file?: string): ExtrasBackend;
export function spoolmanBackend(base: string): ExtrasBackend;
export function createBackendResolver(opts?: { bambuddyUrl?: string; apiKey?: string; spoolmanUrl?: string; file?: string }): () => Promise<ExtrasBackend>;
export function handleExtras(resolve: () => Promise<ExtrasBackend>, method: string, path: string, body: unknown): Promise<{ status: number; body?: unknown }>;
export function registerExtras(app: unknown, opts: { bambuddyUrl?: string; apiKey?: string; spoolmanUrl?: string }): Promise<void>;
export function extrasMiddleware(): Connect.NextHandleFunction;
