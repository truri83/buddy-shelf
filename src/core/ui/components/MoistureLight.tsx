import { t } from '@/core/i18n';

type Level = 'dry' | 'soon' | 'due' | 'none';

const LIT: Record<Level, number> = { due: 0, soon: 1, dry: 2, none: -1 };
const COLORS = ['var(--bs-critical)', 'var(--bs-warn)', 'var(--bs-good)'];

/**
 * Feuchtigkeits-Ampel: drei Punkte (rot · gelb · grün), der zutreffende leuchtet; daneben die Kurzinfo.
 * Die ausführliche Erklärung steht im Tooltip (Hover) und für Screenreader.
 */
export function MoistureLight({ level, short, detail, compact }: { level: Level; short?: string; detail: string; compact?: boolean }) {
  const lit = LIT[level];
  return (
    <span
      title={`${t(`moist.level.${level}`)} – ${detail}`}
      aria-label={`${t(`moist.level.${level}`)}: ${detail}`}
      role="img"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--bs-s1)',
        fontSize: 'var(--bs-fs-caption)',
        color: 'var(--bs-text-2)',
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          gap: 2,
          padding: '2px 3px',
          borderRadius: 999,
          background: 'var(--bs-surface-2)',
          border: '1px solid var(--bs-border)',
        }}
      >
        {COLORS.map((c, i) => (
          <span
            key={c}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: i === lit ? c : 'transparent',
              border: `1px solid ${i === lit ? c : 'var(--bs-border)'}`,
              boxShadow: i === lit ? `0 0 4px ${c}` : 'none',
            }}
          />
        ))}
      </span>
      {!compact && short && (
        <span style={{ color: lit === 0 ? 'var(--bs-critical)' : lit === 1 ? 'var(--bs-warn)' : undefined }}>{short}</span>
      )}
    </span>
  );
}
