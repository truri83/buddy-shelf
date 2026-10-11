/**
 * Farbnamen Deutsch ⇄ Englisch, ohne zwei gespeicherte Namen:
 * In Bambuddy steht genau eine Bezeichnung (meist der Herstellername, z. B. „Jade White“).
 * Die andere Sprache wird hier abgeleitet – Grundfarben und Zusätze übersetzt, deutsche Komposita
 * gebildet („Light Gray“ → „Hellgrau“, „Navy Blue“ → „Marineblau“). Enthält ein Name ein Wort, das wir
 * nicht kennen („Arctic Whisper“, „Burnt Titanium“), bleibt er unübersetzt – lieber keine als eine
 * falsche Übersetzung. Dazu eine Farbfamilie aus dem Hex-Wert für Suche und Gruppierung.
 */

/** Grundfarben: englisch → deutsch (deutsche Grundform). */
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
  pink: 'pink',
  rose: 'rosé',
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
  burgundy: 'bordeaux',
  tan: 'hellbraun',
};

/** Form einer Grundfarbe als erster Teil eines Kompositums („Limettengrün“, nicht „Limettegrün“). */
const COMPOUND_FORM: Record<string, string> = { limette: 'limetten', koralle: 'korallen' };

/** Zusätze vor der Farbe: im Deutschen vorangestellt und zusammengeschrieben. Eigennamen = sich selbst. */
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
  lemon: 'zitronen',
  apple: 'apfel',
  ocean: 'ozean',
  lilac: 'flieder',
  mistletoe: 'mistel',
  cocoa: 'kakao',
  ruby: 'rubin',
  moss: 'moos',
  midnight: 'mitternachts',
  hot: 'knall',
  royal: 'königs',
  baby: 'baby',
  signal: 'signal',
  traffic: 'verkehrs',
  sun: 'sonnen',
  fire: 'feuer',
  grass: 'gras',
  steel: 'stahl',
  slate: 'schiefer',
  stone: 'stein',
  coffee: 'kaffee',
  chocolate: 'schokoladen',
  wine: 'wein',
  // Eigennamen, die im Deutschen genauso zusammengeschrieben werden
  jade: 'jade',
  titan: 'titan',
  bambu: 'bambu',
  sakura: 'sakura',
  space: 'space',
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

/** Für Vergleiche: Kleinschreibung, ß/Umlaute ausgeschrieben („Weiß“ = „weiss“, „Grün“ = „gruen“). */
export function foldGerman(s: string): string {
  return s.toLowerCase().replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/é/g, 'e');
}

function invert(m: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [en, de] of Object.entries(m)) out[foldGerman(de)] ??= en;
  return out;
}

const DE_BASE = invert(BASE);
const DE_PREFIX = invert(PREFIX);
const DE_WORDS = invert(WORDS);
const DE_COMPOUND = invert(Object.fromEntries(Object.entries(COMPOUND_FORM).map(([de, c]) => [DE_BASE[foldGerman(de)] ?? de, c])));
/** Wörter, die in beiden Sprachen gleich sind – sagen nichts über die Sprache */
const SHARED = new Set(['gold', 'orange', 'beige', 'bronze', 'magenta', 'cyan', 'khaki', 'sand', 'transparent', 'mint', 'metallic', 'pink', 'galaxy', 'jade', 'titan', 'bambu', 'sakura', 'space', 'baby', 'signal']);

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const title = (s: string) => s.split(' ').map(cap).join(' ');
const isWord = (t: string) => /^\p{L}+$/u.test(t);

/** Teilt ein deutsches Kompositum in Kopf + Grundfarbe („rotbraun“ → [„rot“, „braun“]). */
function splitCompound(k: string): [string, string] | null {
  const base = Object.keys(DE_BASE)
    .filter((b) => k.length > b.length && k.endsWith(b))
    .sort((a, b) => b.length - a.length)[0];
  return base ? [k.slice(0, -base.length), base] : null;
}

const headToEnglish = (head: string) => DE_PREFIX[head] ?? DE_BASE[head] ?? DE_COMPOUND[head] ?? null;

/** Erkennt, ob ein Name (vermutlich) deutsch ist. */
export function looksGerman(name: string): boolean {
  const words = foldGerman(name).split(/[^a-z]+/).filter(Boolean);
  let de = 0;
  let en = 0;
  for (const w of words) {
    if (SHARED.has(w)) continue;
    if (BASE[w] || WORDS[w] || PREFIX[w]) en++;
    else if (DE_BASE[w] || DE_WORDS[w] || DE_PREFIX[w]) de++;
    else {
      const c = splitCompound(w);
      if (c && headToEnglish(c[0])) de++;
    }
  }
  return de > en;
}

/** Englischer Name → deutsch. Unbekannte Wörter ⇒ Name bleibt unverändert. */
export function colorToGerman(name: string): string {
  // „Black & White“: Teile einzeln übersetzen
  if (/[&/]/.test(name)) {
    const parts = name.split(/\s*([&/])\s*/);
    const de = parts.map((p) => (/^[&/]$/.test(p) ? ` ${p} ` : colorToGerman(p)));
    return de.join('');
  }
  const tokens = name.trim().split(/[\s_-]+/).filter(Boolean);
  const out: string[] = [];
  let stems: string[] = []; // Zusätze, die mit der nächsten Grundfarbe zusammengeschrieben werden
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    const k = tok.toLowerCase();
    if (/^\d+$/.test(tok)) {
      if (stems.length) return name;
      out.push(tok);
      continue;
    }
    if (!isWord(tok)) return name;
    if (BASE[k]) {
      let base = BASE[k];
      // Grundfarbe + Grundfarbe → ein Wort („Blue Grey“ → „Blaugrau“, „Navy Blue“ → „Marineblau“)
      while (i + 1 < tokens.length && BASE[tokens[i + 1]!.toLowerCase()]) {
        const next = BASE[tokens[++i]!.toLowerCase()]!;
        if (!base.endsWith(next)) base = (COMPOUND_FORM[base] ?? base) + next;
      }
      out.push(cap(stems.join('') + base));
      stems = [];
    } else if (PREFIX[k]) stems.push(PREFIX[k]);
    else if (WORDS[k]) {
      if (stems.length) return name;
      out.push(cap(WORDS[k]));
    } else return name; // unbekanntes Wort ⇒ nicht übersetzen
  }
  if (stems.length) return name; // Zusatz ohne Farbe („Ash“) ⇒ nicht übersetzen
  return out.join(' ');
}

/** Deutscher Name → englisch („Hellgrau“ → „Light Gray“, „Rotbraun“ → „Red Brown“). Unbekannt ⇒ unverändert. */
export function colorToEnglish(name: string): string {
  const parts: string[] = [];
  for (const w of name.trim().split(/\s+/)) {
    const k = foldGerman(w);
    if (/^\d+$/.test(w)) parts.push(w);
    else if (DE_BASE[k]) parts.push(title(DE_BASE[k]));
    else if (DE_WORDS[k]) parts.push(title(DE_WORDS[k]));
    else if (DE_PREFIX[k]) parts.push(title(DE_PREFIX[k]));
    else {
      const c = splitCompound(k);
      const headEn = c ? headToEnglish(c[0]) : null;
      if (!c || !headEn) return name;
      parts.push(`${title(headEn)} ${title(DE_BASE[c[1]]!)}`);
    }
  }
  return parts.join(' ');
}

/** Name in der jeweils anderen Sprache – oder null, wenn nichts (sicher) zu übersetzen ist. */
export function otherLanguageName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const other = looksGerman(name) ? colorToEnglish(name) : colorToGerman(name);
  return foldGerman(other) === foldGerman(name.trim()) ? null : other;
}

/** Farbfamilien (Schlüssel; Anzeige über t('color.family.…')) */
export type ColorFamily = 'schwarz' | 'weiß' | 'grau' | 'beige' | 'braun' | 'rot' | 'orange' | 'gelb' | 'grün' | 'türkis' | 'blau' | 'lila' | 'rosa';

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
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  if (l > 0.93 && s < 0.6 && !(h >= 15 && h < 65 && s > 0.35)) return 'weiß';
  // helle, wenig gesättigte Warmtöne: Beige („Desert Tan“, „Latte“, „Cream“)
  if (h >= 15 && h < 65 && l > 0.68 && s >= 0.12 && s < 0.75) return 'beige';
  if (s < 0.15) return l < 0.25 ? 'schwarz' : l > 0.85 ? 'weiß' : 'grau';
  // Braun: dunkle oder entsättigte Orange-/Gelbtöne („Caramel“, „Bronze“, „Cocoa“)
  if (h >= 10 && h < 60 && (l < 0.45 || (s < 0.45 && l < 0.8))) return 'braun';
  if (h >= 60 && h < 70 && l < 0.35) return 'grün'; // Oliv
  if (h >= 325 && h < 350) return l < 0.35 ? 'rot' : 'rosa'; // Bordeaux vs. Pink
  if (h < 10 || h >= 350) return l > 0.75 ? 'rosa' : 'rot';
  if (h < 40) return 'orange';
  if (h < 70) return 'gelb';
  if (h < 160) return 'grün';
  if (h < 195) return 'türkis';
  if (h < 245) return 'blau';
  if (h < 300) return 'lila';
  return l < 0.35 ? 'rot' : 'rosa';
}

const FAMILY_EN: Record<ColorFamily, string> = {
  schwarz: 'black',
  weiß: 'white',
  grau: 'gray grey',
  beige: 'beige',
  braun: 'brown',
  rot: 'red',
  orange: 'orange',
  gelb: 'yellow',
  grün: 'green',
  türkis: 'turquoise',
  blau: 'blue',
  lila: 'purple',
  rosa: 'pink',
};

/** Suchtext für eine Farbe: Originalname, Übersetzung, Familie (de + en), alles gefaltet (ß→ss …). */
export function colorSearchText(name: string | null | undefined, rgba?: string | null): string {
  const parts = [name ?? '', otherLanguageName(name) ?? ''];
  const fam = colorFamily(rgba);
  if (fam) parts.push(fam, FAMILY_EN[fam]);
  const text = foldGerman(parts.join(' '));
  // britische/amerikanische Schreibweise gleichwertig
  return /gr[ae]y/.test(text) ? `${text} gray grey` : text;
}
