import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteTemplate, listTemplates, saveTemplate } from '../../../server/templates.js';
import { BUILTIN_TEMPLATES } from './templates';
import { guessKind, parseTemplate } from './template';

describe('Vorlagen-Ordner auf dem Server', () => {
  let dir = '';
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bs-tpl-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  const niimblue = { title: 'Meine', thumbnailBase64: 'data:…', label: BUILTIN_TEMPLATES[0]!.label, canvas: BUILTIN_TEMPLATES[0]!.canvas };

  it('speichert, listet und löscht; Vorschaubild fällt weg', async () => {
    await saveTemplate('meine-abc123', niimblue, dir);
    const list = await listTemplates(dir);
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty('thumbnailBase64');
    expect(parseTemplate(list[0]).title).toBe('Meine');
    await deleteTemplate('meine-abc123', dir);
    expect(await listTemplates(dir)).toEqual([]);
  });
  it('lehnt Pfad-Tricks und Unsinn ab', async () => {
    await expect(saveTemplate('../x', niimblue, dir)).rejects.toThrow(/ID/);
    await expect(saveTemplate('ok', { foo: 1 }, dir)).rejects.toThrow(/Vorlage/);
    expect(await readdir(dir)).toEqual([]);
  });
  it('überspringt kaputte Dateien, fehlender Ordner = leer', async () => {
    await writeFile(join(dir, 'kaputt.json'), '{');
    expect(await listTemplates(dir)).toEqual([]);
    expect(await listTemplates(join(dir, 'gibtsnicht'))).toEqual([]);
  });
});

describe('Vorlagen-Art', () => {
  it('eingebaute haben je mindestens eine Spulen-, Slot- und Lagerort-Vorlage', () => {
    expect(BUILTIN_TEMPLATES.some((x) => x.kind === 'spool')).toBe(true);
    expect(BUILTIN_TEMPLATES.some((x) => x.kind === 'slot')).toBe(true);
    expect(BUILTIN_TEMPLATES.some((x) => x.kind === 'location')).toBe(true);
  });
  it('erkennt Slot-Vorlagen an den Platzhaltern', () => {
    expect(guessKind([{ text: 'Slot { slot }' }])).toBe('slot');
    expect(guessKind([{ text: '#{id}' }])).toBe('spool');
    expect(guessKind([{ text: '{location}' }])).toBe('location');
  });
});
