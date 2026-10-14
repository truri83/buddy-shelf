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
  type RefresherEventDetail,
} from '@ionic/react';
import {
  add,
  alertCircleOutline,
  archiveOutline,
  checkmarkCircleOutline,
  copyOutline,
  createOutline,
  locationOutline,
  pricetagOutline,
  scaleOutline,
  sunnyOutline,
  swapVerticalOutline,
} from 'ionicons/icons';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, useAllowed } from '@/core/api';
import { dryingDue, useDryingConfig } from '@/core/filament';
import { t, tn } from '@/core/i18n';
import { storage } from '@/core/platform';
import { ChoiceChip, SPLIT_QUERY, StateView, useMediaQuery, useNotify } from '@/core/ui';
import { LabelSheet } from '../components/LabelSheet';
import { MoveSheet } from '../components/MoveSheet';
import { FamilyFilter } from '../components/FamilyFilter';
import { SpoolCard } from '../components/SpoolCard';
import { SpoolDetailView, type DetailSheet } from '../components/SpoolDetailView';
import { useDisplayConfig } from '@/core/filament';
import { useLocationPrefs } from '../hooks/useLocationPrefs';
import { STORAGE_TYPES } from '../newSpool';
import { STORAGE_ICONS } from '../storage';
import { locationText } from '../locationPrefs';
import { useAssignments, useBulkArchive, useLocations, useSlots, useSpools } from '../hooks/useSpools';
import { isNewRfid } from '../slots';
import {
  amsLabel,
  familyOf,
  groupSpools,
  isLow,
  locationName,
  matchesSearch,
  sortSpools,
  variantOf,
  type GroupBy,
  type SortBy,
} from '../logic';

/** Vorlage „Liste“: Kopf mit Suche, Filter-Chips, gruppierte Karten, Leer-Zustand. */
export function SpoolListPage() {
  const spools = useSpools();
  const locations = useLocations();
  const locationPrefs = useLocationPrefs();
  const display = useDisplayConfig();
  const assignments = useAssignments();
  const { slots } = useSlots();
  const newRfid = slots.filter((x) => isNewRfid(x, spools.data ?? [])).length;
  const [query, setQuery] = useState('');
  // SP-16: nur Spulen ohne Etikett (label_printed_at === null; undefined = unbekannt)
  // Filter steht in der Adresse – so funktioniert auch der Link aus der Übersicht
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter');
  const unlabeledOnly = filter === 'unlabeled';
  const dryOnly = filter === 'dry';
  const lowOnly = filter === 'low';
  // Lagerungsart (OVP, Beutel, Trockenbox, offen) – kombinierbar mit den anderen Filtern
  const storageFilter = params.get('storage');
  const family = params.get('fam');
  const variant = params.get('sub');
  /** Adresse ändern, ohne die anderen Filter zu verlieren */
  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };
  const setFilter = (f: 'unlabeled' | 'dry' | 'low' | null) => updateParams({ filter: f });
  const setUnlabeledOnly = (on: boolean) => setFilter(on ? 'unlabeled' : null);
  const dryCfg = useDryingConfig();
  const dueDry = (spools.data ?? []).filter((s) => dryingDue(s, dryCfg)?.due).length;
  const unlabeled = (spools.data ?? []).filter((s) => s.label_printed_at === null).length;
  const lowCount = (spools.data ?? []).filter((s) => !s.archived_at && isLow(s, display)).length;
  const storageCounts = STORAGE_TYPES.map((k) => ({
    k,
    n: (spools.data ?? []).filter((s) => !s.archived_at && s.storage_type === k).length,
  }));
  const [groupBy, setGroupBy] = useState<GroupBy>(() => storage.get<GroupBy>('spools.groupBy', 'none'));
  const [sortBy, setSortBy] = useState<SortBy>(() => storage.get<SortBy>('spools.sortBy', 'id'));
  // SP-12 Mehrfachauswahl
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [sheet, setSheet] = useState<'labels' | 'move' | null>(null);
  // Tablet quer/Desktop: gewählte Spule in der Detail-Kachel
  const split = useMediaQuery(SPLIT_QUERY);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detailSheet, setDetailSheet] = useState<DetailSheet | null>(null);
  const canEdit = useAllowed('inventory:update');
  const archive = useBulkArchive();
  const [alert] = useIonAlert();
  const notify = useNotify();

  const groups = useMemo(() => {
    const list = sortSpools(
      (spools.data ?? []).filter(
        (s) =>
          matchesSearch(s, query) &&
          (!unlabeledOnly || s.label_printed_at === null) &&
          (!dryOnly || !!dryingDue(s, dryCfg)?.due) &&
          (!lowOnly || isLow(s, display)) &&
          (!storageFilter || s.storage_type === storageFilter) &&
          (!family || familyOf(s) === family) &&
          (variant == null || variantOf(s) === variant),
      ),
      sortBy,
    );
    return groupSpools(list, groupBy, locations.data ?? [], t('spools.noLocation'));
  }, [
    spools.data,
    locations.data,
    query,
    groupBy,
    sortBy,
    unlabeledOnly,
    dryOnly,
    lowOnly,
    storageFilter,
    display,
    dryCfg,
    family,
    variant,
  ]);

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
  const detail = visible.find((x) => x.id === activeId) ?? visible[0] ?? null;
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
      message: tn('select.archiveQ', chosen.length),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        {
          text: t('select.archive'),
          role: 'destructive',
          handler: () => {
            archive
              .mutateAsync(chosen.map((x) => x.id))
              .then((r) => {
                notify.ok(tn('select.archived', r.archived));
                endSelect();
              })
              .catch(notify.fail);
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
      <IonHeader className="bs-wide">
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
              {canEdit && (
                <IonButton routerLink="/spools/new" aria-label={t('spools.action.add')}>
                  <IonIcon slot="icon-only" icon={add} />
                </IonButton>
              )}
            </IonButtons>
          </IonToolbar>
        )}
        <IonToolbar>
          <IonSearchbar value={query} onIonInput={(e) => setQuery(e.detail.value ?? '')} placeholder={t('spools.search')} />
        </IonToolbar>
      </IonHeader>
      <IonContent className="bs-wide" scrollY={!split}>
        {!split && (
          <IonRefresher slot="fixed" onIonRefresh={(e) => void refresh(e)}>
            <IonRefresherContent />
          </IonRefresher>
        )}
        {/* Ab Tablet quer: Liste links, Detail rechts – beide scrollen für sich (wie ein Mailprogramm) */}
        <div className={split ? 'bs-split' : undefined}>
          <div className={split ? 'bs-split-list' : undefined}>
            {!spools.isPending && !spools.isError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 'var(--bs-s1) var(--bs-s2)',
                  padding: 'var(--bs-s2) var(--bs-s4) 0',
                  fontSize: 'var(--bs-fs-caption)',
                  color: 'var(--bs-text-2)',
                }}
              >
                <span className="bs-num" style={{ whiteSpace: 'nowrap' }}>
                  {count === total ? tn('spools.count', total) : t('spools.countOf', { n: count, total })}
                </span>
                <span style={{ flex: 1 }} />
                <IonSelect
                  aria-label={t('spools.groupBy')}
                  interface="popover"
                  value={groupBy}
                  onIonChange={(e) => {
                    const v = e.detail.value as GroupBy;
                    setGroupBy(v);
                    storage.set('spools.groupBy', v);
                  }}
                  style={{
                    flex: 'none',
                    width: 'auto',
                    minHeight: 'var(--bs-touch)',
                    fontSize: 'var(--bs-fs-caption)',
                    color: 'var(--bs-accent)',
                  }}
                  selectedText={groupBy === 'none' ? t('spools.groupBy') : t(`spools.group.${groupBy}`)}
                >
                  {(['none', 'material', 'color', 'location', 'brand'] as const).map((g) => (
                    <IonSelectOption key={g} value={g}>
                      {t(`spools.group.${g}`)}
                    </IonSelectOption>
                  ))}
                </IonSelect>
                <IonButton
                  size="small"
                  fill="clear"
                  onClick={toggleSort}
                  aria-label={t('spools.sort.label', { by: t(`spools.sort.${sortBy}`) })}
                >
                  <IonIcon slot="start" icon={swapVerticalOutline} />
                  {t(`spools.sort.${sortBy}`)}
                </IonButton>
              </div>
            )}
            {!spools.isPending && !spools.isError && (
              <FamilyFilter
                spools={spools.data ?? []}
                family={family}
                variant={variant}
                onChange={(f, v) => updateParams({ fam: f, sub: v })}
              >
                {(unlabeled > 0 || unlabeledOnly) && (
                  <ChoiceChip selected={unlabeledOnly} onSelect={() => setUnlabeledOnly(!unlabeledOnly)}>
                    <IonIcon icon={pricetagOutline} aria-hidden style={{ marginRight: 'var(--bs-s1)' }} />
                    {t('labels.unlabeled', { n: unlabeled })}
                  </ChoiceChip>
                )}
                {(lowCount > 0 || lowOnly) && (
                  <ChoiceChip selected={lowOnly} onSelect={() => setFilter(lowOnly ? null : 'low')}>
                    <IonIcon icon={alertCircleOutline} aria-hidden style={{ marginRight: 'var(--bs-s1)', color: 'var(--bs-warn)' }} />
                    {t('spools.lowFilter', { n: lowCount })}
                  </ChoiceChip>
                )}
                {(dueDry > 0 || dryOnly) && (
                  <ChoiceChip selected={dryOnly} onSelect={() => setFilter(dryOnly ? null : 'dry')}>
                    <IonIcon icon={sunnyOutline} aria-hidden style={{ marginRight: 'var(--bs-s1)', color: 'var(--bs-warn)' }} />
                    {t('dry.filter', { n: dueDry })}
                  </ChoiceChip>
                )}
                {storageCounts
                  .filter(({ k, n }) => n > 0 || storageFilter === k)
                  .map(({ k, n }) => (
                    <ChoiceChip
                      key={k}
                      selected={storageFilter === k}
                      onSelect={() => updateParams({ storage: storageFilter === k ? null : k })}
                    >
                      <IonIcon icon={STORAGE_ICONS[k]} aria-hidden style={{ marginRight: 'var(--bs-s1)' }} />
                      {t(`storage.${k}`)} · {n}
                    </ChoiceChip>
                  ))}
              </FamilyFilter>
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
                  <IonItem
                    routerLink="/more/slots"
                    detail
                    color="primary"
                    lines="none"
                    style={{ margin: 'var(--bs-s2) var(--bs-s3)', borderRadius: 'var(--bs-r-md)' }}
                  >
                    <IonLabel>{tn('rfid.banner', newRfid)}</IonLabel>
                  </IonItem>
                )}
                {groups.map((g) => (
                  <div key={g.key}>
                    {g.title && (
                      <IonItemDivider sticky>
                        <IonLabel>
                          {groupBy === 'location'
                            ? locationText(g.title, locationPrefs.icons[locations.data?.find((l) => l.name === g.title)?.id ?? -1])
                            : g.title}{' '}
                          <span style={{ color: 'var(--bs-text-2)' }}>· {g.spools.length}</span>
                        </IonLabel>
                      </IonItemDivider>
                    )}
                    <div className="bs-card-grid">
                      {g.spools.map((s) => (
                        <SpoolCard
                          key={s.id}
                          spool={s}
                          location={locationName(s, locations.data ?? [])}
                          locationIcon={s.location_id != null ? locationPrefs.icons[s.location_id] : undefined}
                          ams={amsBySpool.get(s.id) ?? null}
                          canEdit={canEdit}
                          selecting={selecting}
                          selected={selected.has(s.id)}
                          onToggle={() => toggle(s.id)}
                          onOpen={split ? () => setActiveId(s.id) : undefined}
                          active={split && detail?.id === s.id}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {split && (
            <aside className="bs-split-detail" aria-label={t('spools.detail.overview')}>
              {detail ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--bs-s2)', padding: 'var(--bs-s3) var(--bs-s3) 0' }}>
                    <strong style={{ flex: 1, fontSize: 'var(--bs-fs-title)' }}>#{detail.id}</strong>
                    {canEdit && (
                      <>
                        <IonButton fill="clear" routerLink={`/spools/${detail.id}/edit`} aria-label={t('spools.action.edit')}>
                          <IonIcon slot="icon-only" icon={createOutline} />
                        </IonButton>
                        <IonButton fill="clear" routerLink={`/spools/new?from=${detail.id}`} aria-label={t('spools.action.duplicate')}>
                          <IonIcon slot="icon-only" icon={copyOutline} />
                        </IonButton>
                      </>
                    )}
                  </div>
                  <SpoolDetailView spool={detail} sheet={detailSheet} onSheet={setDetailSheet} />
                </>
              ) : (
                <StateView state="empty" message={t('spools.pickOne')} />
              )}
            </aside>
          )}
        </div>
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
