import { IonButton, IonIcon, IonList, useIonToast } from '@ionic/react';
import { calendarOutline, sunnyOutline } from 'ionicons/icons';
import { useState, type CSSProperties } from 'react';
import type { Spool } from '@/core/api';
import { fmtDate, t } from '@/core/i18n';
import { daysSince, dryingAdvice, dryingDue, todayIso, useDryingConfig } from '@/core/filament';
import { ChoiceChip, EditSheet, TextRow } from '@/core/ui';
import { STORAGE_TYPES } from '../newSpool';
import { STORAGE_ICONS } from '../storage';
import { useSetExtras } from '../hooks/useSpools';

/** „vor 3 Tagen“ usw. */
export function agoText(iso: string): string {
  const n = daysSince(iso);
  return n <= 0 ? t('dry.today') : n === 1 ? t('dry.yesterday') : t('dry.daysAgo', { n });
}

const range = ([a, b]: [number, number]) => (a === b ? `${a}` : `${a}–${b}`);

/** SP-15: Empfehlung für den Dörrautomaten + „zuletzt getrocknet“. */
export function DryingCard({ spool, canEdit, style }: { spool: Spool; canEdit: boolean; style: CSSProperties }) {
  const cfg = useDryingConfig();
  const advice = dryingAdvice(spool.material, cfg);
  const due = dryingDue(spool, cfg);
  const set = useSetExtras();
  const [toast] = useIonToast();
  const save = (patch: { dried_at?: string | null; storage_type?: string | null }) =>
    set.mutateAsync({ ids: [spool.id], patch }).catch(
      (e: unknown) =>
        void toast({
          message: t('common.failed', { msg: e instanceof Error ? e.message : String(e) }),
          duration: 3000,
          position: 'top',
          color: 'danger',
        }),
    );
  const [date, setDate] = useState<string | null>(null);
  const pickDate = () => setDate(spool.dried_at?.slice(0, 10) ?? todayIso());

  return (
    <section style={style}>
      <h2
        style={{ margin: '0 0 var(--bs-s3)', fontSize: 'var(--bs-fs-title)', display: 'flex', alignItems: 'center', gap: 'var(--bs-s2)' }}
      >
        <IonIcon icon={sunnyOutline} aria-hidden style={{ color: 'var(--bs-accent)' }} />
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
            {advice.tooHotForDehydrator && (
              <span style={{ fontSize: 'var(--bs-fs-caption)', color: 'var(--bs-warn)' }}>
                {t('dry.tooHot', { max: cfg.dehydratorMax ?? '' })}
              </span>
            )}
          </>
        ) : (
          <span style={{ color: 'var(--bs-text-2)' }}>{t('dry.unknown', { material: spool.material })}</span>
        )}
        {/* Lagerungsart: Grundlage der Erinnerung */}
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--bs-s1)', marginTop: 'var(--bs-s2)' }}
          role="group"
          aria-label={t('new.storageType')}
        >
          {STORAGE_TYPES.map((k) => (
            <ChoiceChip
              key={k}
              selected={spool.storage_type === k}
              disabled={!canEdit || set.isPending}
              onSelect={() => void save({ storage_type: spool.storage_type === k ? null : k })}
            >
              <IonIcon icon={STORAGE_ICONS[k]} aria-hidden style={{ marginRight: 'var(--bs-s1)' }} />
              {t(`storage.${k}`)}
            </ChoiceChip>
          ))}
        </div>
        <div style={{ fontSize: 'var(--bs-fs-caption)', color: due?.due ? 'var(--bs-warn)' : 'var(--bs-text-2)' }}>
          {due
            ? due.due
              ? due.dueInDays === 0
                ? t('dry.dueToday')
                : t('dry.dueNow', { n: -due.dueInDays })
              : t('dry.dueIn', { n: due.dueInDays })
            : spool.storage_type === 'sealed'
              ? t('dry.noReminderSealed')
              : t('dry.noReminder')}
        </div>
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
          <IonButton size="small" disabled={set.isPending} onClick={() => void save({ dried_at: todayIso() })}>
            {t('dry.markToday')}
          </IonButton>
          <IonButton size="small" fill="outline" disabled={set.isPending} onClick={pickDate}>
            {t('dry.pickDate')}
          </IonButton>
          {spool.dried_at && (
            <IonButton size="small" fill="clear" color="medium" disabled={set.isPending} onClick={() => void save({ dried_at: null })}>
              {t('dry.clear')}
            </IonButton>
          )}
        </div>
      )}
      <EditSheet
        isOpen={date !== null}
        title={t('dry.pickDate')}
        saveDisabled={!date || date > todayIso()}
        busy={set.isPending}
        onSave={async () => (date ? (await save({ dried_at: date }), true) : false)}
        onDismiss={() => setDate(null)}
      >
        <IonList inset>
          <TextRow
            icon={calendarOutline}
            type="date"
            label={t('dry.last')}
            value={date ?? ''}
            max={todayIso()}
            onChange={setDate}
            lines="none"
          />
        </IonList>
      </EditSheet>
    </section>
  );
}
