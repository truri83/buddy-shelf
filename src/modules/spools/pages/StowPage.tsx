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
  IonTitle,
  IonToolbar,
  useIonRouter,
  useIonViewDidEnter,
  useIonViewWillLeave,
} from '@ionic/react';
import { useCallback, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAllowed } from '@/core/api';
import { t } from '@/core/i18n';
import { haptic, warnFeedback } from '@/core/platform';
import { parseScan } from '@/core/qr/codes';
import { errorText, ScannerView, StateView } from '@/core/ui';
import { useLocations, useMoveSpool, useSpools } from '../hooks/useSpools';
import { useLocationPrefs } from '../hooks/useLocationPrefs';
import { locationText } from '../locationPrefs';
import { spoolTitle } from '../slots';

interface Entry {
  spoolId: number;
  title: string;
  /** lag schon dort */
  already: boolean;
}

/** SP-17: Lagerort-Etikett gescannt → jede weitere gescannte Spule wird dorthin gebucht. */
export function StowPage() {
  const { id } = useParams();
  const locationId = Number(id);
  const locations = useLocations();
  const locationPrefs = useLocationPrefs();
  const spools = useSpools();
  const move = useMoveSpool();
  const canEdit = useAllowed('inventory:update');
  const router = useIonRouter();
  const [active, setActive] = useState(false);
  const [done, setDone] = useState<Entry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const busy = useRef(new Set<number>());
  useIonViewDidEnter(() => setActive(true));
  useIonViewWillLeave(() => setActive(false));

  const location = locations.data?.find((l) => l.id === locationId);

  const onCode = useCallback(
    (raw: string) => {
      const r = parseScan(raw);
      if (r.kind === 'location') {
        // anderes Lagerort-Etikett: dort weiter einräumen
        if (r.locationId !== locationId) {
          setDone([]);
          router.push(`/spools/stow/${r.locationId}`, 'none', 'replace');
        }
        return;
      }
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
      const entry = { spoolId: s.id, title: spoolTitle(s), already: s.location_id === locationId };
      if (entry.already) {
        haptic();
        setDone((d) => [entry, ...d]);
        return;
      }
      busy.current.add(s.id);
      move
        .mutateAsync({ spoolId: s.id, locationId })
        .then(() => {
          haptic();
          setDone((d) => [entry, ...d]);
        })
        .catch((e: unknown) => {
          warnFeedback();
          setMessage(errorText(e));
        })
        .finally(() => busy.current.delete(s.id));
    },
    [locationId, spools.data, done, move, router],
  );

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
            <IonBackButton defaultHref="/more/locations" text="" />
          </IonButtons>
          <IonTitle>
            {location ? t('stow.title', { name: locationText(location.name, locationPrefs.icons[location.id]) }) : t('stow.titleShort')}
          </IonTitle>
          <IonButtons slot="end">
            <IonButton strong onClick={() => (router.canGoBack() ? router.goBack() : router.push('/more/locations', 'back'))}>
              {t('stow.done')}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {locations.isPending || spools.isPending ? (
          <StateView state="loading" />
        ) : locations.isError || spools.isError ? (
          <StateView state="offline" onRetry={() => void Promise.all([locations.refetch(), spools.refetch()])} />
        ) : !location ? (
          <StateView state="error" message={t('stow.unknown', { id: String(id) })} />
        ) : !canEdit ? (
          <StateView state="denied" />
        ) : (
          <>
            <ScannerView active={active} onCode={onCode} hint={t('stow.hint', { name: location.name })} />
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
                  {t('stow.action')}
                </IonButton>
              </IonItem>
            </IonList>
            <IonList inset>
              <IonListHeader>
                <IonLabel>{t('stow.count', { n: done.length })}</IonLabel>
              </IonListHeader>
              {done.length === 0 ? (
                <IonItem lines="none">
                  <IonNote>{t('stow.empty')}</IonNote>
                </IonItem>
              ) : (
                done.map((d) => (
                  <IonItem key={d.spoolId} routerLink={`/spools/${d.spoolId}`} detail>
                    <IonLabel>{d.title}</IonLabel>
                    <IonNote slot="end">{d.already ? t('stow.already') : t('stow.moved')}</IonNote>
                  </IonItem>
                ))
              )}
            </IonList>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
