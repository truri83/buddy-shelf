import { IonButton, IonIcon, useIonAlert, useIonToast } from '@ionic/react';
import { waterOutline } from 'ionicons/icons';
import type { CSSProperties } from 'react';
import type { Spool } from '@/core/api';
import { fmtDate, t } from '@/core/i18n';
import { daysSince, dryingAdvice, todayIso } from '../drying';
import { useSetExtras } from '../hooks/useSpools';

/** „vor 3 Tagen“ usw. */
export function agoText(iso: string): string {
  const n = daysSince(iso);
  return n <= 0 ? t('dry.today') : n === 1 ? t('dry.yesterday') : t('dry.daysAgo', { n });
}

const range = ([a, b]: [number, number]) => (a === b ? `${a}` : `${a}–${b}`);

/** SP-15: Empfehlung für den Dörrautomaten + „zuletzt getrocknet“. */
export function DryingCard({ spool, canEdit, style }: { spool: Spool; canEdit: boolean; style: CSSProperties }) {
  const advice = dryingAdvice(spool.material);
  const set = useSetExtras();
  const [alert] = useIonAlert();
  const [toast] = useIonToast();
  const save = (dried_at: string | null) =>
    set.mutateAsync({ ids: [spool.id], patch: { dried_at } }).catch(
      (e: unknown) =>
        void toast({ message: t('common.failed', { msg: e instanceof Error ? e.message : String(e) }), duration: 3000, position: 'top', color: 'danger' }),
    );
  const pickDate = () =>
    void alert({
      header: t('dry.pickDate'),
      inputs: [{ name: 'date', type: 'date', value: spool.dried_at?.slice(0, 10) ?? todayIso(), max: todayIso() }],
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        { text: t('common.save'), handler: (v: { date?: string }) => void (v.date && save(v.date)) },
      ],
    });

  return (
    <section style={style}>
      <h2 style={{ margin: '0 0 var(--bs-s3)', fontSize: 'var(--bs-fs-title)', display: 'flex', alignItems: 'center', gap: 'var(--bs-s2)' }}>
        <IonIcon icon={waterOutline} aria-hidden style={{ color: 'var(--bs-accent)' }} />
        {t('dry.title')}
      </h2>
      <div style={{ display: 'grid', gap: 'var(--bs-s1)' }}>
        {advice ? (
          <>
            <strong className="bs-num">{t('dry.advice', { temp: range(advice.temp), hours: range(advice.hours) })}</strong>
            {advice.ams && (
              <span className="bs-num" style={{ fontSize: 'var(--bs-fs-caption)', color: 'var(--bs-text-2)' }}>
                {t('dry.ams', { temp: advice.ams.temp, hours: advice.ams.hours })}
              </span>
            )}
            {advice.tooHotForDehydrator && <span style={{ fontSize: 'var(--bs-fs-caption)', color: 'var(--bs-warn)' }}>{t('dry.tooHot')}</span>}
          </>
        ) : (
          <span style={{ color: 'var(--bs-text-2)' }}>{t('dry.unknown', { material: spool.material })}</span>
        )}
        <div style={{ marginTop: 'var(--bs-s2)' }}>
          <span style={{ fontSize: 'var(--bs-fs-caption)', color: 'var(--bs-text-2)' }}>{t('dry.last')}: </span>
          {spool.dried_at ? (
            <span className="bs-num">
              {fmtDate(spool.dried_at)} ({agoText(spool.dried_at)})
            </span>
          ) : (
            <span style={{ color: 'var(--bs-text-2)' }}>{t('dry.never')}</span>
          )}
        </div>
      </div>
      {canEdit && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--bs-s2)', marginTop: 'var(--bs-s3)' }}>
          <IonButton size="small" disabled={set.isPending} onClick={() => void save(todayIso())}>
            {t('dry.markToday')}
          </IonButton>
          <IonButton size="small" fill="outline" disabled={set.isPending} onClick={pickDate}>
            {t('dry.pickDate')}
          </IonButton>
          {spool.dried_at && (
            <IonButton size="small" fill="clear" color="medium" disabled={set.isPending} onClick={() => void save(null)}>
              {t('dry.clear')}
            </IonButton>
          )}
        </div>
      )}
    </section>
  );
}
