import { IonContent, IonHeader, IonList, IonListHeader, IonPage, IonTitle, IonToolbar, IonItem, IonLabel } from '@ionic/react';
import { useQuery } from '@tanstack/react-query';
import { bambuddy, remainingGrams } from '@/core/api';
import { t } from '@/core/i18n';
import { Badge, ColorRing, StateView } from '@/core/ui';
import { fillRatio } from '@/core/api';

const LOW = 20;

/** Übersicht: „Aufmerksamkeit nötig“. Holt Daten selbst über den Kern (keine Imports aus spools). */
export function OverviewPage() {
  const spools = useQuery({ queryKey: ['spools'], queryFn: bambuddy.spools.list });
  const low = (spools.data ?? [])
    .filter((s) => !s.archived_at && fillRatio(s) * 100 < (s.low_stock_threshold_pct ?? LOW))
    .sort((a, b) => fillRatio(a) - fillRatio(b));

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>{t('overview.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
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
          <IonList inset>
            <IonListHeader>{t('overview.attention')}</IonListHeader>
            {low.length === 0 && (
              <IonItem lines="none">
                <IonLabel color="medium">{t('overview.allGood')}</IonLabel>
              </IonItem>
            )}
            {low.map((s) => (
              <IonItem key={s.id} routerLink={`/spools/${s.id}`} detail>
                <div slot="start">
                  <ColorRing rgba={s.rgba} fill={fillRatio(s)} size={32} label={s.color_name ?? s.material} />
                </div>
                <IonLabel>
                  #{s.id} {s.color_name ?? s.material}
                  <p>{s.brand}</p>
                </IonLabel>
                <div slot="end">
                  <Badge tone="warn">{remainingGrams(s)} g</Badge>
                </div>
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
}
