import { IonItem } from '@ionic/react';
import { fillRatio, remainingGrams, type Spool } from '@/core/api';
import { t } from '@/core/i18n';
import { Badge, ColorRing, FillBar, MaterialBadge } from '@/core/ui';
import { isLow } from '../logic';

interface Props {
  spool: Spool;
  location: string | null;
  ams: string | null;
}

/** Spulenkarte nach Vorbild Spooly: Farbring, Name, Badges, Füllbalken, Gramm. */
export function SpoolCard({ spool, location, ams }: Props) {
  const fill = fillRatio(spool);
  const low = isLow(spool);
  const name = spool.color_name ?? spool.subtype ?? spool.material;
  return (
    <IonItem routerLink={`/spools/${spool.id}`} detail={false} lines="full">
      <div style={{ display: 'flex', gap: 'var(--bs-s3)', alignItems: 'center', width: '100%', padding: 'var(--bs-s3) 0' }}>
        <ColorRing rgba={spool.rgba} fill={fill} label={name} />
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 'var(--bs-s1)' }}>
          <div style={{ display: 'flex', gap: 'var(--bs-s2)', alignItems: 'baseline' }}>
            <span className="bs-num" style={{ color: 'var(--bs-accent)', fontSize: 'var(--bs-fs-caption)' }}>
              #{spool.id}
            </span>
            <strong style={{ fontSize: 'var(--bs-fs-title)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</strong>
          </div>
          <div style={{ display: 'flex', gap: 'var(--bs-s1)', flexWrap: 'wrap' }}>
            <MaterialBadge material={[spool.material, spool.subtype].filter(Boolean).join(' ')} />
            {ams && <Badge tone="good">{ams}</Badge>}
            {low && <Badge tone="warn">{t('spools.low')}</Badge>}
          </div>
          <div style={{ fontSize: 'var(--bs-fs-caption)', color: 'var(--bs-text-2)' }}>
            {[spool.brand, location].filter(Boolean).join(' · ')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--bs-s2)' }}>
            <div style={{ flex: 1 }}>
              <FillBar fill={fill} low={low} />
            </div>
            <span className="bs-num" style={{ fontSize: 'var(--bs-fs-caption)', minWidth: 84, textAlign: 'right' }}>
              {remainingGrams(spool)} g · {Math.round(fill * 100)} %
            </span>
          </div>
        </div>
      </div>
    </IonItem>
  );
}
