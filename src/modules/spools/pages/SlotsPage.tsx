import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonToast,
} from '@ionic/react';
import { useMemo, useState } from 'react';
import { useAllowed, type Spool } from '@/core/api';
import { t } from '@/core/i18n';
import { LabelPrintSheet, useLabelTemplates } from '@/core/printing';
import { Badge, rgbaToCss, StateView } from '@/core/ui';
import { LabelSheet } from '../components/LabelSheet';
import { useAdoptFromSlot, useSlots, useSpools } from '../hooks/useSpools';
import { isNewRfid, slotLabelVariables, spoolTitle, type Slot } from '../slots';

/** SP-08: alle Slots mit Belegung; Slot-Etiketten (QR bm:t:…) für alle Slots in einem Druck. */
export function SlotsPage() {
  const { slots, printers, isPending, isError, refetch } = useSlots();
  const spools = useSpools();
  const [printOpen, setPrintOpen] = useState(false);
  const adopt = useAdoptFromSlot();
  const canEdit = useAllowed('inventory:update');
  const [adopted, setAdopted] = useState<Spool | null>(null);
  const [toast] = useIonToast();
  const adoptSlot = (s: Slot) =>
    adopt
      .mutateAsync(s)
      .then((spool) => {
        void toast({ message: t('rfid.adopted', { id: spool.id, slot: s.label }), duration: 2500, position: 'top' });
        setAdopted(spool); // gleich Etikett drucken
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
  const byId = new Map((spools.data ?? []).map((s) => [s.id, s]));
  const records = useMemo(() => slots.map(slotLabelVariables), [slots]);
  const { templates } = useLabelTemplates('slot');

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
                        <IonItem key={`${s.amsId}:${s.trayId}`} routerLink={`/more/slots/${s.printerId}/${s.amsId}/${s.trayId}`} detail>
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
                          <IonLabel>
                            {s.label}
                            {isNewRfid(s, spools.data ?? []) && (
                              <div style={{ color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)' }}>
                                {s.traySubBrand ?? s.trayType}
                              </div>
                            )}
                          </IonLabel>
                          {isNewRfid(s, spools.data ?? []) ? (
                            <>
                              <Badge tone="good">{t('rfid.new')}</Badge>
                              <IonButton
                                slot="end"
                                size="small"
                                disabled={adopt.isPending || !canEdit}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void adoptSlot(s);
                                }}
                              >
                                {t('rfid.adopt')}
                              </IonButton>
                            </>
                          ) : (
                            <IonNote slot="end">
                              {sp ? spoolTitle(sp) : s.trayType ? t('slots.unassigned', { type: s.trayType }) : t('ams.free')}
                            </IonNote>
                          )}
                        </IonItem>
                      );
                    })}
                </div>
              ))}
            </IonList>
            <div style={{ padding: '0 var(--bs-s4) var(--bs-s4)' }}>
              <IonButton expand="block" fill="outline" disabled={records.length === 0} onClick={() => setPrintOpen(true)}>
                {t('slots.printAll')}
              </IonButton>
            </div>
            <LabelSheet spools={adopted ? [adopted] : []} isOpen={!!adopted} onDismiss={() => setAdopted(null)} />
            <LabelPrintSheet
              templates={templates}
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
