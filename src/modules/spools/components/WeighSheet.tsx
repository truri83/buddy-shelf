import { IonButton, IonContent, IonHeader, IonInput, IonItem, IonList, IonModal, IonNote, IonTitle, IonToolbar, useIonToast } from '@ionic/react';
import { useState } from 'react';
import { weightUsedFromScale, type Spool } from '@/core/api';
import { t } from '@/core/i18n';
import { haptic } from '@/core/platform';
import { FillBar } from '@/core/ui';
import { netToGross } from '../cores';
import { useWeighSpool } from '../hooks/useSpools';
import { spoolTitle } from '../slots';
import { parseGrams } from '../weighSession';
import { CoreRow, NetHint, useWeighMode, WeighModeSwitch } from './CoreRow';

interface Props {
  spool: Spool;
  isOpen: boolean;
  onDismiss: () => void;
}

/** SP-05/SP-10: Brutto (Waage mit Spule) oder Netto eingeben → Vorschau Rest → speichern (Bambuddys Waagen-Endpunkt). */
export function WeighSheet({ spool, isOpen, onDismiss }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useWeighMode();
  const weigh = useWeighSpool();
  const [toast] = useIonToast();

  const entered = parseGrams(value);
  const gross = entered == null ? null : mode === 'net' ? netToGross(entered, spool.core_weight) : entered;
  const rest = gross != null ? Math.round(spool.label_weight - weightUsedFromScale(gross, spool)) : null;
  const tooLight = mode === 'gross' && gross != null && gross < spool.core_weight;

  const save = async () => {
    if (gross == null) return;
    setError(null);
    try {
      await weigh.mutateAsync({ spoolId: spool.id, gross });
      haptic();
      void toast({ message: t('weigh.done', { id: spool.id, g: rest ?? 0 }), duration: 2000, position: 'top' });
      setValue('');
      onDismiss();
    } catch (e) {
      setError(t('common.failed', { msg: e instanceof Error ? e.message : String(e) }));
    }
  };

  return (
    <IonModal isOpen={isOpen} onWillPresent={() => (setValue(''), setError(null))} onDidDismiss={onDismiss} initialBreakpoint={0.75} breakpoints={[0, 0.75, 1]}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('weigh.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonNote style={{ display: 'block', padding: 'var(--bs-s3) var(--bs-s4) 0' }}>{spoolTitle(spool)}</IonNote>
        <div style={{ padding: 'var(--bs-s3) var(--bs-s4) 0' }}>
          <WeighModeSwitch mode={mode} onChange={setMode} />
        </div>
        <IonList inset>
          <IonItem>
            <IonInput
              label={mode === 'net' ? t('weigh.net') : t('weigh.gross')}
              labelPlacement="stacked"
              inputmode="decimal"
              enterkeyhint="done"
              placeholder="g"
              value={value}
              onIonInput={(e) => setValue(String(e.detail.value ?? ''))}
              onKeyDown={(e) => e.key === 'Enter' && void save()}
              className="bs-num"
            />
          </IonItem>
        </IonList>
        <div style={{ display: 'grid', gap: 'var(--bs-s2)', padding: '0 var(--bs-s4)' }}>
          {mode === 'gross' && <CoreRow spool={spool} />}
          <NetHint mode={mode} core={spool.core_weight} />
          {rest != null && (
            <>
              <div className="bs-num" style={{ fontSize: 'var(--bs-fs-title)', fontWeight: 700 }}>
                {t('weigh.result', { g: rest })}
              </div>
              <FillBar fill={spool.label_weight > 0 ? rest / spool.label_weight : 0} low={false} />
            </>
          )}
          {tooLight && <IonNote color="warning">{t('weigh.tooLight', { g: spool.core_weight })}</IonNote>}
          {spool.last_scale_weight != null && spool.last_weighed_at && (
            <IonNote>{t('weigh.last', { g: spool.last_scale_weight, date: new Date(spool.last_weighed_at).toLocaleDateString('de-DE') })}</IonNote>
          )}
          {error && (
            <IonNote color="danger" role="alert">
              {error}
            </IonNote>
          )}
          <IonButton expand="block" disabled={gross == null || weigh.isPending} onClick={() => void save()} style={{ marginTop: 'var(--bs-s3)' }}>
            {t('common.save')}
          </IonButton>
        </div>
      </IonContent>
    </IonModal>
  );
}
