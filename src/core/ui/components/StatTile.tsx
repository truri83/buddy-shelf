import { IonIcon, IonRippleEffect } from '@ionic/react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

type Tone = 'warn' | 'critical' | 'good';

/** Baustein „Kennzahl-Kachel“: Symbol, große Zahl, kleine Beschriftung; Statusfarbe; optional Link. */
export function StatTile({
  value,
  label,
  tone,
  icon,
  to,
}: {
  value: string | number;
  label: string;
  tone?: Tone;
  icon?: string;
  to?: string;
}) {
  const color = tone ? `var(--bs-${tone})` : 'var(--bs-text)';
  const style: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    background: 'var(--bs-surface)',
    borderRadius: 'var(--bs-r-lg)',
    padding: 'var(--bs-s3) var(--bs-s4)',
    display: 'grid',
    gap: 'var(--bs-s1)',
    minWidth: 0,
    color: 'var(--bs-text)',
    textDecoration: 'none',
    border: tone ? `1px solid color-mix(in srgb, ${color} 35%, transparent)` : '1px solid transparent',
  };
  const body = (
    <>
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--bs-s1)' }}>
        {icon && <IonIcon icon={icon} aria-hidden style={{ fontSize: 18, color: tone ? color : 'var(--bs-accent)' }} />}
        <span className="bs-num" style={{ fontSize: 'var(--bs-fs-title)', fontWeight: 700, color }}>
          {value}
        </span>
      </span>
      <span
        style={{
          fontSize: 'var(--bs-fs-caption)',
          color: 'var(--bs-text-2)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </span>
    </>
  );
  return to ? (
    <Link to={to} className="ion-activatable bs-card" style={style}>
      {body}
      <IonRippleEffect />
    </Link>
  ) : (
    <div style={style}>{body}</div>
  );
}
