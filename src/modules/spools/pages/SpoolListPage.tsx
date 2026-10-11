import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItemDivider,
  IonLabel,
  IonList,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  type RefresherEventDetail,
} from '@ionic/react';
import { add, scaleOutline, swapVerticalOutline } from 'ionicons/icons';
import { useMemo, useState } from 'react';
import { ApiError } from '@/core/api';
import { t } from '@/core/i18n';
import { storage } from '@/core/platform';
import { StateView } from '@/core/ui';
import { SpoolCard } from '../components/SpoolCard';
import { useAssignments, useLocations, useSpools } from '../hooks/useSpools';
import { amsLabel, groupSpools, locationName, matchesSearch, sortSpools, type GroupBy, type SortBy } from '../logic';

/** Vorlage „Liste“: Kopf mit Suche, Filter-Chips, gruppierte Karten, Leer-Zustand. */
export function SpoolListPage() {
  const spools = useSpools();
  const locations = useLocations();
  const assignments = useAssignments();
  const [query, setQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>(() => storage.get<GroupBy>('spools.groupBy', 'none'));
  const [sortBy, setSortBy] = useState<SortBy>(() => storage.get<SortBy>('spools.sortBy', 'id'));

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

  const amsBySpool = useMemo(() => new Map((assignments.data ?? []).map((a) => [a.spool_id, amsLabel(a)])), [assignments.data]);
  const count = groups.reduce((n, g) => n + g.spools.length, 0);

  return (
    <IonPage>
      {/* Suche und Gruppierung im festen Kopf: collapse="condense" zeigt Ionic nur im iOS-Stil an */}
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('spools.title')}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={toggleSort} aria-label={t('spools.sort.label', { by: t(`spools.sort.${sortBy}`) })}>
              <IonIcon slot="start" icon={swapVerticalOutline} />
              {t(`spools.sort.${sortBy}`)}
            </IonButton>
            <IonButton routerLink="/spools/weigh" aria-label={t('weighs.action')}>
              <IonIcon slot="icon-only" icon={scaleOutline} />
            </IonButton>
            <IonButton routerLink="/spools/new" aria-label={t('spools.action.add')}>
              <IonIcon slot="icon-only" icon={add} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar value={query} onIonInput={(e) => setQuery(e.detail.value ?? '')} placeholder={t('spools.search')} />
        </IonToolbar>
        <IonToolbar>
          <IonSegment
            value={groupBy}
            scrollable
            onIonChange={(e) => {
              const v = e.detail.value as GroupBy;
              setGroupBy(v);
              storage.set('spools.groupBy', v);
            }}
          >
            {(['none', 'material', 'color', 'location', 'brand'] as const).map((g) => (
              <IonSegmentButton key={g} value={g}>
                <IonLabel>{t(`spools.group.${g}`)}</IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void refresh(e)}>
          <IonRefresherContent />
        </IonRefresher>
        {spools.isPending ? (
          <StateView state="loading" />
        ) : spools.isError ? (
          <StateView state={spools.error instanceof ApiError ? 'error' : 'offline'} onRetry={() => void spools.refetch()} />
        ) : count === 0 ? (
          <StateView state="empty" />
        ) : (
          <IonList>
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
                  <SpoolCard key={s.id} spool={s} location={locationName(s, locations.data ?? [])} ams={amsBySpool.get(s.id) ?? null} />
                ))}
              </div>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
}
