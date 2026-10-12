import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonActionSheet,
  useIonToast,
} from '@ionic/react';
import { copyOutline, createOutline, cubeOutline, locationOutline, pricetagOutline, scaleOutline } from 'ionicons/icons';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { assignmentLabel, fillRatio, remainingGrams, useAllowed } from '@/core/api';
import { fmtDate, fmtNum, otherLanguageName, t } from '@/core/i18n';
import { encodeSpoolCode } from '@/core/qr/codes';
import { Badge, ColorRing, FillBar, MaterialBadge, rgbaToCss, StateView } from '@/core/ui';
import { AmsSheet } from '../components/AmsSheet';
import { DryingCard } from '../components/DryingCard';
import { LabelSheet } from '../components/LabelSheet';
import { MoveSheet } from '../components/MoveSheet';
import { WeighSheet } from '../components/WeighSheet';
import { todayIso } from '../drying';
import { useAssignments, useLocations, useSetExtras, useSpool } from '../hooks/useSpools';
import { isLow, locationName } from '../logic';

type Sheet = 'ams' | 'move' | 'weigh' | 'label';
const SHEETS: readonly Sheet[] = ['ams', 'move', 'weigh', 'label'];

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

/** Vorlage „Detail“ nach Vorbild Spooly: Kopf-Karte mit Füllstand, Aktionen, Übersichtsraster. */
export function SpoolDetailPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const spoolId = Number(id);
  const spool = useSpool(spoolId);
  const locations = useLocations();
  const assignments = useAssignments();
  const canEdit = useAllowed('inventory:update');
  const setExtras = useSetExtras();
  // ?action=weigh usw. kommt aus dem ⋮-Menü der Spulenliste
  const [sheet, setSheet] = useState<Sheet | null>(() => {
    const a = params.get('action') as Sheet | null;
    return a && SHEETS.includes(a) ? a : null;
  });
  const close = () => {
    setSheet(null);
    if (params.has('action')) setParams({}, { replace: true }); // beim Neuladen nicht erneut öffnen
  };

  // SP-17: Spulen-Etikett gescannt → Schnellmenü statt nur Detailseite
  const [present] = useIonActionSheet();
  const [toast] = useIonToast();
  const quickShown = useRef(false);
  useEffect(() => {
    const s = spool.data;
    if (params.get('action') !== 'quick' || !s || quickShown.current) return;
    quickShown.current = true;
    const pick = (target: Sheet) => () => setSheet(target);
    void present({
      header: `#${s.id} ${s.color_name ?? [s.material, s.subtype].filter(Boolean).join(' ')}`,
      buttons: [
        ...(canEdit
          ? [
              { text: t('spools.action.weigh'), handler: pick('weigh') },
              {
                text: t('dry.markToday'),
                handler: () =>
                  void setExtras
                    .mutateAsync({ ids: [s.id], patch: { dried_at: todayIso() } })
                    .then(() => void toast({ message: t('dry.marked', { id: s.id }), duration: 2000, position: 'top' })),
              },
              { text: t('spools.action.toAms'), handler: pick('ams') },
              { text: t('spools.action.move'), handler: pick('move') },
            ]
          : []),
        { text: t('spools.action.label'), handler: pick('label') },
        { text: t('quick.details'), role: 'cancel' },
      ],
      onDidDismiss: (e) => {
        // „Details“/Wischen: Parameter weg; bei einem Blatt räumt dessen Schließen auf
        if (e.detail.role === 'cancel' || e.detail.role === 'backdrop') setParams({}, { replace: true });
      },
    });
  }, [spool.data, params, present, canEdit, setExtras, toast, setParams]);
  const assignment = assignments.data?.find((a) => a.spool_id === spoolId);
  const ams = assignment ? assignmentLabel(assignment) : null;

  const s = spool.data;
  // ohne Farbnamen: „ASA Basic“ statt nur „Basic“
  const name = s ? (s.color_name ?? [s.material, s.subtype].filter(Boolean).join(' ')) : '';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/spools" text="" />
          </IonButtons>
          <IonTitle>{s ? `#${s.id}` : ''}</IonTitle>
          {s && canEdit && (
            <IonButtons slot="end">
              <IonButton routerLink={`/spools/${s.id}/edit`} aria-label={t('spools.action.edit')}>
                <IonIcon slot="icon-only" icon={createOutline} />
              </IonButton>
              <IonButton routerLink={`/spools/new?from=${s.id}`} aria-label={t('spools.action.duplicate')}>
                <IonIcon slot="icon-only" icon={copyOutline} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {!(spoolId > 0) ? (
          <StateView state="error" message={t('scan.unknown')} />
        ) : spool.isPending ? (
          <StateView state="loading" />
        ) : spool.isError || !s ? (
          <StateView state="error" onRetry={() => void spool.refetch()} />
        ) : (
          <>
            <section style={{ ...card, display: 'grid', gap: 'var(--bs-s3)' }}>
              <div style={{ display: 'flex', gap: 'var(--bs-s4)', alignItems: 'center' }}>
                <ColorRing rgba={s.rgba} fill={fillRatio(s)} size={84} label={name} />
                <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 'var(--bs-s1)' }}>
                  <strong style={{ fontSize: 'var(--bs-fs-title)' }}>{name}</strong>
                  {s.brand && <span style={{ color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)' }}>{s.brand}</span>}
                  <div style={{ display: 'flex', gap: 'var(--bs-s1)', flexWrap: 'wrap' }}>
                    <MaterialBadge material={[s.material, s.subtype].filter(Boolean).join(' ')} />
                    {s.category === 'Refill' && <Badge>{t('new.kind.refill')}</Badge>}
                    {ams && <Badge tone="good">{ams}</Badge>}
                    {isLow(s) && <Badge tone="warn">{t('spools.low')}</Badge>}
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
                <span className="bs-num" style={{ fontWeight: 600, color: isLow(s) ? 'var(--bs-warn)' : 'var(--bs-text-2)' }}>
                  {Math.round(fillRatio(s) * 100)} %
                </span>
              </div>
              <FillBar fill={fillRatio(s)} low={isLow(s)} rgba={s.rgba} height={10} />
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--bs-s2)', padding: '0 var(--bs-s3)' }}>
              {(
                [
                  [scaleOutline, 'spools.action.weigh', 'weigh', true],
                  [cubeOutline, 'spools.action.toAms', 'ams', true],
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
                  title={needsEdit && !canEdit ? t('common.noPermission') : undefined}
                  onClick={() => setSheet(target)}
                  style={
                    {
                      margin: 0,
                      minHeight: 56,
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
                          borderRadius: 4,
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
                <Field label={t('spools.detail.location')}>{locationName(s, locations.data ?? []) ?? '–'}</Field>
                <Field label="AMS">{ams ?? '–'}</Field>
                <Field label={s.category === 'Refill' ? t('new.refillCore') : t('spools.detail.emptyWeight')}>
                  <span className="bs-num">{fmtNum(s.core_weight)} g</span>
                </Field>
                <Field label={t('spools.detail.gross')}>
                  <span className="bs-num">{fmtNum(remainingGrams(s) + s.core_weight)} g</span>
                </Field>
                <Field label={t('spools.detail.articleNo')}>
                  <span className="bs-num">{s.material_number ?? '–'}</span>
                </Field>
                <Field label={t('spools.detail.code')}>
                  <span className="bs-num">{encodeSpoolCode(s.id)}</span>
                </Field>
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
                            void setExtras.mutate({ ids: [s.id], patch: { label_printed_at: s.label_printed_at ? null : todayIso() } })
                          }
                        >
                          {s.label_printed_at ? t('labels.markNone') : t('labels.markHas')}
                        </IonButton>
                      </div>
                    )}
                  </Field>
                )}
              </div>
            </section>
            <AmsSheet spool={s} isOpen={sheet === 'ams'} onDismiss={close} />
            <MoveSheet spools={[s]} isOpen={sheet === 'move'} onDismiss={close} />
            <WeighSheet spool={s} isOpen={sheet === 'weigh'} onDismiss={close} />
            <LabelSheet spools={[s]} isOpen={sheet === 'label'} onDismiss={close} />
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
