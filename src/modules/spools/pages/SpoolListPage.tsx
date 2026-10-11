import { IonContent, IonHeader, IonItemDivider, IonLabel, IonList, IonPage, IonSearchbar, IonSegment, IonSegmentButton, IonTitle, IonToolbar } from '@ionic/react';
import { useMemo, useState } from 'react';
import { ApiError } from '@/core/api';
import { t } from '@/core/i18n';
import { storage } from '@/core/platform';
import { StateView } from '@/core/ui';
import { SpoolCard } from '../components/SpoolCard';
import { useAssignments, useLocations, useSpools } from '../hooks/useSpools';
import { amsLabel, groupSpools, locationName, matchesSearch, type GroupBy } from '../logic';

/** Vorlage „Liste“: Kopf mit Suche, Filter-Chips, gruppierte Karten, Leer-Zustand. */
export function SpoolListPage() {
  const spools = useSpools();
  const locations = useLocations();
  const assignments = useAssignments();
  const [query, setQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>(() => storage.get<GroupBy>('spools.groupBy', 'none'));

  const groups = useMemo(() => {
    const list = (spools.data ?? []).filter((s) => matchesSearch(s, query));
    return groupSpools(list, groupBy, locations.data ?? [], t('spools.noLocation'));
  }, [spools.data, locations.data, query, groupBy]);

  const amsBySpool = useMemo(() => new Map((assignments.data ?? []).map((a) => [a.spool_id, amsLabel(a)])), [assignments.data]);
  const count = groups.reduce((n, g) => n + g.spools.length, 0);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>{t('spools.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">{t('spools.title')}</IonTitle>
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
              {(['none', 'material', 'location', 'brand'] as const).map((g) => (
                <IonSegmentButton key={g} value={g}>
                  <IonLabel>{t(`spools.group.${g}`)}</IonLabel>
                </IonSegmentButton>
              ))}
            </IonSegment>
          </IonToolbar>
        </IonHeader>

        {spools.isPending ? (
          <StateView state="loading" />
        ) : spools.isError ? (
          <StateView
            state={spools.error instanceof ApiError ? 'error' : 'offline'}
            onRetry={() => void spools.refetch()}
          />
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
