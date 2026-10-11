/** Baustein „Kennzahl-Kachel“: große Zahl, kleine Beschriftung, optional Warnton. */
export function StatTile({ value, label, tone }: { value: string | number; label: string; tone?: 'warn' }) {
  return (
    <div
      style={{
        background: 'var(--bs-surface)',
        borderRadius: 'var(--bs-r-lg)',
        padding: 'var(--bs-s3) var(--bs-s4)',
        display: 'grid',
        gap: 'var(--bs-s1)',
        minWidth: 0,
      }}
    >
      <span className="bs-num" style={{ fontSize: 'var(--bs-fs-title)', fontWeight: 700, color: tone === 'warn' ? 'var(--bs-warn)' : 'var(--bs-text)' }}>
        {value}
      </span>
      <span style={{ fontSize: 'var(--bs-fs-caption)', color: 'var(--bs-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </div>
  );
}
