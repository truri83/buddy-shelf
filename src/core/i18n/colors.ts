/**
 * Farbnamen Deutsch ⇄ Englisch, ohne zwei gespeicherte Namen:
 * In Bambuddy steht genau eine Bezeichnung (meist der Herstellername, z. B. „Jade White“).
 * Die andere Sprache wird hier abgeleitet – Grundfarben und Zusätze übersetzt, Eigennamen bleiben,
 * deutsche Komposita werden gebildet („Light Gray“ → „Hellgrau“, „Jade White“ → „Jadeweiß“).
 * Dazu eine Farbfamilie aus dem Hex-Wert, damit „grün“ auch „Bambu Green“ oder Fantasienamen findet.
 */

/** Grundfarben: englisch → deutsch (Kleinschreibung; deutsche Grundform). */
const BASE: Record<string, string> = {
  black: 'schwarz',
  white: 'weiß',
  gray: 'grau',
  grey: 'grau',
  silver: 'silber',
  gold: 'gold',
  red: 'rot',
  orange: 'orange',
  yellow: 'gelb',
  green: 'grün',
  blue: 'blau',
  purple: 'lila',
  violet: 'violett',
  pink: 'rosa',
  magenta: 'magenta',
  brown: 'braun',
  beige: 'beige',
  ivory: 'elfenbein',
  cream: 'creme',
  bronze: 'bronze',
  copper: 'kupfer',
  turquoise: 'türkis',
  cyan: 'cyan',
  teal: 'petrol',
  navy: 'marineblau',
  olive: 'oliv',
  charcoal: 'anthrazit',
  natural: 'natur',
  clear: 'klar',
  transparent: 'transparent',
  mint: 'mint',
  lavender: 'lavendel',
  lime: 'limette',
  coral: 'koralle',
  khaki: 'khaki',
  sand: 'sand',
  bone: 'knochenweiß',
};

/** Zusätze vor der Farbe: werden im Deutschen vorangestellt und zusammengeschrieben. */
const PREFIX: Record<string, string> = {
  light: 'hell',
  dark: 'dunkel',
  pale: 'blass',
  deep: 'tief',
  bright: 'leucht',
  pastel: 'pastell',
  sky: 'himmel',
  forest: 'wald',
  ice: 'eis',
  cherry: 'kirsch',
  blood: 'blut',
  sea: 'see',
  jet: 'tief',
  snow: 'schnee',
  ash: 'asch',
};

/** Eigenschaften (eigenes Wort). */
const WORDS: Record<string, string> = {
  matte: 'matt',
  matt: 'matt',
  silk: 'seide',
  glow: 'nachtleuchtend',
  metallic: 'metallic',
  metal: 'metall',
  translucent: 'transluzent',
  sparkle: 'glitzer',
  galaxy: 'galaxy',
  marble: 'marmor',
  wood: 'holz',
  rainbow: 'regenbogen',
};

const DE_BASE = invert(BASE);
const DE_PREFIX = invert(PREFIX);
const DE_WORDS = invert(WORDS);

function invert(m: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [en, de] of Object.entries(m)) out[de] ??= en;
  return out;
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const title = (s: string) => s.split(' ').map(cap).join(' ');

/** Erkennt, ob ein Name (vermutlich) deutsch ist: enthält ein deutsches Farbwort. */
export function looksGerman(name: string): boolean {
  const n = name.toLowerCase();
  return Object.keys(DE_BASE).some((de) => n.includes(de)) && !Object.keys(BASE).some((en) => new RegExp(`\\b${en}\\b`).test(n));
}

/** Englischer Name → deutsch („Light Gray“ → „Hellgrau“, „Jade White“ → „Jadeweiß“, „Matte Black“ → „Matt Schwarz“). */
export function colorToGerman(name: string): string {
  const words = name.trim().split(/[\s_-]+/).filter(Boolean);
  const out: string[] = [];
  let pending: string[] = []; // Zusätze/Eigennamen, die mit der nächsten Grundfarbe zusammengeschrieben werden
  for (const w of words) {
    const k = w.toLowerCase();
    if (BASE[k]) {
      const base = BASE[k];
      if (pending.length === 1) out.push(cap(pending[0]!.toLowerCase() + base));
      else {
        out.push(...pending.map(cap));
        out.push(cap(base));
      }
      pending = [];
    } else if (PREFIX[k]) pending.push(PREFIX[k]);
    else if (WORDS[k]) {
      out.push(...pending.map(cap), cap(WORDS[k]));
      pending = [];
    } else pending.push(w);
  }
  out.push(...pending);
  return out.join(' ');
}

/** Deutscher Name → englisch („Hellgrau“ → „Light Gray“, „Schwarz Matt“ → „Black Matte“). */
export function colorToEnglish(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => {
      const k = w.toLowerCase();
      if (DE_BASE[k]) return title(DE_BASE[k]);
      if (DE_WORDS[k]) return title(DE_WORDS[k]);
      // Kompositum: Zusatz + Grundfarbe („hellgrau“, „jadeweiß“)
      for (const [de, en] of Object.entries(DE_BASE)) {
        if (k.endsWith(de) && k.length > de.length) {
          const head = k.slice(0, -de.length);
          return `${DE_PREFIX[head] ? title(DE_PREFIX[head]) : cap(head)} ${title(en)}`;
        }
      }
      return w;
    })
    .join(' ');
}

/** Name in der jeweils anderen Sprache – oder null, wenn nichts zu übersetzen ist. */
export function otherLanguageName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const other = looksGerman(name) ? colorToEnglish(name) : colorToGerman(name);
  return other.toLowerCase() === name.trim().toLowerCase() ? null : other;
}

/** Farbfamilien (deutsche Anzeigenamen) */
export type ColorFamily = 'schwarz' | 'weiß' | 'grau' | 'rot' | 'orange' | 'gelb' | 'grün' | 'türkis' | 'blau' | 'lila' | 'rosa' | 'braun';

/** Farbfamilie aus RRGGBB(AA) über HSL. */
export function colorFamily(rgba: string | null | undefined): ColorFamily | null {
  if (!rgba || !/^[0-9a-fA-F]{6}/.test(rgba)) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(rgba.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l < 0.13) return 'schwarz';
  if (l > 0.9 && s < 0.5) return 'weiß';
  if (s < 0.15) return l < 0.25 ? 'schwarz' : l > 0.85 ? 'weiß' : 'grau';
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  // Braun: dunkles, wenig gesättigtes Orange/Rot
  if (h >= 10 && h < 45 && l < 0.45) return 'braun';
  if (h >= 325 && h < 350) return 'rosa'; // Pink/Magenta-Rot
  if (h < 12 || h >= 350) return l > 0.7 ? 'rosa' : 'rot';
  if (h < 40) return 'orange';
  if (h < 70) return 'gelb';
  if (h < 160) return 'grün';
  if (h < 195) return 'türkis';
  if (h < 255) return 'blau';
  if (h < 300) return 'lila';
  return 'rosa';
}

/** Suchbegriffe für eine Farbe: Originalname, Übersetzung, Familie (de + en). */
export function colorSearchText(name: string | null | undefined, rgba?: string | null): string {
  const parts = [name ?? '', otherLanguageName(name) ?? ''];
  const fam = colorFamily(rgba);
  if (fam) parts.push(fam, DE_BASE[fam] ?? '');
  const text = parts.join(' ').toLowerCase();
  // britische/amerikanische Schreibweise gleichwertig
  return /gr[ae]y/.test(text) ? `${text} gray grey` : text;
}
