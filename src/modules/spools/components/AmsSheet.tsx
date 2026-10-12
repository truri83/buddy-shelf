import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import { useRef, useState } from 'react';
import type { Spool } from '@/core/api';
import { t } from '@/core/i18n';
import { haptic } from '@/core/platform';
import { rgbaToCss } from '@/core/ui';
import { useAssignSpool, useSlots, useSpools, useUnassign } from '../hooks/useSpools';
import { spoolTitle, type Slot } from '../slots';

interface Props {
  spool: Spool;
  isOpen: boolean;
  onDismiss: () => void;
}

/** Farbpunkt: zugewiesene Spule, sonst was der Drucker im Slot meldet. */
function Dot({ rgba }: { rgba: string | null }) {
  return (
    <span
      aria-hidden
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        flex: 'none',
        background: rgba ? rgbaToCss(rgba) : 'transparent',
        border: '2px solid var(--bs-border)',
        marginRight: 'var(--bs-s3)',
      }}
    />
  );
}

/** SP-03: Slot wählen. Freier Slot = ein Tipp; belegter Slot = eine Rückfrage. */
export function AmsSheet({ spool, isOpen, onDismiss }: Props) {
  const modal = useRef<HTMLIonModalElement>(null);
  const { slots, printers, isPending } = useSlots();
  const spools = useSpools();
  const assign = useAssignSpool();
  const unassign = useUnassign();
  const [error, setError] = useState<string | null>(null);
  const [alert] = useIonAlert();
  const [toast] = useIonToast();

  const byId = new Map((spools.data ?? []).map((s) => [s.id, s]));
  const current = slots.find((s) => s.assignment?.spool_id === spool.id);

  const doAssign = async (slot: Slot) => {
    setError(null);
    try {
      const res = await assign.mutateAsync({ spoolId: spool.id, slot });
      haptic();
      void toast({
        message:
          t('ams.done', { id: spool.id, slot: `${slot.printerName} · ${slot.label}` }) +
          (res.pending_config ? ` – ${t('ams.pending')}` : ''),
        duration: 2500,
        position: 'top',
      });
      onDismiss();
    } catch (e) {
      setError(t('common.failed', { msg: e instanceof Error ? e.message : String(e) }));
    }
  };

  const choose = (slot: Slot) => {
    if (slot.assignment?.spool_id === spool.id) return;
    if (!slot.assignment) return void doAssign(slot);
    const other = byId.get(slot.assignment.spool_id);
    void alert({
      header: slot.label,
      message: t('ams.replace', { spool: other ? spoolTitle(other) : `#${slot.assignment.spool_id}` }),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        { text: t('ams.title'), handler: () => void doAssign(slot) },
      ],
    });
  };

  const remove = async () => {
    if (!current) return;
    setError(null);
    try {
      await unassign.mutateAsync(current);
      haptic();
      void toast({ message: t('ams.removed', { id: spool.id, slot: current.label }), duration: 2000, position: 'top' });
      onDismiss();
    } catch (e) {
      setError(t('common.failed', { msg: e instanceof Error ? e.message : String(e) }));
    }
  };

  const busy = assign.isPending || unassign.isPending;
  const multiPrinter = printers.length > 1;

  return (
    <IonModal
      ref={modal}
      isOpen={isOpen}
      onWillPresent={() => setError(null)}
      onDidDismiss={onDismiss}
      initialBreakpoint={0.85}
      breakpoints={[0, 0.85, 1]}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('ams.title')}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => void modal.current?.dismiss()}>{t('common.close')}</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonNote style={{ display: 'block', padding: 'var(--bs-s3) var(--bs-s4) 0' }}>{spoolTitle(spool)}</IonNote>
        {isPending ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 'var(--bs-s6)' }}>
            <IonSpinner />
          </div>
        ) : printers.length === 0 ? (
          <IonNote style={{ display: 'block', padding: 'var(--bs-s4)' }}>{t('ams.noPrinters')}</IonNote>
        ) : (
          <IonList inset>
            {printers.map((p) => {
              const own = slots.filter((s) => s.printerId === p.id);
              return (
                <div key={p.id}>
                  {multiPrinter && (
                    <IonItemDivider>
                      <IonLabel>{p.name}</IonLabel>
                    </IonItemDivider>
                  )}
                  {own.length === 0 && (
                    <IonItem lines="none">
                      <IonNote>{t('ams.offline', { name: p.name })}</IonNote>
                    </IonItem>
                  )}
                  {own.map((slot) => {
                    const occupant = slot.assignment ? byId.get(slot.assignment.spool_id) : undefined;
                    const mine = slot.assignment?.spool_id === spool.id;
                    return (
                      <IonItem
                        key={`${slot.amsId}:${slot.trayId}`}
                        button={!mine}
                        detail={false}
                        disabled={busy}
                        onClick={() => choose(slot)}
                      >
                        <Dot rgba={occupant?.rgba ?? slot.trayColor} />
                        <IonLabel>
                          <div style={{ fontWeight: 600 }}>{slot.label}</div>
                          <div style={{ color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)' }}>
                            {occupant
                              ? spoolTitle(occupant)
                              : slot.assignment
                                ? `#${slot.assignment.spool_id}`
                                : (slot.trayType ?? t('ams.free'))}
                          </div>
                        </IonLabel>
                        {mine && (
                          <IonNote slot="end" color="primary">
                            {t('ams.here')}
                          </IonNote>
                        )}
                      </IonItem>
                    );
                  })}
                </div>
              );
            })}
          </IonList>
        )}
        <div style={{ display: 'grid', gap: 'var(--bs-s2)', padding: '0 var(--bs-s4) var(--bs-s4)' }}>
          {error && (
            <IonNote color="danger" role="alert">
              {error}
            </IonNote>
          )}
          {current && (
            <IonButton fill="outline" color="danger" disabled={busy} onClick={() => void remove()}>
              {t('ams.remove')}
            </IonButton>
          )}
        </div>
      </IonContent>
    </IonModal>
  );
}
