import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return pageFiles(p);
    return /[\\/]pages[\\/][^\\/]+\.tsx$/.test(p) ? [p] : [];
  });
}

describe('Seiten', () => {
  // Ionic blendet beim Seitenwechsel genau das IonPage-Element ein, das zuerst gerendert wurde. Tauscht eine
  // Seite es aus (z. B. Lade-Seite → Formular), bleibt die neue unsichtbar: leerer Bildschirm (Packungs-Scan, 12.10.).
  it('jede Seite hat genau ein IonPage – Zustände wechseln nur den Inhalt', () => {
    const src = join(process.cwd(), 'src');
    const wrong = pageFiles(src)
      .map((f) => ({ file: relative(src, f), n: (readFileSync(f, 'utf8').match(/<IonPage[\s>]/g) ?? []).length }))
      .filter((p) => p.n !== 1);
    expect(wrong).toEqual([]);
  });
});
