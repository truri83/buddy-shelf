interface Props {
  /** 0–1 */
  fill: number;
  low?: boolean;
}

export function FillBar({ fill, low }: Props) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fill * 100)}
      style={{ height: 6, borderRadius: 3, background: 'var(--bs-surface-2)', overflow: 'hidden' }}
    >
      <div
        style={{
          width: `${Math.round(fill * 100)}%`,
          height: '100%',
          borderRadius: 3,
          background: low ? 'var(--bs-warn)' : 'var(--bs-text-2)',
        }}
      />
    </div>
  );
}
