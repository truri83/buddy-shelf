import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { copyOutline, createOutline, cubeOutline, locationOutline, pricetagOutline, scaleOutline } from 'ionicons/icons';
import { useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { assignmentLabel, fillRatio, remainingGrams, useAllowed } from '@/core/api';
import { t } from '@/core/i18n';
import { encodeSpoolCode } from '@/core/qr/codes';
import { ColorRing, FillBar, MaterialBadge, StateView } from '@/core/ui';
import { AmsSheet } from '../components/AmsSheet';
import { LabelSheet } from '../components/LabelSheet';
import { MoveSheet } from '../components/MoveSheet';
import { WeighSheet } from '../components/WeighSheet';
import { useAssignments, useLocations, useSpool } from '../hooks/useSpools';
import { isLow, locationName } from '../logic';

/** Vorlage „Detail“: Kopf-Karte mit Kennzahl, Aktionsleiste, Abschnitte. */
export function SpoolDetailPage() {
  const { id } = useParams();
  const spoolId = Number(id);
  const spool = useSpool(spoolId);
  const locations = useLocations();
  const assignments = useAssignments();
  const canEdit = useAllowed('inventory:update');
  const [sheet, setSheet] = useState<'ams' | 'move' | 'weigh' | 'label' | null>(null);
  const close = () => setSheet(null);
  const assignment = assignments.data?.find((a) => a.spool_id === spoolId);
  const ams = assignment ? assignmentLabel(assignment) : null;

  const s = spool.data;
  const name = s ? (s.color_name ?? s.subtype ?? s.material) : '';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/spools" text="" />
          </IonButtons>
          <IonTitle>{s ? `#${s.id} ${name}` : ''}</IonTitle>
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
            <section style={{ display: 'flex', gap: 'var(--bs-s4)', alignItems: 'center', padding: 'var(--bs-s4)' }}>
              <ColorRing rgba={s.rgba} fill={fillRatio(s)} size={72} label={name} />
              <div style={{ flex: 1, display: 'grid', gap: 'var(--bs-s2)' }}>
                <div className="bs-num" style={{ fontSize: 'var(--bs-fs-largetitle)', fontWeight: 700 }}>
                  {remainingGrams(s)} g
                  <span style={{ fontSize: 'var(--bs-fs-caption)', color: 'var(--bs-text-2)', fontWeight: 400 }}> / {s.label_weight} g</span>
                </div>
                <FillBar fill={fillRatio(s)} low={isLow(s)} />
                <div>
                  <MaterialBadge material={[s.material, s.subtype].filter(Boolean).join(' ')} />
                </div>
              </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--bs-s2)', padding: '0 var(--bs-s4)' }}>
              {(
                [
                  [cubeOutline, 'spools.action.toAms', 'ams', true],
                  [locationOutline, 'spools.action.move', 'move', true],
                  [scaleOutline, 'spools.action.weigh', 'weigh', true],
                  [pricetagOutline, 'spools.action.label', 'label', false],
                ] as const
              ).map(([icon, key, target, needsEdit]) => (
                <IonButton
                  key={key}
                  fill="outline"
                  expand="block"
                  disabled={needsEdit && !canEdit}
                  title={needsEdit && !canEdit ? t('common.noPermission') : undefined}
                  onClick={() => setSheet(target)}
                  style={{ minHeight: 'var(--bs-touch)', '--padding-start': 'var(--bs-s1)', '--padding-end': 'var(--bs-s1)' } as CSSProperties}
                >
                  <div style={{ display: 'grid', justifyItems: 'center', gap: 'var(--bs-s1)' }}>
                    <IonIcon icon={icon} />
                    <span style={{ fontSize: 'var(--bs-fs-caption)', whiteSpace: 'nowrap' }}>{t(key)}</span>
                  </div>
                </IonButton>
              ))}
            </div>

            <IonList inset>
              <IonItem>
                <IonLabel color="medium">{t('spools.detail.brand')}</IonLabel>
                <IonLabel slot="end">{s.brand ?? '–'}</IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel color="medium">{t('spools.detail.location')}</IonLabel>
                <IonLabel slot="end">{locationName(s, locations.data ?? []) ?? '–'}</IonLabel>
              </IonItem>
              {ams && (
                <IonItem>
                  <IonLabel color="medium">AMS</IonLabel>
                  <IonLabel slot="end">{ams}</IonLabel>
                </IonItem>
              )}
              <IonItem>
                <IonLabel color="medium">{t('new.colorHex')}</IonLabel>
                <IonLabel slot="end" className="bs-num">
                  {s.rgba ? `#${s.rgba.slice(0, 6)}` : '–'}
                </IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel color="medium">{s.category === 'Refill' ? t('new.refillCore') : t('spools.detail.emptyWeight')}</IonLabel>
                <IonLabel slot="end" className="bs-num">
                  {s.core_weight} g
                </IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel color="medium">{t('spools.detail.gross')}</IonLabel>
                <IonLabel slot="end" className="bs-num">
                  {remainingGrams(s) + s.core_weight} g
                </IonLabel>
              </IonItem>
              <IonItem lines="none">
                <IonLabel color="medium">{t('spools.detail.code')}</IonLabel>
                <IonLabel slot="end" className="bs-num">
                  {encodeSpoolCode(s.id)}
                </IonLabel>
              </IonItem>
            </IonList>
            <AmsSheet spool={s} isOpen={sheet === 'ams'} onDismiss={close} />
            <MoveSheet spool={s} isOpen={sheet === 'move'} onDismiss={close} />
            <WeighSheet spool={s} isOpen={sheet === 'weigh'} onDismiss={close} />
            <LabelSheet spools={[s]} isOpen={sheet === 'label'} onDismiss={close} />
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
