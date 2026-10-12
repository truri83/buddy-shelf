interface Props {
  /** 0–1 */
  fill: number;
  /** Stufe aus den Warnschwellen (core/filament stockLevel) */
  level?: 'ok' | 'low' | 'empty';
  /** Signalfarben grün/gelb/rot; aus = Akzentfarbe */
  signal?: boolean;
  height?: number;
}

const COLOR = { ok: 'var(--bs-good)', low: 'var(--bs-warn)', empty: 'var(--bs-critical)' } as const;

/**
 * Füllstand in Statusfarbe: grün = ausreichend, gelb = niedrig, rot = fast leer.
 * Die Filamentfarbe zeigt ausschließlich das Spulen-Symbol (ColorRing) – nie der Balken.
 */
export function FillBar({ fill, level = 'ok', signal = true, height = 6 }: Props) {
  const bar = signal ? COLOR[level] : 'var(--bs-accent)';
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fill * 100)}
      style={{ height, borderRadius: height / 2, background: 'var(--bs-surface-2)', overflow: 'hidden' }}
    >
      <div className="bs-fill" style={{ width: `${Math.round(fill * 100)}%`, height: '100%', borderRadius: height / 2, background: bar }} />
    </div>
  );
}
