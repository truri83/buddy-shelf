import { describe, expect, it } from 'vitest';
import { isHidden, normalizeListPrefs, recentValues, setHidden, updateListPrefs } from './listPrefs';

describe('Auswahllisten', () => {
  it('zuletzt genutzt: neueste Spule zuerst, ohne Doppelte, begrenzt', () => {
    const spools = [
      { id: 1, brand: 'Sunlu' },
      { id: 5, brand: 'Bambu Lab' },
      { id: 3, brand: 'sunlu' },
      { id: 4, brand: null },
      { id: 2, brand: 'Anycubic' },
    ];
    expect(recentValues(spools, (s) => s.brand)).toEqual(['Bambu Lab', 'sunlu', 'Anycubic']);
    expect(recentValues(spools, (s) => s.brand, 2)).toEqual(['Bambu Lab', 'sunlu']);
  });

  it('ausblenden ohne Rücksicht auf Groß/Klein, kaputte Werte werden leer', () => {
    let l = setHidden([], 'Eryone', true);
    l = setHidden(l, 'eryone', true);
    expect(l).toEqual(['eryone']);
    expect(isHidden(l, 'ERYONE')).toBe(true);
    expect(setHidden(l, 'Eryone', false)).toEqual([]);
    expect(normalizeListPrefs({ hiddenBrands: ['A', 'A', 3, ' '], hiddenMaterials: 'x' })).toEqual({
      hiddenBrands: ['A'],
      hiddenMaterials: [],
    });
  });

  it('speichert nur auf frischem Server-Stand', async () => {
    let server: unknown = { hiddenBrands: ['Eryone'], hiddenMaterials: [] };
    const saved = await updateListPrefs(
      async () => server,
      async (v) => void (server = v),
      (p) => ({ ...p, hiddenMaterials: setHidden(p.hiddenMaterials, 'PVA', true) }),
    );
    expect(saved).toEqual({ hiddenBrands: ['Eryone'], hiddenMaterials: ['PVA'] });
    let writes = 0;
    await expect(
      updateListPrefs(
        async () => {
          throw new Error('offline');
        },
        async () => void writes++,
        (p) => p,
      ),
    ).rejects.toThrow();
    expect(writes).toBe(0);
  });
});
