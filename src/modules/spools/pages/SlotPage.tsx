import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonButton,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonToast,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import { useCallback, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fillRatio, remainingGrams, useAllowed } from '@/core/api';
import { t } from '@/core/i18n';
import { haptic } from '@/core/platform';
import { parseScan } from '@/core/qr/codes';
import { ColorRing, MaterialBadge, ScannerView, StateView } from '@/core/ui';
import { useAssignSpool, useSlots, useSpools, useUnassign } from '../hooks/useSpools';
import { spoolTitle } from '../slots';

/**
 * SP-08: Slot-Etikett gescannt → Seite zeigt, was im Slot liegt, Kamera bleibt offen →
 * neue Spule scannen → gespeichert. Höchstens 2 Scans, 0 Tipps; „Rückgängig“ im Hinweis.
 */
export function SlotPage() {
  const params = useParams();
  const target = { printerId: Number(params.printer), amsId: Number(params.ams), trayId: Number(params.tray) };
  const { slots, printers, isPending, isError, statusError, refetch } = useSlots();
  const canEdit = useAllowed('inventory:update');
  const spools = useSpools();
  const assign = useAssignSpool();
  const unassign = useUnassign();
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const busy = useRef(false);
  const navigate = useNavigate();
  const [toast] = useIonToast();
  const [alert] = useIonAlert();

  useIonViewDidEnter(() => setActive(true));
  useIonViewWillLeave(() => setActive(false));

  const slot = slots.find((s) => s.printerId === target.printerId && s.amsId === target.amsId && s.trayId === target.trayId);
  const occupant = slot?.assignment ? spools.data?.find((s) => s.id === slot.assignment!.spool_id) : undefined;

  const assignSpool = useCallback(
    async (spoolId: number) => {
      if (!slot || busy.current) return;
      if (!canEdit) {
        setMessage(t('common.noPermission'));
        return;
      }
      const spool = spools.data?.find((s) => s.id === spoolId);
      if (spool?.archived_at) {
        haptic('warning');
        setMessage(t('slot.archived', { id: spoolId }));
        return;
      }
      if (slot.assignment?.spool_id === spoolId) return;
      busy.current = true;
      const previous = slot.assignment?.spool_id ?? null;
      try {
        const res = await assign.mutateAsync({ spoolId, slot });
        haptic();
        setMessage(null);
        void toast({
          message: t('ams.done', { id: spoolId, slot: slot.label }) + (res.pending_config ? ` – ${t('ams.pending')}` : ''),
          duration: 4000,
          position: 'top',
          buttons: [
            {
              text: t('common.undo'),
              handler: () => {
                // vorherige Spule zurück bzw. Slot wieder leeren
                (previous ? assign.mutateAsync({ spoolId: previous, slot }) : unassign.mutateAsync(slot)).catch((e: unknown) =>
                  setMessage(t('common.failed', { msg: e instanceof Error ? e.message : String(e) })),
                );
              },
            },
          ],
        });
      } catch (e) {
        haptic('warning');
        setMessage(t('common.failed', { msg: e instanceof Error ? e.message : String(e) }));
      } finally {
        busy.current = false;
      }
    },
    [slot, spools.data, assign, unassign, toast, canEdit],
  );

  const onCode = useCallback(
    (raw: string) => {
      const r = parseScan(raw);
      if (r.kind === 'spool') void assignSpool(r.spoolId);
      else if (r.kind === 'slot') navigate(`/spools/slot/${r.printerId}/${r.amsId}/${r.trayId}`, { replace: true });
      else {
        haptic('warning');
        setMessage(t('slot.notSpool'));
      }
    },
    [assignSpool, navigate],
  );

  const submitManual = () => {
    const v = manual.trim().replace(/^#/, '');
    if (!v) return;
    onCode(/^\d+$/.test(v) ? `bm:s:${v}` : v);
    setManual('');
  };

  const confirmEmpty = () =>
    slot &&
    void alert({
      header: slot.label,
      message: t('ams.remove') + '?',
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        {
          text: t('ams.remove'),
          role: 'destructive',
          handler: () => {
            unassign.mutateAsync(slot).catch((e: unknown) => setMessage(t('common.failed', { msg: e instanceof Error ? e.message : String(e) })));
          },
        },
      ],
    });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/scan" text="" />
          </IonButtons>
          <IonTitle>{slot ? `${slot.printerName} · ${slot.label}` : t('slot.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {isPending ? (
          <StateView state="loading" />
        ) : isError ? (
          <StateView state="offline" onRetry={() => void refetch()} />
        ) : !slot ? (
          // Drucker bekannt, aber ohne Status → nicht erreichbar; sonst gibt es den Slot wirklich nicht
          printers.some((p) => p.id === target.printerId) || statusError ? (
            <StateView state="offline" onRetry={() => void refetch()} />
          ) : (
            <StateView state="error" message={t('slot.unknown')} />
          )
        ) : (
          <>
            {/* Treffer-Karte: was liegt gerade im Slot */}
            <section
              style={{
                display: 'flex',
                gap: 'var(--bs-s4)',
                alignItems: 'center',
                padding: 'var(--bs-s4)',
                marginBottom: 'var(--bs-s4)',
                background: 'var(--bs-surface)',
                borderRadius: 'var(--bs-r-lg)',
              }}
            >
              {occupant ? (
                <>
                  <ColorRing rgba={occupant.rgba} fill={fillRatio(occupant)} size={56} label={occupant.color_name ?? occupant.material} />
                  <div style={{ flex: 1, display: 'grid', gap: 'var(--bs-s1)' }}>
                    <IonNote>{t('slot.current')}</IonNote>
                    <strong>{spoolTitle(occupant)}</strong>
                    <div style={{ display: 'flex', gap: 'var(--bs-s2)', alignItems: 'center' }}>
                      <MaterialBadge material={[occupant.material, occupant.subtype].filter(Boolean).join(' ')} />
                      <span className="bs-num">{remainingGrams(occupant)} g</span>
                    </div>
                  </div>
                  <button type="button" onClick={confirmEmpty} aria-label={t('ams.remove')} style={{ all: 'unset', cursor: 'pointer', color: 'var(--bs-text-2)', padding: 'var(--bs-s2)' }}>
                    ✕
                  </button>
                </>
              ) : (
                <IonNote>{t('slot.empty')}</IonNote>
              )}
            </section>
            <ScannerView active={active} onCode={onCode} hint={t('slot.scanSpool')} />
            {message && (
              <p role="alert" style={{ textAlign: 'center', color: 'var(--bs-critical)' }}>
                {message}
              </p>
            )}
            {/* Ersatz ohne Kamera: Nummer (#7 / 7) oder Code (bm:s:7) */}
            <IonList inset>
              <IonItem>
                <IonInput
                  label={t('scan.manual')}
                  labelPlacement="stacked"
                  placeholder="7 / bm:s:7"
                  value={manual}
                  onIonInput={(e) => setManual(String(e.detail.value ?? ''))}
                  onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                />
                <IonButton slot="end" fill="clear" disabled={!manual.trim()} onClick={submitManual}>
                  {t('ams.title')}
                </IonButton>
              </IonItem>
            </IonList>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
