import type { ReactNode } from 'react';
import { materialToken } from '../material';

interface Props {
  children: ReactNode;
  tone?: 'neutral' | 'warn' | 'critical' | 'good';
  color?: string;
}

/** Status- und Material-Badge. Farben nur aus Tokens. */
export function Badge({ children, tone = 'neutral', color }: Props) {
  const c = color ?? (tone === 'neutral' ? 'var(--bs-text-2)' : `var(--bs-${tone})`);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--bs-r-sm)',
        border: `1px solid color-mix(in srgb, ${c} 45%, transparent)`,
        color: c,
        background: `color-mix(in srgb, ${c} 12%, transparent)`,
        fontSize: 'var(--bs-fs-caption)',
        fontWeight: 600,
        lineHeight: '18px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function MaterialBadge({ material }: { material: string }) {
  return <Badge color={materialToken(material)}>{material.toUpperCase()}</Badge>;
}
