import type { Connect } from 'vite';

export interface PrefsStore {
  get(name: string): Promise<unknown>;
  put(name: string, value: unknown): Promise<unknown>;
}
export function prefsStore(file?: string): PrefsStore;
export function handlePrefs(store: PrefsStore, method: string, path: string, body: unknown): Promise<{ status: number; body: unknown }>;
export function registerPrefs(app: unknown): Promise<void>;
export function prefsMiddleware(): Connect.NextHandleFunction;
