import { IonButton, IonIcon } from '@ionic/react';
import { cartOutline, gridOutline, locationOutline, pricetagOutline, scaleOutline } from 'ionicons/icons';
import type { CSSProperties, ReactNode } from 'react';
import { assignmentLabel, fillRatio, remainingGrams, useAllowed, type Spool } from '@/core/api';
import { materialLabel, stockLevel, todayIso, useDisplayConfig } from '@/core/filament';
import { primeKeyboard } from '@/core/platform';
import { fmtDate, fmtNum, otherLanguageName, t } from '@/core/i18n';
import { Badge, ColorRing, FillBar, MaterialBadge, rgbaToCss, useNotify } from '@/core/ui';
import { useAssignments, useLocations, useSetExtras } from '../hooks/useSpools';
import { locationName } from '../logic';
import { fmtMoney, LEVEL_TEXT } from '../stock';
import { useLocationPrefs } from '../hooks/useLocationPrefs';
import { locationText } from '../locationPrefs';
import { AmsSheet } from './AmsSheet';
import { DryingCard } from './DryingCard';
import { LabelSheet } from './LabelSheet';
import { MoveSheet } from './MoveSheet';
import { ProfileCard } from './ProfileCard';
import { WeighSheet } from './WeighSheet';

export type DetailSheet = 'ams' | 'move' | 'weigh' | 'label';
export const DETAIL_SHEETS: readonly DetailSheet[] = ['ams', 'move', 'weigh', 'label'];

const card: CSSProperties = {
  margin: 'var(--bs-s3)',
  padding: 'var(--bs-s4)',
  borderRadius: 'var(--bs-r-md)',
  background: 'var(--bs-surface)',
  border: '1px solid var(--bs-border)',
};

/** Ein Feld im Übersichtsraster: kleine Beschriftung, Wert darunter. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 'var(--bs-fs-caption)', color: 'var(--bs-text-2)' }}>{label}</div>
      <div style={{ fontSize: 'var(--bs-fs-body)', overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  );
}

/**
 * Inhalt der Spulen-Details (Vorbild Spooly): Kopf-Karte mit Füllstand, Aktionen, Trocknung, Übersicht.
 * Genutzt von der Detailseite (Handy) und der Detail-Kachel neben der Liste (Desktop).
 * Breit genug (Container ≥ 760 px) → zwei Spalten.
 */
export function SpoolDetailView({
  spool: s,
  sheet,
  onSheet,
}: {
  spool: Spool;
  sheet: DetailSheet | null;
  onSheet: (s: DetailSheet | null) => void;
}) {
  const locations = useLocations();
  const display = useDisplayConfig();
  const locationPrefs = useLocationPrefs();
  const assignments = useAssignments();
  const canEdit = useAllowed('inventory:update');
  const setExtras = useSetExtras();
  const notify = useNotify();
  const assignment = assignments.data?.find((a) => a.spool_id === s.id);
  const ams = assignment ? assignmentLabel(assignment) : null;
  const level = stockLevel(s, display);
  // ohne Farbnamen: „ASA Basic“ statt nur „Basic“
  const name = s.color_name ?? [s.material, s.subtype].filter(Boolean).join(' ');
  const close = () => onSheet(null);

  return (
    <div className="bs-detail">
      <div className="bs-detail-grid">
        <div>
          <section style={{ ...card, display: 'grid', gap: 'var(--bs-s3)' }}>
            <div style={{ display: 'flex', gap: 'var(--bs-s4)', alignItems: 'center' }}>
              <ColorRing rgba={s.rgba} size={84} label={name} />
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 'var(--bs-s1)' }}>
                <strong style={{ fontSize: 'var(--bs-fs-title)' }}>{name}</strong>
                {s.brand && <span style={{ color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)' }}>{s.brand}</span>}
                <div style={{ display: 'flex', gap: 'var(--bs-s1)', flexWrap: 'wrap' }}>
                  <MaterialBadge material={materialLabel(s)} />
                  {s.category === 'Refill' && <Badge>{t('new.kind.refill')}</Badge>}
                  {ams && <Badge tone="good">{ams}</Badge>}
                  {level !== 'ok' && <Badge tone={level === 'empty' ? 'critical' : 'warn'}>{t(`stock.${level}`)}</Badge>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--bs-s2)' }}>
              <span className="bs-num" style={{ fontSize: 'var(--bs-fs-largetitle)', fontWeight: 700 }}>
                {fmtNum(remainingGrams(s))} g
              </span>
              <span className="bs-num" style={{ flex: 1, color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)' }}>
                {t('spools.detail.ofLabel', { g: fmtNum(s.label_weight) })}
              </span>
              <span className="bs-num" style={{ fontWeight: 600, color: LEVEL_TEXT[level] }}>
                {Math.round(fillRatio(s) * 100)} %
              </span>
            </div>
            <FillBar fill={fillRatio(s)} level={level} signal={display.signalColors} height={10} />
            {level === 'empty' && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--bs-s1)',
                  color: 'var(--bs-critical)',
                  fontSize: 'var(--bs-fs-caption)',
                }}
              >
                <IonIcon icon={cartOutline} aria-hidden />
                {t('stock.reorder')}
              </span>
            )}
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--bs-s2)', padding: '0 var(--bs-s3)' }}>
            {(
              [
                [scaleOutline, 'spools.action.weigh', 'weigh', true],
                [gridOutline, 'spools.action.toAms', 'ams', true],
                [locationOutline, 'spools.action.move', 'move', true],
                [pricetagOutline, 'spools.action.label', 'label', false],
              ] as const
            ).map(([icon, key, target, needsEdit]) => (
              <IonButton
                key={key}
                // Wiegen ist die häufigste Aktion → hervorgehoben
                fill={target === 'weigh' ? 'solid' : 'outline'}
                expand="block"
                disabled={needsEdit && !canEdit}
                onClick={() => {
                  if (target === 'weigh') primeKeyboard();
                  onSheet(target);
                }}
                style={
                  {
                    margin: 0,
                    minHeight: 'calc(var(--bs-touch) + var(--bs-s3))',
                    '--padding-start': 'var(--bs-s1)',
                    '--padding-end': 'var(--bs-s1)',
                    '--border-radius': 'var(--bs-r-md)',
                  } as CSSProperties
                }
              >
                <div style={{ display: 'grid', justifyItems: 'center', gap: 'var(--bs-s1)' }}>
                  <IonIcon icon={icon} />
                  <span style={{ fontSize: 'var(--bs-fs-caption)', whiteSpace: 'nowrap' }}>{t(key)}</span>
                </div>
              </IonButton>
            ))}
          </div>

          <DryingCard spool={s} canEdit={canEdit} style={card} />
        </div>

        <section style={card}>
          <h2 style={{ margin: '0 0 var(--bs-s3)', fontSize: 'var(--bs-fs-title)' }}>{t('spools.detail.overview')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--bs-s3) var(--bs-s4)' }}>
            <Field label={t('spools.detail.brand')}>{s.brand ?? '–'}</Field>
            <Field label={t('spools.detail.material')}>{[s.material, s.subtype].filter(Boolean).join(' ')}</Field>
            <Field label={t('spools.detail.colorName')}>
              {s.color_name ?? '–'}
              {otherLanguageName(s.color_name) && (
                <div style={{ color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)' }}>{otherLanguageName(s.color_name)}</div>
              )}
            </Field>
            <Field label={t('new.colorHex')}>
              {s.rgba ? (
                <span className="bs-num" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--bs-s2)' }}>
                  <span
                    aria-hidden
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 'var(--bs-r-sm)',
                      background: rgbaToCss(s.rgba),
                      border: '1px solid var(--bs-border)',
                    }}
                  />
                  #{s.rgba.slice(0, 6)}
                </span>
              ) : (
                '–'
              )}
            </Field>
            <Field label={t('spools.detail.location')}>
              {(() => {
                const name = locationName(s, locations.data ?? []);
                return name ? locationText(name, s.location_id != null ? locationPrefs.icons[s.location_id] : null) : '–';
              })()}
            </Field>
            <Field label={t('spools.detail.ams')}>{ams ?? '–'}</Field>
            <Field label={s.category === 'Refill' ? t('spools.detail.refillCore') : t('spools.detail.emptyWeight')}>
              <span className="bs-num">{fmtNum(s.core_weight)} g</span>
            </Field>
            <Field label={t('spools.detail.gross')}>
              <span className="bs-num">{fmtNum(remainingGrams(s) + s.core_weight)} g</span>
            </Field>
            <Field label={t('spools.detail.articleNo')}>
              <span className="bs-num">{s.material_number ?? '–'}</span>
            </Field>
            {s.cost_per_kg != null && (
              <Field label={t('spools.detail.price')}>
                <span className="bs-num">{t('spools.detail.priceValue', { eur: fmtMoney((s.cost_per_kg * s.label_weight) / 1000) })}</span>
              </Field>
            )}
            {s.label_printed_at !== undefined && (
              <Field label={t('labels.status')}>
                {s.label_printed_at ? t('labels.printedOn', { date: fmtDate(s.label_printed_at) }) : t('labels.none')}
                {canEdit && (
                  <div>
                    <IonButton
                      size="small"
                      fill="clear"
                      disabled={setExtras.isPending}
                      style={{ margin: 0, '--padding-start': 0 } as CSSProperties}
                      onClick={() =>
                        void setExtras
                          .mutateAsync({ ids: [s.id], patch: { label_printed_at: s.label_printed_at ? null : todayIso() } })
                          .then(() => notify.ok(t('common.saved')))
                          .catch(notify.fail)
                      }
                    >
                      {s.label_printed_at ? t('labels.markNone') : t('labels.markHas')}
                    </IonButton>
                  </div>
                )}
              </Field>
            )}
          </div>
          {s.note && (
            <div style={{ marginTop: 'var(--bs-s3)' }}>
              <Field label={t('new.notes')}>
                <span style={{ whiteSpace: 'pre-wrap' }}>{s.note}</span>
              </Field>
            </div>
          )}
        </section>

        <ProfileCard spool={s} style={card} />
      </div>
      <AmsSheet spool={s} isOpen={sheet === 'ams'} onDismiss={close} />
      <MoveSheet spools={[s]} isOpen={sheet === 'move'} onDismiss={close} />
      <WeighSheet spool={s} isOpen={sheet === 'weigh'} onDismiss={close} />
      <LabelSheet spools={[s]} isOpen={sheet === 'label'} onDismiss={close} />
    </div>
  );
}
