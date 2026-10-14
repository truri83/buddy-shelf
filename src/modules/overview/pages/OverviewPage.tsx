import {
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonRippleEffect,
  IonTitle,
  IonToolbar,
  type RefresherEventDetail,
} from '@ionic/react';
import { useQuery } from '@tanstack/react-query';
import {
  addCircleOutline,
  albumsOutline,
  alertCircleOutline,
  barbellOutline,
  checkmarkCircleOutline,
  gridOutline,
  locationOutline,
  pricetagOutline,
  scaleOutline,
  sunnyOutline,
} from 'ionicons/icons';
import { Link } from 'react-router-dom';
import { bambuddy, fillRatio, remainingGrams } from '@/core/api';
import { dryingDue, stockLevel, useDisplayConfig, useDryingConfig } from '@/core/filament';
import { fmtNum, t, tn } from '@/core/i18n';
import { Badge, ColorRing, StatTile, StateView } from '@/core/ui';
import { AmsOverview } from '../components/AmsOverview';

/** Schnellaktionen als Deep Links (Regel 2: Zusammenarbeit über Deep Links statt Imports). */
// Scannen ist der Mittelknopf der Tab-Leiste – hier nicht doppelt
const ACTIONS = [
  { href: '/spools/weigh', icon: scaleOutline, label: 'weighs.action' },
  { href: '/spools/new', icon: addCircleOutline, label: 'spools.action.add' },
  { href: '/more/locations', icon: locationOutline, label: 'locations.title' },
  { href: '/more/slots', icon: gridOutline, label: 'slots.title' },
] as const;

/** Übersicht: Kennzahlen, Schnellaktionen, was im AMS liegt, was Aufmerksamkeit braucht. */
export function OverviewPage() {
  const spools = useQuery({ queryKey: ['spools'], queryFn: bambuddy.spools.list });
  const assignments = useQuery({ queryKey: ['assignments'], queryFn: bambuddy.assignments.list });

  const active = (spools.data ?? []).filter((s) => !s.archived_at);
  const display = useDisplayConfig();
  const level = new Map(active.map((s) => [s.id, stockLevel(s, display)]));
  const low = active.filter((s) => level.get(s.id) !== 'ok').sort((a, b) => fillRatio(a) - fillRatio(b));
  const empty = low.filter((s) => level.get(s.id) === 'empty').length;
  const totalKg = active.reduce((g, s) => g + remainingGrams(s), 0) / 1000;
  // undefined = Zusatzdaten unbekannt (nicht „ohne Etikett“)
  const unlabeled = active.filter((s) => s.label_printed_at === null).length;
  const dryCfg = useDryingConfig();
  const dueDry = active.filter((s) => dryingDue(s, dryCfg)?.due).length;

  const refresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await Promise.all([spools.refetch(), assignments.refetch()]);
    e.detail.complete();
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>{t('overview.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="bs-medium">
        <IonRefresher slot="fixed" onIonRefresh={(e) => void refresh(e)}>
          <IonRefresherContent />
        </IonRefresher>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">{t('overview.title')}</IonTitle>
          </IonToolbar>
        </IonHeader>
        {spools.isPending ? (
          <StateView state="loading" />
        ) : spools.isError ? (
          <StateView state="offline" onRetry={() => void spools.refetch()} />
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 'var(--bs-s2)',
                padding: 'var(--bs-s4) var(--bs-s4) 0',
              }}
            >
              <StatTile value={active.length} label={t('overview.spools')} icon={albumsOutline} to="/spools" />
              <StatTile
                value={`${totalKg.toLocaleString('de-DE', { maximumFractionDigits: 1 })} kg`}
                label={t('overview.filament')}
                icon={barbellOutline}
              />
              <StatTile
                value={low.length}
                label={t('overview.low')}
                icon={low.length ? alertCircleOutline : checkmarkCircleOutline}
                tone={empty ? 'critical' : low.length ? 'warn' : 'good'}
                to={low.length ? '/spools?filter=low' : undefined}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 'var(--bs-s2)',
                padding: 'var(--bs-s3) var(--bs-s4) 0',
              }}
            >
              {ACTIONS.map((a) => (
                <Link
                  key={a.href}
                  to={a.href}
                  className="ion-activatable"
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'grid',
                    justifyItems: 'center',
                    gap: 'var(--bs-s1)',
                    padding: 'var(--bs-s3) var(--bs-s1)',
                    minHeight: 'var(--bs-touch)',
                    background: 'var(--bs-surface)',
                    borderRadius: 'var(--bs-r-lg)',
                    color: 'var(--bs-text)',
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                >
                  <IonIcon icon={a.icon} style={{ fontSize: 26, color: 'var(--bs-accent)' }} aria-hidden />
                  <span style={{ fontSize: 'var(--bs-fs-caption)', lineHeight: 1.2 }}>{t(a.label)}</span>
                  <IonRippleEffect />
                </Link>
              ))}
            </div>

            <AmsOverview spools={active} assignments={assignments.data ?? []} />

            <IonList inset>
              <IonListHeader>{t('overview.attention')}</IonListHeader>
              {low.length === 0 && unlabeled === 0 && dueDry === 0 && (
                <IonItem lines="none">
                  <IonLabel color="medium">{t('overview.allGood')}</IonLabel>
                </IonItem>
              )}
              {dueDry > 0 && (
                <IonItem routerLink="/spools?filter=dry" detail>
                  <IonIcon icon={sunnyOutline} slot="start" color="warning" aria-hidden />
                  <IonLabel>{tn('overview.dryDue', dueDry)}</IonLabel>
                </IonItem>
              )}
              {unlabeled > 0 && (
                <IonItem routerLink="/spools?filter=unlabeled" detail>
                  <IonIcon icon={pricetagOutline} slot="start" color="primary" aria-hidden />
                  <IonLabel>{tn('overview.unlabeled', unlabeled)}</IonLabel>
                </IonItem>
              )}
              {low.map((s) => (
                <IonItem key={s.id} routerLink={`/spools/${s.id}`} detail>
                  <div slot="start">
                    <ColorRing rgba={s.rgba} size={32} label={s.color_name ?? s.material} />
                  </div>
                  <IonLabel>
                    #{s.id} {s.color_name ?? [s.material, s.subtype].filter(Boolean).join(' ')}
                    <p>
                      {[s.material, s.subtype].filter(Boolean).join(' ')}
                      {s.brand ? ` · ${s.brand}` : ''}
                    </p>
                  </IonLabel>
                  <div slot="end">
                    <Badge tone={level.get(s.id) === 'empty' ? 'critical' : 'warn'}>{fmtNum(remainingGrams(s))} g</Badge>
                  </div>
                </IonItem>
              ))}
            </IonList>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
