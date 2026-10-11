import { rgbaToCss } from '../material';

interface Props {
  rgba: string | null;
  /** 0–1 */
  fill: number;
  size?: number;
  label: string;
}

/** Farbring: Filamentfarbe als Scheibe (mit Kontur, damit Schwarz/Weiß in beiden Modi sichtbar sind), Füllstand als Bogen. */
export function ColorRing({ rgba, fill, size = 44, label }: Props) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const color = rgbaToCss(rgba);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bs-surface-2)" strokeWidth={4} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--bs-text-2)"
        strokeWidth={4}
        strokeDasharray={`${c * fill} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <circle cx={size / 2} cy={size / 2} r={r - 7} fill={color} stroke="var(--bs-text-2)" strokeOpacity={0.45} strokeWidth={1.5} />
    </svg>
  );
}
