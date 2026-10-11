import { rgbaToCss } from '../material';

interface Props {
  /** 0–1 */
  fill: number;
  low?: boolean;
  /** Filamentfarbe (RRGGBBAA) – füllt den Balken wie bei Spooly; ohne Angabe neutral */
  rgba?: string | null;
  height?: number;
}

export function FillBar({ fill, low, rgba, height = 6 }: Props) {
  const bar = rgba ? rgbaToCss(rgba) : low ? 'var(--bs-warn)' : 'var(--bs-text-2)';
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fill * 100)}
      style={{ height, borderRadius: height / 2, background: 'var(--bs-surface-2)', overflow: 'hidden' }}
    >
      <div
        className="bs-fill"
        style={{
          width: `${Math.round(fill * 100)}%`,
          height: '100%',
          borderRadius: height / 2,
          background: bar,
          // Kontur, damit Weiß/Schwarz auf hellem bzw. dunklem Grund sichtbar bleiben
          boxShadow: rgba ? 'inset 0 0 0 1px color-mix(in srgb, var(--bs-text-2) 45%, transparent)' : undefined,
        }}
      />
    </div>
  );
}
