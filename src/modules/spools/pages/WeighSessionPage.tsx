import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar,
  useIonAlert,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { weightUsedFromScale, type Spool } from '@/core/api';
import { t } from '@/core/i18n';
import { haptic, storage } from '@/core/platform';
import { parseScan } from '@/core/qr/codes';
import { ScannerView, StateView } from '@/core/ui';
import { useArchiveSpool, useLocations, useMoveSpool, useSpools, useWeighSpool } from '../hooks/useSpools';
import { spoolTitle } from '../slots';
import { missingSpools, newSession, parseGrams, record, SESSION_KEY, type WeighSession } from '../weighSession';

/**
 * SP-09: Spule scannen → Waagenwert eintippen → Enter = gespeichert → nächste Spule.
 * Inventur: Ort für die Runde, am Ende „nicht gesehen“. Ohne Waagen-Anbindung.
 */
export function WeighSessionPage() {
  const spools = useSpools();
  const locations = useLocations();
  const weigh = useWeighSpool();
  const move = useMoveSpool();
  const archive = useArchiveSpool();
  const [session, setSession] = useState<WeighSession>(() => storage.get(SESSION_KEY, newSession()));
  const [current, setCurrent] = useState<Spool | null>(null);
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [active, setActive] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const input = useRef<HTMLIonInputElement>(null);
  const [alert] = useIonAlert();

  useIonViewDidEnter(() => setActive(true));
  useIonViewWillLeave(() => setActive(false));
  useEffect(() => storage.set(SESSION_KEY, session), [session]);

  const byId = useCallback((id: number) => spools.data?.find((s) => s.id === id) ?? null, [spools.data]);

  const openSpool = useCallback(
    (id: number) => {
      const s = byId(id);
      if (!s) {
        haptic('warning');
        setMessage(t('weighs.unknown', { id }));
        return;
      }
      haptic();
      setMessage(null);
      setCurrent(s);
      setValue('');
      // Inventur: gesehen + ggf. an den Ort der Runde buchen – auch ohne Gewicht
      if (session.inventory) {
        setSession((x) => record(x, { spoolId: s.id, gross: null, rest: null, at: new Date().toISOString() }));
        if (session.locationId != null && s.location_id !== session.locationId) {
          void move.mutateAsync({ spoolId: s.id, locationId: session.locationId }).catch((e: unknown) => setMessage(String(e)));
        }
      }
      setTimeout(() => void input.current?.setFocus(), 150);
    },
    [byId, session.inventory, session.locationId, move],
  );

  const onCode = useCallback(
    (raw: string) => {
      const r = parseScan(raw);
      if (r.kind === 'spool') openSpool(r.spoolId);
      else {
        haptic('warning');
        setMessage(t('slot.notSpool'));
      }
    },
    [openSpool],
  );

  const gross = parseGrams(value);
  const rest = current && gross != null ? Math.round(current.label_weight - weightUsedFromScale(gross, current)) : null;

  const save = async () => {
    if (!current || gross == null) return;
    try {
      await weigh.mutateAsync({ spoolId: current.id, gross });
      haptic();
      setSession((x) => record(x, { spoolId: current.id, gross, rest, at: new Date().toISOString() }));
      setCurrent(null);
      setValue('');
    } catch (e) {
      haptic('warning');
      setMessage(t('common.failed', { msg: e instanceof Error ? e.message : String(e) }));
    }
  };

  const submitManual = () => {
    const v = manual.trim().replace(/^#/, '');
    if (!v) return;
    if (/^\d+$/.test(v)) openSpool(Number(v));
    else onCode(v);
    setManual('');
  };

  const restart = (inventory: boolean, locationId: number | null) => {
    setSession(newSession(inventory, locationId));
    setCurrent(null);
    setShowMissing(false);
  };

  const missing = missingSpools(session, spools.data ?? []);
  const locName = (id: number | null) => locations.data?.find((l) => l.id === id)?.name ?? t('move.none');

  const confirmArchive = (s: Spool) =>
    void alert({
      header: spoolTitle(s),
      message: t('weighs.archiveQ'),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        { text: t('weighs.archive'), role: 'destructive', handler: () => void archive.mutateAsync(s.id) },
      ],
    });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/spools" text="" />
          </IonButtons>
          <IonTitle>{t('weighs.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {spools.isPending ? (
          <StateView state="loading" />
        ) : (
          <>
            {/* Modus */}
            <IonList inset style={{ margin: '0 0 var(--bs-s3)' }}>
              <IonItem>
                <IonToggle checked={session.inventory} onIonChange={(e) => restart(e.detail.checked, session.locationId)}>
                  {t('weighs.inventory')}
                </IonToggle>
              </IonItem>
              {session.inventory && (
                <IonItem>
                  <IonSelect
                    label={t('weighs.location')}
                    labelPlacement="stacked"
                    interface="action-sheet"
                    value={session.locationId ?? 0}
                    onIonChange={(e) => setSession((x) => ({ ...x, locationId: Number(e.detail.value) || null }))}
                  >
                    <IonSelectOption value={0}>{t('weighs.keepLocation')}</IonSelectOption>
                    {(locations.data ?? []).map((l) => (
                      <IonSelectOption key={l.id} value={l.id}>
                        {l.name}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
              )}
            </IonList>

            {/* Aktuelle Spule: Gewicht eintippen, Enter */}
            {current ? (
              <section style={{ background: 'var(--bs-surface)', borderRadius: 'var(--bs-r-lg)', padding: 'var(--bs-s4)', marginBottom: 'var(--bs-s3)', display: 'grid', gap: 'var(--bs-s2)' }}>
                <strong>{spoolTitle(current)}</strong>
                <IonNote>
                  {t('weigh.core', { g: current.core_weight })}
                  {current.last_scale_weight != null ? ` · ${t('weighs.lastGross', { g: current.last_scale_weight })}` : ''}
                </IonNote>
                <IonInput
                  ref={input}
                  label={t('weigh.gross')}
                  labelPlacement="stacked"
                  inputmode="decimal"
                  enterkeyhint="done"
                  placeholder="g"
                  value={value}
                  className="bs-num"
                  fill="outline"
                  onIonInput={(e) => setValue(String(e.detail.value ?? ''))}
                  onKeyDown={(e) => e.key === 'Enter' && void save()}
                />
                {rest != null && (
                  <div className="bs-num" style={{ fontSize: 'var(--bs-fs-title)', fontWeight: 700 }}>
                    {t('weigh.result', { g: rest })}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 'var(--bs-s2)' }}>
                  <IonButton style={{ flex: 1 }} disabled={gross == null || weigh.isPending} onClick={() => void save()}>
                    {t('common.save')}
                  </IonButton>
                  <IonButton fill="outline" onClick={() => setCurrent(null)}>
                    {session.inventory ? t('weighs.seenOnly') : t('common.cancel')}
                  </IonButton>
                </div>
              </section>
            ) : null}

            <ScannerView active={active} onCode={onCode} hint={current ? t('weighs.scanNext') : t('weighs.scan')} />
            {message && (
              <p role="alert" style={{ textAlign: 'center', color: 'var(--bs-critical)' }}>
                {message}
              </p>
            )}
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
                  {t('scan.open')}
                </IonButton>
              </IonItem>
            </IonList>

            {/* Erledigt in dieser Runde */}
            <IonList inset>
              <IonListHeader>
                <IonLabel>{t('weighs.done', { n: session.done.length })}</IonLabel>
                {session.done.length > 0 && (
                  <IonButton size="small" fill="clear" onClick={() => restart(session.inventory, session.locationId)}>
                    {t('weighs.newRound')}
                  </IonButton>
                )}
              </IonListHeader>
              {session.done.map((d) => {
                const s = byId(d.spoolId);
                return (
                  <IonItem key={d.spoolId} button detail={false} onClick={() => openSpool(d.spoolId)}>
                    <IonLabel>{s ? spoolTitle(s) : `#${d.spoolId}`}</IonLabel>
                    <IonNote slot="end" className="bs-num">
                      {d.rest != null ? `${d.rest} g` : t('weighs.seen')}
                    </IonNote>
                  </IonItem>
                );
              })}
            </IonList>

            {/* Inventur: nicht gesehen */}
            {session.inventory && (
              <IonList inset>
                <IonListHeader>
                  <IonLabel>{t('weighs.missing', { n: missing.length, where: session.locationId != null ? locName(session.locationId) : t('weighs.everywhere') })}</IonLabel>
                  <IonButton size="small" fill="clear" onClick={() => setShowMissing((v) => !v)}>
                    {showMissing ? t('weighs.hide') : t('weighs.show')}
                  </IonButton>
                </IonListHeader>
                {showMissing &&
                  missing.map((s) => (
                    <IonItem key={s.id}>
                      <IonLabel>
                        {spoolTitle(s)}
                        <div style={{ color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)' }}>{locName(s.location_id)}</div>
                      </IonLabel>
                      <IonButton slot="end" size="small" fill="clear" color="danger" onClick={() => confirmArchive(s)}>
                        {t('weighs.archive')}
                      </IonButton>
                    </IonItem>
                  ))}
              </IonList>
            )}
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
