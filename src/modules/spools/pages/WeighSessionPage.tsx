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
  useIonToast,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAllowed, weightUsedFromScale, type Spool } from '@/core/api';
import { t } from '@/core/i18n';
import { haptic, warnFeedback, storage } from '@/core/platform';
import { parseScan } from '@/core/qr/codes';
import { ScannerView, StateView } from '@/core/ui';
import { CoreRow, useWeighMode, WeighModeSwitch } from '../components/CoreRow';
import { netToGross } from '../cores';
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
  const [mode, setMode] = useWeighMode();
  const [alert] = useIonAlert();
  const [toast] = useIonToast();
  const canEdit = useAllowed('inventory:update');
  // Für Scanner-Rückrufe: aktuelle Spule und laufendes Speichern ohne veraltete Closures
  const currentRef = useRef<Spool | null>(null);
  const saving = useRef(false);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  const fail = useCallback((e: unknown) => {
    warnFeedback();
    setMessage(t('common.failed', { msg: e instanceof Error ? e.message : String(e) }));
  }, []);

  useIonViewDidEnter(() => setActive(true));
  useIonViewWillLeave(() => setActive(false));
  useEffect(() => storage.set(SESSION_KEY, session), [session]);

  const byId = useCallback((id: number) => spools.data?.find((s) => s.id === id) ?? null, [spools.data]);

  const openSpool = useCallback(
    (id: number) => {
      // dieselbe Spule nochmal im Bild oder Speichern läuft: Eingabe nicht verwerfen
      if (saving.current || currentRef.current?.id === id) return;
      const s = byId(id);
      if (!s) {
        warnFeedback();
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
        if (canEdit && session.locationId != null && s.location_id !== session.locationId) {
          move.mutateAsync({ spoolId: s.id, locationId: session.locationId }).catch(fail);
        }
      }
      setTimeout(() => void input.current?.setFocus(), 150);
    },
    [byId, session.inventory, session.locationId, move, canEdit, fail],
  );

  const onCode = useCallback(
    (raw: string) => {
      const r = parseScan(raw);
      if (r.kind === 'spool') openSpool(r.spoolId);
      else {
        warnFeedback();
        setMessage(t('slot.notSpool'));
      }
    },
    [openSpool],
  );

  const entered = parseGrams(value);
  const gross = entered == null || !current ? null : mode === 'net' ? netToGross(entered, current.core_weight) : entered;
  const rest = current && gross != null ? Math.round(current.label_weight - weightUsedFromScale(gross, current)) : null;

  const save = async () => {
    if (!current || gross == null || saving.current || !canEdit) return;
    const savedId = current.id;
    saving.current = true;
    try {
      await weigh.mutateAsync({ spoolId: savedId, gross });
      haptic();
      setSession((x) => record(x, { spoolId: savedId, gross, rest, at: new Date().toISOString() }));
      // nur leeren, wenn inzwischen keine andere Spule geöffnet wurde
      setCurrent((c) => (c?.id === savedId ? null : c));
      if (currentRef.current?.id === savedId) setValue('');
    } catch (e) {
      fail(e);
    } finally {
      saving.current = false;
    }
  };

  const submitManual = () => {
    const v = manual.trim().replace(/^#/, '');
    if (!v) return;
    if (/^\d+$/.test(v)) openSpool(Number(v));
    else onCode(v);
    setManual('');
  };

  const restart = () => {
    const go = () => {
      setSession((x) => newSession(x.inventory, x.locationId));
      setCurrent(null);
      setShowMissing(false);
    };
    if (session.done.length === 0) return go();
    void alert({
      header: t('weighs.newRound'),
      message: t('weighs.newRoundQ', { n: session.done.length }),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        { text: t('weighs.newRound'), role: 'destructive', handler: go },
      ],
    });
  };

  const missing = missingSpools(session, spools.data ?? []);
  const locName = (id: number | null) => locations.data?.find((l) => l.id === id)?.name ?? t('move.none');

  const confirmArchive = (s: Spool) =>
    void alert({
      header: spoolTitle(s),
      message: t('weighs.archiveQ'),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        {
          text: t('weighs.archive'),
          role: 'destructive',
          handler: () => {
            archive
              .mutateAsync(s.id)
              .then(() => void toast({ message: t('weighs.archived', { id: s.id }), duration: 2000, position: 'top' }))
              .catch(fail);
          },
        },
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
        ) : spools.isError ? (
          <StateView state="offline" onRetry={() => void spools.refetch()} />
        ) : (
          <>
            {!canEdit && (
              <IonNote color="warning" style={{ display: 'block', marginBottom: 'var(--bs-s3)' }}>
                {t('common.noPermission')}
              </IonNote>
            )}
            {/* Modus */}
            <IonList inset style={{ margin: '0 0 var(--bs-s3)' }}>
              <IonItem>
                <IonToggle checked={session.inventory} onIonChange={(e) => setSession((x) => ({ ...x, inventory: e.detail.checked }))}>
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
                <WeighModeSwitch mode={mode} onChange={setMode} />
                {mode === 'gross' && <CoreRow spool={current} onChanged={(s) => setCurrent(s)} />}
                {current.last_scale_weight != null && <IonNote>{t('weighs.lastGross', { g: current.last_scale_weight })}</IonNote>}
                <IonInput
                  ref={input}
                  label={mode === 'net' ? t('weigh.net') : t('weigh.gross')}
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
                  <IonButton style={{ flex: 1 }} disabled={gross == null || weigh.isPending || !canEdit} onClick={() => void save()}>
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
                  <IonButton size="small" fill="clear" onClick={restart}>
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
                      <IonButton slot="end" size="small" fill="clear" color="danger" disabled={!canEdit} onClick={() => confirmArchive(s)}>
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
