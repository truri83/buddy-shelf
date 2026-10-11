import type { Connect } from 'vite';

export function catalogResponse(path: string, query: URLSearchParams): Promise<unknown>;
export function registerCatalog(app: unknown): Promise<void>;
export function catalogMiddleware(): Connect.NextHandleFunction;
export function normalizeGtin(code: string): string | null;
