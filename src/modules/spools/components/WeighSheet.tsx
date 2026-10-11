import { IonButton, IonContent, IonHeader, IonInput, IonItem, IonList, IonModal, IonNote, IonTitle, IonToolbar, useIonToast } from '@ionic/react';
import { useState } from 'react';
import { weightUsedFromScale, type Spool } from '@/core/api';
import { t } from '@/core/i18n';
import { haptic } from '@/core/platform';
import { FillBar } from '@/core/ui';
import { useWeighSpool } from '../hooks/useSpools';
import { spoolTitle } from '../slots';

interface Props {
  spool: Spool;
  isOpen: boolean;
  onDismiss: () => void;
}

/** SP-05: Bruttogewicht eingeben → Vorschau Rest → speichern (Bambuddys Waagen-Endpunkt). */
export function WeighSheet({ spool, isOpen, onDismiss }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const weigh = useWeighSpool();
  const [toast] = useIonToast();

  const gross = Number(value.replace(',', '.'));
  const valid = value.trim() !== '' && Number.isFinite(gross) && gross > 0 && gross <= 100_000;
  const rest = valid ? Math.round(spool.label_weight - weightUsedFromScale(gross, spool)) : null;
  const tooLight = valid && gross < spool.core_weight;

  const save = async () => {
    if (!valid) return;
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
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss} initialBreakpoint={0.6} breakpoints={[0, 0.6, 1]}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('weigh.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonNote style={{ display: 'block', padding: 'var(--bs-s3) var(--bs-s4) 0' }}>{spoolTitle(spool)}</IonNote>
        <IonList inset>
          <IonItem>
            <IonInput
              label={t('weigh.gross')}
              labelPlacement="stacked"
              inputmode="decimal"
              type="text"
              placeholder="g"
              value={value}
              onIonInput={(e) => setValue(String(e.detail.value ?? ''))}
              onKeyDown={(e) => e.key === 'Enter' && void save()}
              className="bs-num"
            />
          </IonItem>
        </IonList>
        <div style={{ display: 'grid', gap: 'var(--bs-s2)', padding: '0 var(--bs-s4)' }}>
          <IonNote>{t('weigh.core', { g: spool.core_weight })}</IonNote>
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
          <IonButton expand="block" disabled={!valid || weigh.isPending} onClick={() => void save()} style={{ marginTop: 'var(--bs-s3)' }}>
            {t('common.save')}
          </IonButton>
        </div>
      </IonContent>
    </IonModal>
  );
}
