import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useRef, useState } from 'react';
import type { Location, Spool } from '@/core/api';
import { t } from '@/core/i18n';
import { haptic, storage } from '@/core/platform';
import { errorText, useNotify } from '@/core/ui';
import { useBulkMove, useCreateLocation, useLocations, useMoveSpool } from '../hooks/useSpools';
import { orderLocations } from '../logic';
import { useLocationPrefs } from '../hooks/useLocationPrefs';
import { LocationSymbol } from './LocationSymbol';
import { spoolTitle } from '../slots';

interface Props {
  /** eine Spule (Detail) oder mehrere (Mehrfachauswahl) */
  spools: Spool[];
  isOpen: boolean;
  onDismiss: () => void;
  onDone?: () => void;
}

const LAST_KEY = 'spools.lastLocation';

/** SP-04: Lagerort wählen – ein Tipp speichert. Zuletzt genutzter Ort oben. */
export function MoveSheet({ spools, isOpen, onDismiss, onDone }: Props) {
  const modal = useRef<HTMLIonModalElement>(null);
  const locations = useLocations();
  const locationPrefs = useLocationPrefs();
  const move = useMoveSpool();
  const bulk = useBulkMove();
  const single = spools.length === 1 ? spools[0]! : null;
  const create = useCreateLocation();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const notify = useNotify();

  const ordered = orderLocations(locations.data ?? [], storage.get<number | null>(LAST_KEY, null));

  const choose = async (loc: Location | null) => {
    setError(null);
    try {
      if (single) await move.mutateAsync({ spoolId: single.id, locationId: loc?.id ?? null });
      else await bulk.mutateAsync({ ids: spools.map((x) => x.id), locationId: loc?.id ?? null });
      if (loc) storage.set(LAST_KEY, loc.id);
      haptic();
      const where = loc?.name ?? t('move.none');
      notify.ok(single ? t('move.done', { id: single.id, name: where }) : t('move.doneMany', { n: spools.length, name: where }));
      onDone?.();
      onDismiss();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const addAndChoose = async () => {
    const n = name.trim();
    if (!n) return;
    setError(null);
    try {
      const loc = await create.mutateAsync(n);
      setName('');
      await choose(loc);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const busy = move.isPending || bulk.isPending || create.isPending;

  return (
    <IonModal
      ref={modal}
      isOpen={isOpen}
      onWillPresent={() => (setName(''), setError(null))}
      onDidDismiss={onDismiss}
      initialBreakpoint={0.75}
      breakpoints={[0, 0.75, 1]}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('move.title')}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => void modal.current?.dismiss()}>{t('common.close')}</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonNote style={{ display: 'block', padding: 'var(--bs-s3) var(--bs-s4) 0' }}>
          {single ? spoolTitle(single) : t('move.many', { n: spools.length })}
        </IonNote>
        <IonList inset>
          {ordered.map((loc, i) => (
            <IonItem key={loc.id} button detail={false} disabled={busy} onClick={() => void choose(loc)}>
              <LocationSymbol icon={locationPrefs.icons[loc.id]} slot="start" />
              <IonLabel>{loc.name}</IonLabel>
              {single && loc.id === single.location_id && <IonNote slot="end">✓</IonNote>}
              {i === 0 && loc.id === storage.get<number | null>(LAST_KEY, null) && loc.id !== single?.location_id && (
                <IonNote slot="end">{t('move.last')}</IonNote>
              )}
            </IonItem>
          ))}
          <IonItem button detail={false} disabled={busy} onClick={() => void choose(null)}>
            <IonLabel color="medium">{t('move.none')}</IonLabel>
            {single && single.location_id == null && <IonNote slot="end">✓</IonNote>}
          </IonItem>
        </IonList>
        {!locations.isPending && ordered.length === 0 && (
          <IonNote style={{ display: 'block', padding: '0 var(--bs-s4)' }}>{t('move.empty')}</IonNote>
        )}
        <IonList inset>
          <IonItem>
            <IonInput
              label={t('move.new')}
              labelPlacement="stacked"
              value={name}
              onIonInput={(e) => setName(String(e.detail.value ?? ''))}
              onKeyDown={(e) => e.key === 'Enter' && !busy && void addAndChoose()}
            />
            <IonButton slot="end" fill="clear" disabled={busy || !name.trim()} onClick={() => void addAndChoose()}>
              {t('move.add')}
            </IonButton>
          </IonItem>
        </IonList>
        {error && (
          <IonNote color="danger" role="alert" style={{ display: 'block', padding: '0 var(--bs-s4)' }}>
            {error}
          </IonNote>
        )}
      </IonContent>
    </IonModal>
  );
}
