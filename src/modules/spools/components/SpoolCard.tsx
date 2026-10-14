import { IonButton, IonCard, IonCheckbox, IonIcon, useIonActionSheet } from '@ionic/react';
import { ellipsisVertical, locationOutline } from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import { fillRatio, remainingGrams, type Spool } from '@/core/api';
import { fmtNum, t } from '@/core/i18n';
import { primeKeyboard } from '@/core/platform';
import { Badge, ColorRing, FillBar, MaterialBadge, MoistureLight, useNotify } from '@/core/ui';
import { materialLabel, moistureState, stockLevel, todayIso, useDisplayConfig, useDryingConfig } from '@/core/filament';
import { useSetExtras } from '../hooks/useSpools';
import { fmtMoney, LEVEL_TEXT } from '../stock';

interface Props {
  spool: Spool;
  location: string | null;
  /** eigenes Symbol des Lagerorts */
  locationIcon?: string;
  ams: string | null;
  canEdit?: boolean;
  /** Auswahlmodus: Tippen wählt statt zu öffnen */
  selecting?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  /** Desktop: Karte wählt die Spule für die Detail-Kachel, statt die Seite zu wechseln */
  onOpen?: () => void;
  /** gerade in der Detail-Kachel */
  active?: boolean;
}

/** Spulenkarte nach Vorbild Spooly: Farbring, Name, Badges, Füllbalken in Filamentfarbe, ⋮-Menü. */
export function SpoolCard({ spool, location, locationIcon, ams, canEdit, selecting, selected, onToggle, onOpen, active }: Props) {
  const fill = fillRatio(spool);
  const display = useDisplayConfig();
  const level = stockLevel(spool, display);
  const dryCfg = useDryingConfig();
  // Feuchtigkeits-Ampel aus zuletzt getrocknet + Lagerungsart (Erklärung beim Darüberfahren)
  const moisture = display.showDrying ? moistureState(spool, dryCfg) : null;
  const price = display.showPrice && spool.cost_per_kg != null ? (spool.cost_per_kg * spool.label_weight) / 1000 : null;
  const name = spool.color_name ?? [spool.material, spool.subtype].filter(Boolean).join(' ');
  const navigate = useNavigate();
  const [present] = useIonActionSheet();
  const notify = useNotify();
  const setExtras = useSetExtras();
  const markDried = () =>
    setExtras
      .mutateAsync({ ids: [spool.id], patch: { dried_at: todayIso() } })
      .then(() => notify.ok(t('dry.marked', { id: spool.id })))
      .catch(notify.fail);

  // Aktionen öffnen die Detailseite mit dem passenden Blatt (?action=…)
  const openMenu = () =>
    void present({
      header: `#${spool.id} ${name}`,
      buttons: [
        ...(canEdit
          ? [
              { text: t('spools.action.weigh'), handler: () => (primeKeyboard(), navigate(`/spools/${spool.id}?action=weigh`)) },
              { text: t('dry.markToday'), handler: () => void markDried() },
              { text: t('spools.action.toAms'), handler: () => navigate(`/spools/${spool.id}?action=ams`) },
              { text: t('spools.action.move'), handler: () => navigate(`/spools/${spool.id}?action=move`) },
            ]
          : []),
        { text: t('spools.action.label'), handler: () => navigate(`/spools/${spool.id}?action=label`) },
        ...(canEdit ? [{ text: t('spools.action.edit'), handler: () => navigate(`/spools/${spool.id}/edit`) }] : []),
        { text: t('common.cancel'), role: 'cancel' },
      ],
    });

  return (
    <IonCard
      routerLink={selecting || onOpen ? undefined : `/spools/${spool.id}`}
      button={selecting || !!onOpen}
      onClick={selecting ? onToggle : onOpen}
      aria-pressed={selecting ? selected : undefined}
      className="bs-card"
      style={{
        margin: 'var(--bs-s2) var(--bs-s3)',
        borderRadius: 'var(--bs-r-md)',
        boxShadow: 'none',
        border: active ? '2px solid var(--bs-accent)' : '1px solid var(--bs-border)',
      }}
    >
      <div style={{ display: 'grid', gap: 'var(--bs-s2)', padding: 'var(--bs-s3)', color: 'var(--bs-text)' }}>
        <div style={{ display: 'flex', gap: 'var(--bs-s3)', alignItems: 'center' }}>
          {selecting && <IonCheckbox checked={selected} aria-label={`#${spool.id}`} style={{ pointerEvents: 'none' }} />}
          <ColorRing rgba={spool.rgba} label={name} />
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
            <strong style={{ fontSize: 'var(--bs-fs-title)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </strong>
            <span
              style={{
                fontSize: 'var(--bs-fs-caption)',
                color: 'var(--bs-text-2)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <span className="bs-num" style={{ color: 'var(--bs-accent)' }}>
                #{spool.id}
              </span>
              {spool.brand && ` · ${spool.brand}`}
            </span>
          </div>
          {!selecting && (
            <IonButton
              fill="clear"
              color="medium"
              aria-label={t('spools.actions')}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openMenu();
              }}
              style={{ margin: 0, minHeight: 'var(--bs-touch)' }}
            >
              <IonIcon slot="icon-only" icon={ellipsisVertical} />
            </IonButton>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--bs-s1)', flexWrap: 'wrap', alignItems: 'center' }}>
          <MaterialBadge material={materialLabel(spool)} />
          {spool.category === 'Refill' && <Badge>{t('new.kind.refill')}</Badge>}
          {spool.material_number && <Badge>{spool.material_number}</Badge>}
          {ams && <Badge tone="good">{ams}</Badge>}
          {level !== 'ok' && <Badge tone={level === 'empty' ? 'critical' : 'warn'}>{t(`stock.${level}`)}</Badge>}
          {display.showDrying && moisture && <MoistureLight {...moisture} />}
          {price != null && (
            <span className="bs-num" style={{ fontSize: 'var(--bs-fs-caption)', color: 'var(--bs-text-2)' }}>
              {t('stock.price', { eur: fmtMoney(price) })}
            </span>
          )}
          {location && (
            <span
              style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 'var(--bs-fs-caption)', color: 'var(--bs-text-2)' }}
            >
              {locationIcon ? <span aria-hidden>{locationIcon}</span> : <IonIcon icon={locationOutline} aria-hidden />}
              {location}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--bs-s3)' }}>
          <div style={{ flex: 1 }}>
            <FillBar fill={fill} level={level} signal={display.signalColors} height={8} />
          </div>
          <span className="bs-num" style={{ fontSize: 'var(--bs-fs-caption)', whiteSpace: 'nowrap' }}>
            <strong>{fmtNum(remainingGrams(spool))} g</strong>
            <span style={{ color: LEVEL_TEXT[level] }}> · {Math.round(fill * 100)} %</span>
          </span>
        </div>
      </div>
    </IonCard>
  );
}
