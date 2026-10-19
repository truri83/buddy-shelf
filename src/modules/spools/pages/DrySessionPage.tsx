import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonRouter,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import { pricetagOutline } from 'ionicons/icons';
import { useRef, useState } from 'react';
import { useAllowed } from '@/core/api';
import { dryingAdvice, todayIso, useDryingConfig } from '@/core/filament';
import { t } from '@/core/i18n';
import { haptic, warnFeedback } from '@/core/platform';
import { parseScan } from '@/core/qr/codes';
import { errorText, ScannerView, StateView } from '@/core/ui';
import { useSetExtras, useSpools } from '../hooks/useSpools';
import { DriedLabelSheet } from '../components/DriedLabelSheet';
import { spoolTitle } from '../slots';

interface Entry {
  spoolId: number;
  title: string;
  /** Empfehlung für den Dörrautomaten („55–60 °C · 6–8 h“) */
  advice: string | null;
  /** war heute schon als getrocknet gebucht */
  already: boolean;
}

const range = ([a, b]: [number, number]) => (a === b ? `${a}` : `${a}–${b}`);

/**
 * Ablauf „Trocknen“ (Etikett am Dörrautomaten): jede danach gescannte Spule wird als heute getrocknet gebucht;
 * dazu die Temperatur/Dauer-Empfehlung ihrer Materialfamilie.
 */
export function DrySessionPage() {
  const spools = useSpools();
  const setExtras = useSetExtras();
  const dryCfg = useDryingConfig();
  const canEdit = useAllowed('inventory:update');
  const router = useIonRouter();
  const [active, setActive] = useState(false);
  const [done, setDone] = useState<Entry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [printing, setPrinting] = useState(false);
  const busy = useRef(new Set<number>());
  useIonViewDidEnter(() => setActive(true));
  useIonViewWillLeave(() => setActive(false));
  const today = todayIso();

  const onCode = (raw: string) => {
    const r = parseScan(raw);
    if (r.kind !== 'spool') {
      warnFeedback();
      setMessage(t('slot.notSpool'));
      return;
    }
    const s = spools.data?.find((x) => x.id === r.spoolId);
    if (!s) {
      warnFeedback();
      setMessage(t('weighs.unknown', { id: r.spoolId }));
      return;
    }
    // Kamera meldet denselben Code mehrmals: einmal reicht
    if (busy.current.has(s.id) || done.some((d) => d.spoolId === s.id)) return;
    setMessage(null);
    const a = dryingAdvice(s.material, dryCfg);
    const entry: Entry = {
      spoolId: s.id,
      title: spoolTitle(s),
      advice: a ? t('dry.advice', { temp: range(a.temp), hours: range(a.hours) }) : null,
      already: s.dried_at === today,
    };
    if (entry.already) {
      haptic();
      setDone((d) => [entry, ...d]);
      return;
    }
    busy.current.add(s.id);
    setExtras
      .mutateAsync({ ids: [s.id], patch: { dried_at: today } })
      .then(() => {
        haptic();
        setDone((d) => [entry, ...d]);
      })
      .catch((e: unknown) => {
        warnFeedback();
        setMessage(errorText(e));
      })
      .finally(() => busy.current.delete(s.id));
  };

  // ohne Kamera (PC): Nummer oder Code eintippen
  const submitManual = () => {
    const v = manual.trim().replace(/^#/, '');
    if (!v) return;
    onCode(/^\d+$/.test(v) ? `bm:s:${v}` : v);
    setManual('');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/spools" text="" />
          </IonButtons>
          <IonTitle>{t('drySession.title')}</IonTitle>
          <IonButtons slot="end">
            <IonButton strong onClick={() => (router.canGoBack() ? router.goBack() : router.push('/spools', 'back'))}>
              {t('stow.done')}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {spools.isPending ? (
          <StateView state="loading" />
        ) : spools.isError ? (
          <StateView state="offline" onRetry={() => void spools.refetch()} />
        ) : !canEdit ? (
          <StateView state="denied" />
        ) : (
          <>
            <ScannerView active={active} onCode={onCode} hint={t('drySession.hint')} />
            {message && (
              <p role="alert" style={{ textAlign: 'center', color: 'var(--bs-critical)', padding: '0 var(--bs-s4)' }}>
                {message}
              </p>
            )}
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
                  {t('drySession.action')}
                </IonButton>
              </IonItem>
            </IonList>
            <IonList inset>
              <IonListHeader>
                <IonLabel>{t('drySession.count', { n: done.length })}</IonLabel>
              </IonListHeader>
              {done.length === 0 ? (
                <IonItem lines="none">
                  <IonNote>{t('stow.empty')}</IonNote>
                </IonItem>
              ) : (
                done.map((d) => (
                  <IonItem key={d.spoolId} routerLink={`/spools/${d.spoolId}`} detail>
                    <IonLabel>
                      {d.title}
                      {d.advice && <p>{d.advice}</p>}
                    </IonLabel>
                    <IonNote slot="end">{d.already ? t('drySession.already') : t('drySession.marked')}</IonNote>
                  </IonItem>
                ))
              )}
            </IonList>
            {done.length > 0 && (
              <div style={{ padding: '0 var(--bs-s4) var(--bs-s4)' }}>
                <IonButton expand="block" fill="outline" onClick={() => setPrinting(true)}>
                  <IonIcon slot="start" icon={pricetagOutline} />
                  {t('drySession.print', { n: done.length })}
                </IonButton>
              </div>
            )}
            <DriedLabelSheet
              spools={printing ? done.flatMap((d) => spools.data?.find((s) => s.id === d.spoolId) ?? []) : null}
              date={today}
              onDismiss={() => setPrinting(false)}
            />
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
