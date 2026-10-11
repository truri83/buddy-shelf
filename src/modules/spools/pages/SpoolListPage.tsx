import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  IonFooter,
  useIonAlert,
  useIonToast,
  type RefresherEventDetail,
} from '@ionic/react';
import {
  add,
  archiveOutline,
  checkmarkCircleOutline,
  locationOutline,
  pricetagOutline,
  scaleOutline,
  swapVerticalOutline,
} from 'ionicons/icons';
import { useMemo, useState } from 'react';
import { ApiError, useAllowed } from '@/core/api';
import { t } from '@/core/i18n';
import { storage } from '@/core/platform';
import { StateView } from '@/core/ui';
import { LabelSheet } from '../components/LabelSheet';
import { MoveSheet } from '../components/MoveSheet';
import { SpoolCard } from '../components/SpoolCard';
import { useAssignments, useBulkArchive, useLocations, useSlots, useSpools } from '../hooks/useSpools';
import { isNewRfid } from '../slots';
import { amsLabel, groupSpools, locationName, matchesSearch, sortSpools, type GroupBy, type SortBy } from '../logic';

/** Vorlage „Liste“: Kopf mit Suche, Filter-Chips, gruppierte Karten, Leer-Zustand. */
export function SpoolListPage() {
  const spools = useSpools();
  const locations = useLocations();
  const assignments = useAssignments();
  const { slots } = useSlots();
  const newRfid = slots.filter((x) => isNewRfid(x, spools.data ?? [])).length;
  const [query, setQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>(() => storage.get<GroupBy>('spools.groupBy', 'none'));
  const [sortBy, setSortBy] = useState<SortBy>(() => storage.get<SortBy>('spools.sortBy', 'id'));
  // SP-12 Mehrfachauswahl
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [sheet, setSheet] = useState<'labels' | 'move' | null>(null);
  const canEdit = useAllowed('inventory:update');
  const archive = useBulkArchive();
  const [alert] = useIonAlert();
  const [toast] = useIonToast();

  const groups = useMemo(() => {
    const list = sortSpools(
      (spools.data ?? []).filter((s) => matchesSearch(s, query)),
      sortBy,
    );
    return groupSpools(list, groupBy, locations.data ?? [], t('spools.noLocation'));
  }, [spools.data, locations.data, query, groupBy, sortBy]);

  const toggleSort = () => {
    const next: SortBy = sortBy === 'id' ? 'remaining' : 'id';
    setSortBy(next);
    storage.set('spools.sortBy', next);
  };

  const refresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await Promise.all([spools.refetch(), locations.refetch(), assignments.refetch()]);
    e.detail.complete();
  };

  const visible = useMemo(() => groups.flatMap((g) => g.spools), [groups]);
  const chosen = useMemo(() => visible.filter((x) => selected.has(x.id)), [visible, selected]);
  const toggle = (id: number) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const endSelect = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const archiveChosen = () =>
    void alert({
      header: t('select.archive'),
      message: t('select.archiveQ', { n: chosen.length }),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        {
          text: t('select.archive'),
          role: 'destructive',
          handler: () => {
            archive
              .mutateAsync(chosen.map((x) => x.id))
              .then((r) => {
                void toast({ message: t('select.archived', { n: r.archived }), duration: 2000, position: 'top' });
                endSelect();
              })
              .catch(
                (e: unknown) =>
                  void toast({
                    message: t('common.failed', { msg: e instanceof Error ? e.message : String(e) }),
                    duration: 3000,
                    position: 'top',
                    color: 'danger',
                  }),
              );
          },
        },
      ],
    });

  const amsBySpool = useMemo(() => new Map((assignments.data ?? []).map((a) => [a.spool_id, amsLabel(a)])), [assignments.data]);
  const count = groups.reduce((n, g) => n + g.spools.length, 0);
  const total = spools.data?.length ?? 0;

  return (
    <IonPage>
      {/* Suche und Gruppierung im festen Kopf: collapse="condense" zeigt Ionic nur im iOS-Stil an */}
      <IonHeader>
        {selecting ? (
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={endSelect}>{t('common.cancel')}</IonButton>
            </IonButtons>
            <IonTitle>{t('select.count', { n: chosen.length })}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setSelected(chosen.length === visible.length ? new Set() : new Set(visible.map((x) => x.id)))}>
                {chosen.length === visible.length ? t('select.none') : t('select.all')}
              </IonButton>
            </IonButtons>
          </IonToolbar>
        ) : (
          <IonToolbar>
            <IonTitle>{t('spools.title')}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setSelecting(true)} aria-label={t('select.start')}>
                <IonIcon slot="icon-only" icon={checkmarkCircleOutline} />
              </IonButton>
              <IonButton routerLink="/spools/weigh" aria-label={t('weighs.action')}>
                <IonIcon slot="icon-only" icon={scaleOutline} />
              </IonButton>
              <IonButton routerLink="/spools/new" aria-label={t('spools.action.add')}>
                <IonIcon slot="icon-only" icon={add} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        )}
        <IonToolbar>
          <IonSearchbar value={query} onIonInput={(e) => setQuery(e.detail.value ?? '')} placeholder={t('spools.search')} />
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void refresh(e)}>
          <IonRefresherContent />
        </IonRefresher>
        {!spools.isPending && !spools.isError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--bs-s2)',
              padding: 'var(--bs-s2) var(--bs-s4) 0',
              fontSize: 'var(--bs-fs-caption)',
              color: 'var(--bs-text-2)',
            }}
          >
            <span className="bs-num" style={{ flex: 1, whiteSpace: 'nowrap' }}>
              {count === total ? t('spools.count', { n: total }) : t('spools.countOf', { n: count, total })}
            </span>
            <IonSelect
              aria-label={t('spools.groupBy')}
              interface="popover"
              value={groupBy}
              onIonChange={(e) => {
                const v = e.detail.value as GroupBy;
                setGroupBy(v);
                storage.set('spools.groupBy', v);
              }}
              style={{ minHeight: 'var(--bs-touch)', fontSize: 'var(--bs-fs-caption)', color: 'var(--bs-accent)' }}
              selectedText={groupBy === 'none' ? t('spools.groupBy') : t(`spools.group.${groupBy}`)}
            >
              {(['none', 'material', 'color', 'location', 'brand'] as const).map((g) => (
                <IonSelectOption key={g} value={g}>
                  {t(`spools.group.${g}`)}
                </IonSelectOption>
              ))}
            </IonSelect>
            <IonButton size="small" fill="clear" onClick={toggleSort} aria-label={t('spools.sort.label', { by: t(`spools.sort.${sortBy}`) })}>
              <IonIcon slot="start" icon={swapVerticalOutline} />
              {t(`spools.sort.${sortBy}`)}
            </IonButton>
          </div>
        )}
        {spools.isPending ? (
          <StateView state="loading" />
        ) : spools.isError ? (
          <StateView state={spools.error instanceof ApiError ? 'error' : 'offline'} onRetry={() => void spools.refetch()} />
        ) : count === 0 ? (
          <StateView state="empty" message={total > 0 ? t('spools.noMatch') : undefined} />
        ) : (
          <div style={{ paddingBottom: 'var(--bs-s4)' }}>
            {newRfid > 0 && !selecting && (
              <IonItem routerLink="/spools/slots" detail color="primary" lines="none" style={{ margin: 'var(--bs-s2) var(--bs-s3)', borderRadius: 'var(--bs-r-md)' }}>
                <IonLabel>{t('rfid.banner', { n: newRfid })}</IonLabel>
              </IonItem>
            )}
            {groups.map((g) => (
              <div key={g.key}>
                {g.title && (
                  <IonItemDivider sticky>
                    <IonLabel>
                      {g.title} <span style={{ color: 'var(--bs-text-2)' }}>· {g.spools.length}</span>
                    </IonLabel>
                  </IonItemDivider>
                )}
                {g.spools.map((s) => (
                  <SpoolCard
                    key={s.id}
                    spool={s}
                    location={locationName(s, locations.data ?? [])}
                    ams={amsBySpool.get(s.id) ?? null}
                    canEdit={canEdit}
                    selecting={selecting}
                    selected={selected.has(s.id)}
                    onToggle={() => toggle(s.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </IonContent>
      {selecting && (
        <IonFooter>
          <IonToolbar>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--bs-s2)', padding: '0 var(--bs-s3)' }}>
              <IonButton expand="block" fill="outline" disabled={!chosen.length} onClick={() => setSheet('labels')}>
                <IonIcon slot="start" icon={pricetagOutline} />
                {t('select.labels')}
              </IonButton>
              <IonButton expand="block" fill="outline" disabled={!chosen.length || !canEdit} onClick={() => setSheet('move')}>
                <IonIcon slot="start" icon={locationOutline} />
                {t('select.move')}
              </IonButton>
              <IonButton
                expand="block"
                fill="outline"
                color="danger"
                disabled={!chosen.length || !canEdit || archive.isPending}
                onClick={archiveChosen}
              >
                <IonIcon slot="start" icon={archiveOutline} />
                {t('select.archive')}
              </IonButton>
            </div>
          </IonToolbar>
        </IonFooter>
      )}
      <LabelSheet spools={chosen} isOpen={sheet === 'labels'} onDismiss={() => setSheet(null)} />
      <MoveSheet spools={chosen} isOpen={sheet === 'move'} onDismiss={() => setSheet(null)} onDone={endSelect} />
    </IonPage>
  );
}
