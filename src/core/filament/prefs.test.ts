import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handlePrefs, prefsStore } from '../../../server/prefs.js';

describe('Gemeinsame Einstellungen (Server)', () => {
  let dir = '';
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bs-prefs-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('speichert, liest, setzt zurück; Unbekanntes wird abgelehnt', async () => {
    const store = prefsStore(join(dir, 'prefs.json'));
    expect(await handlePrefs(store, 'GET', '/drying', undefined)).toEqual({ status: 200, body: { value: null } });
    await handlePrefs(store, 'PUT', '/drying', { value: { dehydratorMax: 70 } });
    expect((await handlePrefs(store, 'GET', '/drying', undefined)).body).toEqual({ value: { dehydratorMax: 70 } });
    await handlePrefs(store, 'PUT', '/drying', { value: null });
    expect((await handlePrefs(store, 'GET', '/drying', undefined)).body).toEqual({ value: null });
    expect((await handlePrefs(store, 'GET', '/geheim', undefined)).status).toBe(404);
    await expect(store.put('drying', [1, 2])).rejects.toThrow(/Objekt/);
  });

  it('PUT ohne Wert setzt nicht still zurück (nur ausdrücklich value: null)', async () => {
    const store = prefsStore(join(dir, 'prefs.json'));
    await handlePrefs(store, 'PUT', '/locations', { value: { icons: { 1: '📦' }, defaultId: 1 } });
    for (const body of [undefined, {}, { wert: 1 }]) {
      expect((await handlePrefs(store, 'PUT', '/locations', body)).status).toBe(400);
    }
    expect((await handlePrefs(store, 'GET', '/locations', undefined)).body).toEqual({ value: { icons: { 1: '📦' }, defaultId: 1 } });
  });
});
