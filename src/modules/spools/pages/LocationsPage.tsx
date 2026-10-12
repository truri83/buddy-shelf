import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import { add, pricetagOutline } from 'ionicons/icons';
import { useMemo, useState } from 'react';
import { useAllowed, type Location } from '@/core/api';
import { t } from '@/core/i18n';
import { LabelPrintSheet, useLabelTemplates, type LabelVariables } from '@/core/printing';
import { encodeLocationCode } from '@/core/qr/codes';
import { StateView } from '@/core/ui';
import { useCreateLocation, useLocations } from '../hooks/useSpools';

const vars = (l: Location): LabelVariables => ({ code: encodeLocationCode(l.id), location: l.name });

/** SP-17: Lagerorte mit Etikett (QR bm:l:<id>) – Scan startet „Einräumen“. */
export function LocationsPage() {
  const locations = useLocations();
  const create = useCreateLocation();
  const canEdit = useAllowed('inventory:update');
  const { templates } = useLabelTemplates('location');
  const [printing, setPrinting] = useState<Location[] | null>(null);
  const [alert] = useIonAlert();
  const [toast] = useIonToast();
  const list = useMemo(() => [...(locations.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'de')), [locations.data]);
  const records = useMemo(() => (printing ?? []).map(vars), [printing]);

  const newLocation = () =>
    void alert({
      header: t('locations.new'),
      inputs: [{ name: 'name', type: 'text', placeholder: t('locations.name') }],
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        {
          text: t('common.save'),
          handler: (v: { name?: string }) => {
            const name = v.name?.trim();
            if (!name) return false;
            create
              .mutateAsync(name)
              .then((l) => setPrinting([l])) // gleich das Etikett anbieten
              .catch(
                (e: unknown) =>
                  void toast({
                    message: t('common.failed', { msg: e instanceof Error ? e.message : String(e) }),
                    duration: 3000,
                    position: 'top',
                    color: 'danger',
                  }),
              );
            return true;
          },
        },
      ],
    });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/more" text="" />
          </IonButtons>
          <IonTitle>{t('locations.title')}</IonTitle>
          {canEdit && (
            <IonButtons slot="end">
              <IonButton onClick={newLocation} aria-label={t('locations.new')}>
                <IonIcon slot="icon-only" icon={add} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {locations.isPending ? (
          <StateView state="loading" />
        ) : locations.isError ? (
          <StateView state="offline" onRetry={() => void locations.refetch()} />
        ) : list.length === 0 ? (
          <StateView state="empty" message={t('locations.empty')} />
        ) : (
          <>
            <IonNote style={{ display: 'block', padding: 'var(--bs-s4) var(--bs-s5) 0', fontSize: 'var(--bs-fs-caption)' }}>
              {t('locations.hint')}
            </IonNote>
            <IonList inset>
              {list.map((l) => (
                <IonItem key={l.id} routerLink={`/spools/stow/${l.id}`} detail>
                  <IonLabel>
                    {l.name}
                    <div style={{ color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)' }}>
                      {t(l.spool_count === 1 ? 'spools.countOne' : 'spools.count', { n: l.spool_count })}
                    </div>
                  </IonLabel>
                  <IonButton
                    slot="end"
                    fill="clear"
                    aria-label={t('locations.label', { name: l.name })}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPrinting([l]);
                    }}
                  >
                    <IonIcon slot="icon-only" icon={pricetagOutline} />
                  </IonButton>
                </IonItem>
              ))}
            </IonList>
            <div style={{ padding: '0 var(--bs-s4) var(--bs-s4)' }}>
              <IonButton expand="block" fill="outline" onClick={() => setPrinting(list)}>
                {t('locations.printAll')}
              </IonButton>
            </div>
          </>
        )}
        <LabelPrintSheet
          templates={templates}
          records={records}
          fileName={(r) => `lagerort-${r.code?.replace(/[^0-9]+/g, '')}.png`}
          storageKey="label.locationTemplate"
          isOpen={!!printing?.length}
          onDismiss={() => setPrinting(null)}
        />
      </IonContent>
    </IonPage>
  );
}
