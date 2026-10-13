import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import { closeCircleOutline, pricetagOutline } from 'ionicons/icons';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { remainingGrams, useAllowed } from '@/core/api';
import { fmtNum, t } from '@/core/i18n';
import { materialLabel } from '@/core/filament';
import { haptic, warnFeedback } from '@/core/platform';
import { parseScan } from '@/core/qr/codes';
import { ColorRing, errorText, MaterialBadge, ScannerView, StateView, useNotify } from '@/core/ui';
import { LabelSheet } from '../components/LabelSheet';
import { SlotLabelSheet } from '../components/SlotLabelSheet';
import { useAdoptFromSlot, useAssignSpool, useLinkTagToSpool, useSlots, useSpools, useUnassign } from '../hooks/useSpools';
import { isNewRfid, linkCandidates, spoolTitle, type Slot } from '../slots';

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
  const adopt = useAdoptFromSlot();
  const link = useLinkTagToSpool();
  const [printing, setPrinting] = useState<Slot[] | null>(null);
  const [adopted, setAdopted] = useState<import('@/core/api').Spool | null>(null);
  const busy = useRef(false);
  const navigate = useNavigate();
  const notify = useNotify();
  const [alert] = useIonAlert();

  useIonViewDidEnter(() => setActive(true));
  useIonViewWillLeave(() => setActive(false));

  const slot = slots.find((s) => s.printerId === target.printerId && s.amsId === target.amsId && s.trayId === target.trayId);
  const occupant = slot?.assignment ? spools.data?.find((s) => s.id === slot.assignment!.spool_id) : undefined;
  // Neu erkannte Bambu-Spule: ist es eine Lager-Spule? Dann Chip verknüpfen statt Dublette anlegen
  const newRfid = !!slot && isNewRfid(slot, spools.data ?? []);
  const candidates =
    newRfid && slot
      ? linkCandidates(
          slot,
          spools.data ?? [],
          slots.flatMap((s) => (s.assignment ? [s.assignment] : [])),
        ).slice(0, 3)
      : [];

  // ohne useCallback: der Scanner hält onCode über eine Ref, der React-Compiler memoisiert selbst
  const assignSpool = async (spoolId: number) => {
    if (!slot || busy.current) return;
    if (!canEdit) {
      setMessage(t('common.noPermission'));
      return;
    }
    const spool = spools.data?.find((s) => s.id === spoolId);
    if (spool?.archived_at) {
      warnFeedback();
      setMessage(t('slot.archived', { id: spoolId }));
      return;
    }
    if (slot.assignment?.spool_id === spoolId) return;
    busy.current = true;
    const previous = slot.assignment?.spool_id ?? null;
    try {
      // Neue Bambu-Spule im Slot + Lager-Etikett gescannt: Chip gleich mitverknüpfen (sonst legt Bambuddy eine Dublette an)
      const place = newRfid ? link : assign;
      const res = await place.mutateAsync({ spoolId, slot });
      haptic();
      setMessage(null);
      notify.ok(t('ams.done', { id: spoolId, slot: slot.label }) + (res.pending_config ? ` – ${t('ams.pending')}` : ''), {
        duration: 4000,
        buttons: [
          {
            text: t('common.undo'),
            handler: () => {
              // vorherige Spule zurück bzw. Slot wieder leeren
              (previous ? assign.mutateAsync({ spoolId: previous, slot }) : unassign.mutateAsync(slot)).catch((e: unknown) =>
                setMessage(errorText(e)),
              );
            },
          },
        ],
      });
    } catch (e) {
      warnFeedback();
      setMessage(errorText(e));
    } finally {
      busy.current = false;
    }
  };

  const onCode = (raw: string) => {
    const r = parseScan(raw);
    if (r.kind === 'spool') void assignSpool(r.spoolId);
    else if (r.kind === 'slot') navigate(`/more/slots/${r.printerId}/${r.amsId}/${r.trayId}`, { replace: true });
    else {
      warnFeedback();
      setMessage(t('slot.notSpool'));
    }
  };

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
      message: t('ams.removeQ'),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        {
          text: t('ams.remove'),
          role: 'destructive',
          handler: () => {
            unassign.mutateAsync(slot).catch((e: unknown) => setMessage(errorText(e)));
          },
        },
      ],
    });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/more/slots" text="" />
          </IonButtons>
          <IonTitle>{slot ? `${slot.printerName} · ${slot.label}` : t('slot.title')}</IonTitle>
          {slot && (
            <IonButtons slot="end">
              <IonButton onClick={() => setPrinting([slot])} aria-label={t('slots.label', { slot: slot.label })}>
                <IonIcon slot="icon-only" icon={pricetagOutline} />
              </IonButton>
            </IonButtons>
          )}
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
                  <ColorRing rgba={occupant.rgba} size={56} label={occupant.color_name ?? occupant.material} />
                  <div style={{ flex: 1, display: 'grid', gap: 'var(--bs-s1)' }}>
                    <IonNote>{t('slot.current')}</IonNote>
                    <strong>{spoolTitle(occupant)}</strong>
                    <div style={{ display: 'flex', gap: 'var(--bs-s2)', alignItems: 'center' }}>
                      <MaterialBadge material={materialLabel(occupant)} />
                      <span className="bs-num">{fmtNum(remainingGrams(occupant))} g</span>
                    </div>
                  </div>
                  <IonButton fill="clear" color="medium" disabled={!canEdit} onClick={confirmEmpty} aria-label={t('ams.remove')}>
                    <IonIcon slot="icon-only" icon={closeCircleOutline} />
                  </IonButton>
                </>
              ) : newRfid ? (
                <div style={{ display: 'grid', gap: 'var(--bs-s3)', width: '100%' }}>
                  <IonNote>{t('rfid.slotHint', { what: slot.traySubBrand ?? slot.trayType ?? '' })}</IonNote>
                  {candidates.length > 0 && (
                    <>
                      <strong>{t('rfid.isStock')}</strong>
                      {candidates.map((c) => (
                        <IonButton
                          key={c.id}
                          fill="outline"
                          disabled={link.isPending || !canEdit}
                          onClick={() => void assignSpool(c.id)}
                          style={{ margin: 0, '--padding-start': 'var(--bs-s2)' }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--bs-s2)', width: '100%', textAlign: 'left' }}>
                            <ColorRing rgba={c.rgba} size={28} label={c.color_name ?? c.material} />
                            <span style={{ flex: 1 }}>{spoolTitle(c)}</span>
                          </span>
                        </IonButton>
                      ))}
                      <IonNote>{t('rfid.orScan')}</IonNote>
                    </>
                  )}
                  <IonButton
                    fill={candidates.length ? 'clear' : 'solid'}
                    disabled={adopt.isPending || !canEdit}
                    onClick={() =>
                      void adopt
                        .mutateAsync(slot)
                        .then((s) => setAdopted(s))
                        .catch((e: unknown) => setMessage(errorText(e)))
                    }
                    style={{ margin: 0 }}
                  >
                    {candidates.length ? t('rfid.adoptNew') : t('rfid.adopt')}
                  </IonButton>
                </div>
              ) : (
                <IonNote>{t('slot.empty')}</IonNote>
              )}
            </section>
            <LabelSheet spools={adopted ? [adopted] : []} isOpen={!!adopted} onDismiss={() => setAdopted(null)} />
            <SlotLabelSheet slots={printing} onDismiss={() => setPrinting(null)} />
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
                  placeholder="7"
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
