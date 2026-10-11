import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonItem, IonItemDivider, IonLabel, IonList, IonNote, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { useMemo, useState } from 'react';
import { t } from '@/core/i18n';
import { LabelPrintSheet, SLOT_TEMPLATE } from '@/core/printing';
import { rgbaToCss, StateView } from '@/core/ui';
import { useSlots, useSpools } from '../hooks/useSpools';
import { slotLabelVariables, spoolTitle } from '../slots';

/** SP-08: alle Slots mit Belegung; Slot-Etiketten (QR bm:t:…) für alle Slots in einem Druck. */
export function SlotsPage() {
  const { slots, printers, isPending, isError, refetch } = useSlots();
  const spools = useSpools();
  const [printOpen, setPrintOpen] = useState(false);
  const byId = new Map((spools.data ?? []).map((s) => [s.id, s]));
  const records = useMemo(() => slots.map(slotLabelVariables), [slots]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/more" text="" />
          </IonButtons>
          <IonTitle>{t('slots.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {isPending ? (
          <StateView state="loading" />
        ) : isError ? (
          <StateView state="offline" onRetry={() => void refetch()} />
        ) : printers.length === 0 ? (
          <StateView state="empty" message={t('ams.noPrinters')} />
        ) : (
          <>
            <IonList inset>
              {printers.map((p) => (
                <div key={p.id}>
                  <IonItemDivider>
                    <IonLabel>{p.name}</IonLabel>
                  </IonItemDivider>
                  {slots
                    .filter((s) => s.printerId === p.id)
                    .map((s) => {
                      const sp = s.assignment ? byId.get(s.assignment.spool_id) : undefined;
                      return (
                        <IonItem key={`${s.amsId}:${s.trayId}`} routerLink={`/spools/slot/${s.printerId}/${s.amsId}/${s.trayId}`} detail>
                          <span
                            aria-hidden
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              marginRight: 'var(--bs-s3)',
                              background: sp?.rgba || s.trayColor ? rgbaToCss(sp?.rgba ?? s.trayColor) : 'transparent',
                              border: '2px solid var(--bs-border)',
                            }}
                          />
                          <IonLabel>{s.label}</IonLabel>
                          <IonNote slot="end">{sp ? spoolTitle(sp) : t('ams.free')}</IonNote>
                        </IonItem>
                      );
                    })}
                </div>
              ))}
            </IonList>
            <div style={{ padding: '0 var(--bs-s4) var(--bs-s4)' }}>
              <IonButton expand="block" disabled={records.length === 0} onClick={() => setPrintOpen(true)}>
                {t('slots.printAll')}
              </IonButton>
            </div>
            <LabelPrintSheet
              templates={[SLOT_TEMPLATE]}
              records={records}
              fileName={(r) => `slot-${r.code?.replace(/[^0-9]+/g, '-')}.png`}
              storageKey="label.slotTemplate"
              isOpen={printOpen}
              onDismiss={() => setPrintOpen(false)}
            />
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
