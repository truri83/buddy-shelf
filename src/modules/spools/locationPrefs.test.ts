import { describe, expect, it } from 'vitest';
import { defaultLocationId, locationText, normalizeLocationPrefs, symbolOf, updateLocationPrefs, withLocation, withoutLocation } from './locationPrefs';

describe('Lagerort-Angaben', () => {
  it('liest kaputte oder fehlende Werte als leer', () => {
    expect(normalizeLocationPrefs(null)).toEqual({ icons: {}, defaultId: null });
    expect(normalizeLocationPrefs({ icons: { 1: '📦', 2: '  ', 3: 5 }, defaultId: '2' })).toEqual({ icons: { 1: '📦' }, defaultId: null });
  });

  it('setzt Symbol und Standard, Abwählen nur beim bisherigen Standard', () => {
    let p = withLocation({ icons: {}, defaultId: null }, 1, '📦', true);
    expect(p).toEqual({ icons: { 1: '📦' }, defaultId: 1 });
    p = withLocation(p, 2, '', false);
    expect(p.defaultId).toBe(1);
    p = withLocation(p, 1, '', false);
    expect(p).toEqual({ icons: {}, defaultId: null });
  });

  it('räumt beim Löschen auf und ignoriert verschwundene Standard-Orte', () => {
    const p = { icons: { 1: '📦', 2: '🔥' }, defaultId: 2 };
    expect(withoutLocation(p, 2)).toEqual({ icons: { 1: '📦' }, defaultId: null });
    expect(defaultLocationId(p, [{ id: 1 }])).toBeNull();
    expect(defaultLocationId(p, [{ id: 1 }, { id: 2 }])).toBe(2);
  });

  it('Text mit Symbol', () => {
    expect(locationText('Regal', '📦')).toBe('📦 Regal');
    expect(locationText('Regal')).toBe('Regal');
  });

  it('eigenes Symbol: nur das erste Zeichen, auch zusammengesetzte Emojis', () => {
    expect(symbolOf('  🗄️ Regal')).toBe('🗄️');
    expect(symbolOf('👨‍👩‍👧x')).toBe('👨‍👩‍👧');
    expect(symbolOf('AB')).toBe('A');
    expect(symbolOf('   ')).toBe('');
  });

  it('Ändern baut auf dem aktuellen Server-Stand auf, nie auf leeren Standardwerten', async () => {
    let server: unknown = { icons: { 1: '📦', 2: '🔥' }, defaultId: 2 };
    const saved = await updateLocationPrefs(
      async () => server,
      async (v) => void (server = v),
      (p) => withLocation(p, 3, '❄️', false),
    );
    expect(saved).toEqual({ icons: { 1: '📦', 2: '🔥', 3: '❄️' }, defaultId: 2 });
    expect(server).toEqual(saved);
  });

  it('kann der Server nicht gelesen werden, wird nichts geschrieben', async () => {
    let writes = 0;
    await expect(
      updateLocationPrefs(
        async () => {
          throw new Error('offline');
        },
        async () => void writes++,
        (p) => p,
      ),
    ).rejects.toThrow('offline');
    expect(writes).toBe(0);
  });
});
