import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { de } from './de';

/** Alle Quelltexte außer der Textdatei selbst. */
function sources(dir: string): string {
  return readdirSync(dir, { withFileTypes: true })
    .map((e) => {
      const p = join(dir, e.name);
      if (e.isDirectory()) return sources(p);
      return /\.(ts|tsx|js|json)$/.test(e.name) && !p.endsWith(join('i18n', 'de.ts')) ? readFileSync(p, 'utf8') : '';
    })
    .join('\n');
}

describe('Texte', () => {
  it('jeder Text in de.ts wird im Code benutzt', () => {
    const code = ['src', 'mocks', 'server'].map((d) => sources(join(process.cwd(), d))).join('\n');
    // dynamisch zusammengesetzte Schlüssel: t(`storage.${k}`)
    const prefixes = [...code.matchAll(/`([a-zA-Z0-9_.]+\.)\$\{/g)].map((m) => m[1]!);
    const used = (k: string) =>
      code.includes(`'${k}'`) ||
      code.includes(`\`${k}\``) ||
      (k.endsWith('One') && code.includes(`'${k.slice(0, -3)}'`)) || // tn(key, n) → keyOne
      prefixes.some((p) => k.startsWith(p));
    expect(Object.keys(de).filter((k) => !used(k))).toEqual([]);
  });
});
