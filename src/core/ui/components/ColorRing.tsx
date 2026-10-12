import { rgbaToCss } from '../material';

interface Props {
  rgba: string | null;
  size?: number;
  label: string;
}

/**
 * Filamentfarbe als Spulen-Symbol: Scheibe in der Filamentfarbe mit Nabe und feinem Rand (auch Weiß auf hellem
 * und Schwarz auf dunklem Grund sichtbar). Zeigt NUR die Farbe – der Füllstand steht im Balken (FillBar).
 */
export function ColorRing({ rgba, size = 44, label }: Props) {
  const c = size / 2;
  const r = c - 1.5;
  const color = rgbaToCss(rgba);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} style={{ flex: 'none' }}>
      {/* Spule: Filamentfarbe */}
      <circle cx={c} cy={c} r={r} fill={color} stroke="var(--bs-text-2)" strokeOpacity={0.45} strokeWidth={1.5} />
      {/* Flansch-Andeutung: dezenter Innenring, damit es nach Spule aussieht */}
      <circle cx={c} cy={c} r={r * 0.62} fill="none" stroke="var(--bs-text-2)" strokeOpacity={0.18} strokeWidth={1} />
      {/* Nabe */}
      <circle cx={c} cy={c} r={r * 0.24} fill="var(--bs-surface)" stroke="var(--bs-text-2)" strokeOpacity={0.45} strokeWidth={1.5} />
    </svg>
  );
}
