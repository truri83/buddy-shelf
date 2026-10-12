interface Props {
  /** 0–1 */
  fill: number;
  /** unter der Warnschwelle */
  low?: boolean;
  height?: number;
}

/** Ab hier gilt die Spule als fast leer (rot). */
export const EMPTY_FILL = 0.05;

/**
 * Füllstand in Statusfarbe: grün = ausreichend, gelb = niedrig, rot = fast leer.
 * Die Filamentfarbe zeigt ausschließlich das Spulen-Symbol (ColorRing) – nie der Balken.
 */
export function FillBar({ fill, low, height = 6 }: Props) {
  const bar = fill <= EMPTY_FILL ? 'var(--bs-critical)' : low ? 'var(--bs-warn)' : 'var(--bs-good)';
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
