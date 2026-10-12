import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import { add, flameOutline, notificationsOffOutline, notificationsOutline, thermometerOutline, timeOutline } from 'ionicons/icons';
import { useState } from 'react';
import { useAllowed } from '@/core/api';
import { DEFAULT_DRYING, FAMILIES, useDryingConfig, useSaveDryingConfig, type DryingConfig, type StorageKind } from '@/core/filament';
import { t } from '@/core/i18n';
import { ChoiceChip, EditSheet, FieldRow, MaterialBadge, MetaChip, NumberInput, RangeInput } from '@/core/ui';
import { STORAGE_TYPES } from '../newSpool';
import { STORAGE_ICONS } from '../storage';

const range = ([a, b]: [number, number]) => (a === b ? `${a}` : `${a}–${b}`);

interface FamilyDraft {
  fam: string;
  isNew: boolean;
  temp: [number | null, number | null];
  hours: [number | null, number | null];
  days: number | null;
}

const familyValid = (d: FamilyDraft) =>
  !!d.fam &&
  d.temp.every((v) => v != null && v > 0 && v <= 120) &&
  d.hours.every((v) => v != null && v > 0 && v <= 72) &&
  d.temp[1]! >= d.temp[0]! &&
  d.hours[1]! >= d.hours[0]! &&
  (d.days == null || d.days > 0);

/** Trocknung pflegen: Dörrautomat, Lagerungsarten, Werte je Materialfamilie (gilt für alle Geräte). */
export function DryingSettingsPage() {
  const saved = useDryingConfig();
  const save = useSaveDryingConfig();
  const canEdit = useAllowed('inventory:update');
  const [draft, setDraft] = useState<DryingConfig | null>(null);
  const [editing, setEditing] = useState<FamilyDraft | null>(null);
  const cfg = draft ?? saved;
  const [alert] = useIonAlert();
  const [toast] = useIonToast();
  const families = Object.keys(cfg.materials).sort((a, b) => FAMILIES.indexOf(a as never) - FAMILIES.indexOf(b as never));
  const missing = FAMILIES.filter((f) => !cfg.materials[f]);

  const change = (fn: (c: DryingConfig) => DryingConfig) => setDraft(fn(structuredClone(cfg)));

  const openFamily = (fam: string | null) => {
    const row = fam ? cfg.materials[fam] : undefined;
    setEditing({
      fam: fam ?? missing[0] ?? '',
      isNew: !fam,
      temp: row ? [...row.temp] : [50, 60],
      hours: row ? [...row.hours] : [4, 8],
      days: row ? row.reminderDays : 14,
    });
  };

  const applyFamily = () => {
    if (!editing || !familyValid(editing)) return false;
    const prev = cfg.materials[editing.fam];
    change((c) => ({
      ...c,
      materials: {
        ...c.materials,
        [editing.fam]: {
          temp: editing.temp as [number, number],
          hours: editing.hours as [number, number],
          ams: prev?.ams ?? null,
          reminderDays: editing.days,
        },
      },
    }));
    return true;
  };

  const persist = (value: DryingConfig | null) =>
    save
      .mutateAsync(value)
      .then(() => {
        setDraft(null);
        void toast({ message: t('common.saved'), duration: 1500, position: 'top' });
      })
      .catch(
        (e: unknown) =>
          void toast({
            message: t('common.failed', { msg: e instanceof Error ? e.message : String(e) }),
            duration: 3000,
            position: 'top',
            color: 'danger',
          }),
      );

  const reset = () =>
    void alert({
      header: t('drySet.reset'),
      message: t('drySet.resetQ'),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        { text: t('drySet.reset'), role: 'destructive', handler: () => void persist(null) },
      ],
    });

  const ams = editing ? (cfg.materials[editing.fam]?.ams ?? DEFAULT_DRYING.materials[editing.fam]?.ams ?? null) : null;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/more" text="" />
          </IonButtons>
          <IonTitle>{t('drySet.title')}</IonTitle>
          {canEdit && (
            <IonButtons slot="end">
              <IonButton onClick={reset}>{t('drySet.reset')}</IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {!canEdit && (
          <IonNote color="warning" style={{ display: 'block', padding: 'var(--bs-s4) var(--bs-s5) 0' }}>
            {t('common.noPermission')}
          </IonNote>
        )}

        <IonList inset>
          <IonListHeader>{t('drySet.dehydrator')}</IonListHeader>
          <FieldRow icon={flameOutline} label={t('drySet.maxTemp')} hint={t('drySet.maxTempHint')} lines="none">
            <NumberInput
              label={t('drySet.maxTemp')}
              unit="°C"
              value={cfg.dehydratorMax}
              onChange={(v) => canEdit && change((c) => ({ ...c, dehydratorMax: v }))}
            />
          </FieldRow>
        </IonList>

        <IonList inset>
          <IonListHeader>{t('drySet.storage')}</IonListHeader>
          {STORAGE_TYPES.map((k, i) => {
            const f = cfg.storageFactor[k as StorageKind];
            return (
              <FieldRow
                key={k}
                icon={STORAGE_ICONS[k]}
                tone={f == null ? 'muted' : 'accent'}
                label={t(`storage.${k}`)}
                hint={f == null ? t('drySet.noReminder') : t('drySet.factorHint', { f: String(f).replace('.', ',') })}
                lines={i === STORAGE_TYPES.length - 1 ? 'none' : undefined}
              >
                <NumberInput
                  label={t(`storage.${k}`)}
                  unit="×"
                  value={f}
                  onChange={(v) => canEdit && change((c) => ({ ...c, storageFactor: { ...c.storageFactor, [k]: v } }))}
                />
              </FieldRow>
            );
          })}
        </IonList>
        <IonNote className="bs-section-note">{t('drySet.storageHint')}</IonNote>

        <IonList inset>
          <IonListHeader>{t('drySet.families')}</IonListHeader>
          {families.map((fam) => {
            const r = cfg.materials[fam]!;
            return (
              <IonItem key={fam} button={canEdit} detail={canEdit} onClick={() => canEdit && openFamily(fam)}>
                <IonLabel>
                  <MaterialBadge material={fam} />
                  <div className="bs-meta-row">
                    <MetaChip icon={thermometerOutline}>{range(r.temp)} °C</MetaChip>
                    <MetaChip icon={timeOutline}>{range(r.hours)} h</MetaChip>
                    {r.reminderDays ? (
                      <MetaChip icon={notificationsOutline} tone="accent">
                        {t('drySet.everyDays', { n: r.reminderDays })}
                      </MetaChip>
                    ) : (
                      <MetaChip icon={notificationsOffOutline}>{t('drySet.noReminder')}</MetaChip>
                    )}
                  </div>
                </IonLabel>
              </IonItem>
            );
          })}
          {canEdit && missing.length > 0 && (
            <IonItem button detail={false} lines="none" onClick={() => openFamily(null)}>
              <IonIcon icon={add} slot="start" color="primary" aria-hidden />
              <IonLabel color="primary">{t('drySet.addFamily')}</IonLabel>
            </IonItem>
          )}
        </IonList>
        <IonNote className="bs-section-note">{t('drySet.familiesHint')}</IonNote>

        <EditSheet
          isOpen={!!editing}
          title={editing?.isNew ? t('drySet.addFamily') : (editing?.fam ?? '')}
          saveDisabled={!editing || !familyValid(editing)}
          onSave={applyFamily}
          onDismiss={() => setEditing(null)}
        >
          {editing && (
            <>
              {editing.isNew && (
                <div
                  className="bs-chip-row"
                  style={{ display: 'flex', gap: 'var(--bs-s1)', overflowX: 'auto', padding: 'var(--bs-s3) var(--bs-s4) 0' }}
                >
                  {missing.map((f) => (
                    <ChoiceChip key={f} selected={editing.fam === f} onSelect={() => setEditing({ ...editing, fam: f })}>
                      {f}
                    </ChoiceChip>
                  ))}
                </div>
              )}
              <IonList inset>
                <FieldRow icon={thermometerOutline} label={t('drySet.temp')}>
                  <RangeInput
                    label={t('drySet.temp')}
                    unit="°C"
                    value={editing.temp}
                    onChange={(temp) => setEditing({ ...editing, temp })}
                  />
                </FieldRow>
                <FieldRow icon={timeOutline} label={t('drySet.hours')}>
                  <RangeInput
                    label={t('drySet.hours')}
                    unit="h"
                    value={editing.hours}
                    onChange={(hours) => setEditing({ ...editing, hours })}
                  />
                </FieldRow>
                <FieldRow
                  icon={editing.days ? notificationsOutline : notificationsOffOutline}
                  tone={editing.days ? 'accent' : 'muted'}
                  label={t('drySet.reminder')}
                  hint={t('drySet.reminderHint')}
                  lines="none"
                >
                  <NumberInput
                    label={t('drySet.reminder')}
                    unit={t('drySet.days')}
                    value={editing.days}
                    onChange={(days) => setEditing({ ...editing, days })}
                  />
                </FieldRow>
              </IonList>
              {ams && <IonNote className="bs-section-note">{t('dry.ams', { temp: ams.temp, hours: ams.hours })}</IonNote>}
              <IonNote className="bs-section-note">{t('drySet.familiesHint')}</IonNote>
            </>
          )}
        </EditSheet>
      </IonContent>
      {draft && (
        <IonFooter>
          <IonToolbar>
            <div style={{ display: 'flex', gap: 'var(--bs-s2)', padding: 'var(--bs-s2) var(--bs-s3)' }}>
              <IonButton fill="outline" onClick={() => setDraft(null)} style={{ margin: 0 }}>
                {t('common.cancel')}
              </IonButton>
              <IonButton expand="block" disabled={save.isPending} onClick={() => void persist(cfg)} style={{ flex: 1, margin: 0 }}>
                {t('common.save')}
              </IonButton>
            </div>
          </IonToolbar>
        </IonFooter>
      )}
    </IonPage>
  );
}
