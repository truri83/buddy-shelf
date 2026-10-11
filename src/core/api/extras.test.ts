import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanPatch, fileBackend, handleExtras, spoolmanBackend } from '../../../server/extras.js';

describe('Zusatzdaten: Prüfung', () => {
  it('lässt nur bekannte Felder und Datumsformate zu', () => {
    expect(cleanPatch({ dried_at: '2026-10-11', category: 'Refill' })).toEqual({ dried_at: '2026-10-11', category: 'Refill' });
    expect(cleanPatch({ dried_at: null })).toEqual({ dried_at: null });
    expect(() => cleanPatch({ foo: 'x' })).toThrow(/Unbekanntes Feld/);
    expect(() => cleanPatch({ dried_at: 'gestern' })).toThrow(/Datum/);
    expect(() => cleanPatch({})).toThrow(/Keine Änderung/);
  });
});

describe('Zusatzdaten: Datei', () => {
  let dir = '';
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bs-extras-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('setzt, liest, löscht; Kategorie bleibt Bambuddy überlassen', async () => {
    const b = fileBackend(join(dir, 'spools.json'));
    const resolve = () => Promise.resolve(b);
    await handleExtras(resolve, 'POST', '/spools/bulk', { ids: [4, 5], patch: { label_printed_at: '2026-10-11', category: 'Refill' } });
    await handleExtras(resolve, 'PATCH', '/spools/4', { dried_at: '2026-10-01' });
    let r = await handleExtras(resolve, 'GET', '/spools', undefined);
    expect(r.body).toEqual({ backend: 'file', spools: { 4: { label_printed_at: '2026-10-11', dried_at: '2026-10-01' }, 5: { label_printed_at: '2026-10-11' } } });
    await handleExtras(resolve, 'POST', '/spools/bulk', { ids: [5], patch: { label_printed_at: null } });
    r = await handleExtras(resolve, 'GET', '/spools', undefined);
    expect((r.body as { spools: object }).spools).not.toHaveProperty('5');
  });
  it('gleichzeitige Änderungen gehen nicht verloren', async () => {
    const b = fileBackend(join(dir, 'spools.json'));
    await Promise.all([1, 2, 3, 4, 5].map((id) => b.patch([id], { dried_at: '2026-10-11' })));
    expect(Object.keys(await b.list())).toHaveLength(5);
  });
});

// Gegen echten Spoolman: SPOOLMAN_TEST_URL=http://localhost:7999 (docker run ghcr.io/donkie/spoolman:0.27.0)
const SM = process.env.SPOOLMAN_TEST_URL;
describe.skipIf(!SM)('Zusatzdaten: Spoolman', () => {
  it('legt Felder an, schreibt/löscht extra und Artikelnummer am Filament', async () => {
    const api = `${SM}/api/v1`;
    const post = async (p: string, body: unknown) =>
      (await fetch(`${api}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
    const v = await post('/vendor', { name: `Test ${Date.now()}` });
    const f = await post('/filament', { name: 'PLA Basic', vendor_id: v.id, material: 'PLA', density: 1.24, diameter: 1.75 });
    const s = await post('/spool', { filament_id: f.id });
    const b = spoolmanBackend(SM!);
    await b.patch([s.id], { dried_at: '2026-10-11', category: 'Refill', article_number: '10101' });
    expect((await b.list())[s.id]).toEqual({ dried_at: '2026-10-11', category: 'Refill' });
    expect((await (await fetch(`${api}/filament/${f.id}`)).json()).article_number).toBe('10101');
    await b.patch([s.id], { dried_at: null });
    expect((await b.list())[s.id]).toEqual({ category: 'Refill' });
  });
});
