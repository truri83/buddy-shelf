import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
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
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import { add } from 'ionicons/icons';
import { useState } from 'react';
import { useAllowed } from '@/core/api';
import { FAMILIES, useDryingConfig, useSaveDryingConfig, type DryingConfig, type DryingRow, type StorageKind } from '@/core/filament';
import { t } from '@/core/i18n';
import { StateView } from '@/core/ui';
import { STORAGE_TYPES } from '../newSpool';
import { STORAGE_ICONS } from '../storage';

const sub = { color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)', whiteSpace: 'normal' } as const;
const range = ([a, b]: [number, number]) => (a === b ? `${a}` : `${a}–${b}`);
/** leer → null, sonst positive Zahl (Komma erlaubt) */
const num = (v: unknown): number | null => {
  const n = Number(
    String(v ?? '')
      .replace(',', '.')
      .trim(),
  );
  return String(v ?? '').trim() && Number.isFinite(n) && n >= 0 ? n : null;
};

/** Trocknung pflegen: Dörrautomat, Lagerungsarten, Werte je Materialfamilie (gilt für alle Geräte). */
export function DryingSettingsPage() {
  const saved = useDryingConfig();
  const save = useSaveDryingConfig();
  const canEdit = useAllowed('inventory:update');
  const [draft, setDraft] = useState<DryingConfig | null>(null);
  const cfg = draft ?? saved;
  const dirty = draft !== null;
  const [alert] = useIonAlert();
  const [toast] = useIonToast();
  const families = Object.keys(cfg.materials).sort((a, b) => FAMILIES.indexOf(a as never) - FAMILIES.indexOf(b as never));
  const missing = FAMILIES.filter((f) => !cfg.materials[f]);

  const change = (fn: (c: DryingConfig) => DryingConfig) => setDraft(fn(structuredClone(cfg)));

  const editFamily = (fam: string) => {
    const row: DryingRow = cfg.materials[fam] ?? { temp: [50, 60], hours: [4, 8], ams: null, reminderDays: 14 };
    void alert({
      header: fam,
      message: t('drySet.familyHint'),
      inputs: [
        { name: 't0', type: 'number', label: t('drySet.tempFrom'), placeholder: t('drySet.tempFrom'), value: row.temp[0] },
        { name: 't1', type: 'number', label: t('drySet.tempTo'), placeholder: t('drySet.tempTo'), value: row.temp[1] },
        { name: 'h0', type: 'number', label: t('drySet.hoursFrom'), placeholder: t('drySet.hoursFrom'), value: row.hours[0] },
        { name: 'h1', type: 'number', label: t('drySet.hoursTo'), placeholder: t('drySet.hoursTo'), value: row.hours[1] },
        {
          name: 'days',
          type: 'number',
          label: t('drySet.reminderDays'),
          placeholder: t('drySet.reminderDays'),
          value: row.reminderDays ?? '',
        },
      ],
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        {
          text: t('common.save'),
          handler: (v: Record<string, string>) => {
            const [t0, t1, h0, h1] = [num(v.t0), num(v.t1), num(v.h0), num(v.h1)];
            if (t0 == null || t1 == null || h0 == null || h1 == null || t1 < t0 || h1 < h0 || t1 > 120) {
              void toast({ message: t('drySet.invalid'), duration: 2500, position: 'top', color: 'warning' });
              return false;
            }
            change((c) => ({
              ...c,
              materials: { ...c.materials, [fam]: { ...row, temp: [t0, t1], hours: [h0, h1], reminderDays: num(v.days) || null } },
            }));
            return true;
          },
        },
      ],
    });
  };

  const addFamily = () =>
    void alert({
      header: t('drySet.addFamily'),
      inputs: missing.map((f, i) => ({ type: 'radio' as const, label: f, value: f, checked: i === 0 })),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        { text: t('common.next'), handler: (f: string) => void (f && editFamily(f)) },
      ],
    });

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
        {!canEdit && <StateView state="error" message={t('common.noPermission')} />}
        <IonList inset>
          <IonListHeader>{t('drySet.dehydrator')}</IonListHeader>
          <IonItem lines="none">
            <IonInput
              label={t('drySet.maxTemp')}
              labelPlacement="stacked"
              inputmode="numeric"
              placeholder="–"
              helperText={t('settings.dehydratorMaxHint')}
              disabled={!canEdit}
              value={cfg.dehydratorMax ?? ''}
              onIonInput={(e) => change((c) => ({ ...c, dehydratorMax: num(String(e.detail.value ?? '').replace(/[^0-9]/g, '')) }))}
            />
          </IonItem>
        </IonList>

        <IonList inset>
          <IonListHeader>{t('drySet.storage')}</IonListHeader>
          {STORAGE_TYPES.map((k) => (
            <IonItem key={k}>
              <IonIcon icon={STORAGE_ICONS[k]} slot="start" color="primary" aria-hidden />
              <IonInput
                label={t(`storage.${k}`)}
                labelPlacement="start"
                inputmode="decimal"
                placeholder={t('drySet.noReminder')}
                disabled={!canEdit}
                value={cfg.storageFactor[k as StorageKind] ?? ''}
                onIonInput={(e) => change((c) => ({ ...c, storageFactor: { ...c.storageFactor, [k]: num(e.detail.value) } }))}
                style={{ textAlign: 'right' }}
              >
                <span slot="end" style={sub}>
                  ×
                </span>
              </IonInput>
            </IonItem>
          ))}
          <IonNote style={{ display: 'block', padding: 'var(--bs-s2) var(--bs-s4) var(--bs-s3)', ...sub }}>
            {t('drySet.storageHint')}
          </IonNote>
        </IonList>

        <IonList inset>
          <IonListHeader>{t('drySet.families')}</IonListHeader>
          {families.map((fam) => {
            const r = cfg.materials[fam]!;
            return (
              <IonItem key={fam} button={canEdit} detail={canEdit} onClick={() => canEdit && editFamily(fam)}>
                <IonLabel>
                  <strong>{fam}</strong>
                  <div style={sub}>
                    {t('drySet.row', { temp: range(r.temp), hours: range(r.hours) })}
                    {' · '}
                    {r.reminderDays ? t('drySet.everyDays', { n: r.reminderDays }) : t('drySet.noReminder')}
                  </div>
                </IonLabel>
              </IonItem>
            );
          })}
          {canEdit && missing.length > 0 && (
            <IonItem button detail={false} lines="none" onClick={addFamily}>
              <IonIcon icon={add} slot="start" color="primary" aria-hidden />
              <IonLabel color="primary">{t('drySet.addFamily')}</IonLabel>
            </IonItem>
          )}
          <IonNote style={{ display: 'block', padding: 'var(--bs-s2) var(--bs-s4) var(--bs-s3)', ...sub }}>
            {t('drySet.familiesHint')}
          </IonNote>
        </IonList>
      </IonContent>
      {dirty && (
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
