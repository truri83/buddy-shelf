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
import { copyOutline, createOutline } from 'ionicons/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAllowed } from '@/core/api';
import { todayIso } from '@/core/filament';
import { t } from '@/core/i18n';
import { StateView } from '@/core/ui';
import { DETAIL_SHEETS, SpoolDetailView, type DetailSheet } from '../components/SpoolDetailView';
import { useSetExtras, useSpool } from '../hooks/useSpools';

/** Detailseite (Handy). Inhalt: SpoolDetailView – derselbe wie in der Detail-Kachel am Desktop. */
export function SpoolDetailPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const spoolId = Number(id);
  const spool = useSpool(spoolId);
  const canEdit = useAllowed('inventory:update');
  const setExtras = useSetExtras();
  // ?action=weigh usw. kommt aus dem ⋮-Menü der Spulenliste
  const [sheet, setSheet] = useState<DetailSheet | null>(() => {
    const a = params.get('action') as DetailSheet | null;
    return a && DETAIL_SHEETS.includes(a) ? a : null;
  });
  const onSheet = (next: DetailSheet | null) => {
    setSheet(next);
    if (!next && params.has('action')) setParams({}, { replace: true }); // beim Neuladen nicht erneut öffnen
  };

  // SP-17: Spulen-Etikett gescannt → Schnellmenü statt nur Detailseite
  const [present] = useIonActionSheet();
  const [toast] = useIonToast();
  const navigate = useNavigate();
  const fail = useCallback(
    (e: unknown) =>
      void toast({
        message: t('common.failed', { msg: e instanceof Error ? e.message : String(e) }),
        duration: 3000,
        position: 'top',
        color: 'danger',
      }),
    [toast],
  );
  const quickShown = useRef(false);
  useEffect(() => {
    const s = spool.data;
    if (params.get('action') !== 'quick' || !s || quickShown.current) return;
    quickShown.current = true;
    const pick = (target: DetailSheet) => () => setSheet(target);
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
                    .then(() => void toast({ message: t('dry.marked', { id: s.id }), duration: 2000, position: 'top' }))
                    .catch(fail),
              },
              { text: t('spools.action.toAms'), handler: pick('ams') },
              { text: t('spools.action.move'), handler: pick('move') },
            ]
          : []),
        { text: t('spools.action.label'), handler: pick('label') },
        ...(canEdit ? [{ text: t('spools.action.edit'), handler: () => navigate(`/spools/${s.id}/edit`) }] : []),
        { text: t('quick.details'), role: 'cancel' },
      ],
      onDidDismiss: (e) => {
        // „Details“/Wischen: Parameter weg; bei einem Blatt räumt dessen Schließen auf
        if (e.detail.role === 'cancel' || e.detail.role === 'backdrop') setParams({}, { replace: true });
      },
    });
  }, [spool.data, params, present, canEdit, setExtras, toast, setParams, navigate, fail]);

  const s = spool.data;

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
      <IonContent className="bs-medium">
        {!(spoolId > 0) ? (
          <StateView state="error" message={t('scan.unknown')} />
        ) : spool.isPending ? (
          <StateView state="loading" />
        ) : spool.isError || !s ? (
          <StateView state="error" onRetry={() => void spool.refetch()} />
        ) : (
          <SpoolDetailView spool={s} sheet={sheet} onSheet={onSheet} />
        )}
      </IonContent>
    </IonPage>
  );
}
