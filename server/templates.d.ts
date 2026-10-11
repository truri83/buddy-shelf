import type { Connect } from 'vite';

export function cleanTemplate(id: string, t: unknown): Record<string, unknown>;
export function listTemplates(dir?: string): Promise<unknown[]>;
export function saveTemplate(id: string, body: unknown, dir?: string): Promise<Record<string, unknown>>;
export function deleteTemplate(id: string, dir?: string): Promise<void>;
export function registerTemplates(app: unknown): Promise<void>;
export function templatesMiddleware(): Connect.NextHandleFunction;
